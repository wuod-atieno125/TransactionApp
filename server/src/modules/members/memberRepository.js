
const db = require("../../config/database");
const crypto = require("node:crypto");

const OFFICE_ROLES = ["treasurer", "chairperson", "secretary"];
const MEMBER_STATUSES = ["approved", "disabled"];

async function withTransaction(callback) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function writeAudit(
  client,
  actorId,
  action,
  targetType,
  targetId,
  oldValues = null,
  newValues = null
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, old_values, new_values)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      actorId || null,
      action,
      targetType,
      targetId,
      oldValues === null ? null : JSON.stringify(oldValues),
      newValues === null ? null : JSON.stringify(newValues),
    ]
  );
}

async function list(role) {
  const contributionColumn =
    role === "chairperson"
      ? ""
      : `, COALESCE(
           SUM(CASE WHEN t.status = 'active' THEN t.amount ELSE 0 END),
           0
         ) AS "totalContributed"`;

  const result = await db.query(
    `SELECT
       u.id,
       u.full_name AS name,
       u.phone,
       u.role,
       u.account_status AS status,
       u.created_at AS "createdAt"
       ${contributionColumn}
     FROM users u
     ${
       role === "chairperson"
         ? ""
         : "LEFT JOIN transactions t ON t.member_user_id = u.id"
     }
     WHERE u.role = 'member'
       AND u.deleted_at IS NULL
       AND u.account_status <> 'anonymized'
     ${
       role === "chairperson"
         ? ""
         : "GROUP BY u.id"
     }
     ORDER BY u.full_name`
  );

  return result.rows;
}

async function listPending() {
  const result = await db.query(
    `SELECT id, full_name AS name, phone,
            created_at AS "createdAt"
     FROM users
     WHERE role = 'member'
       AND account_status = 'pending'
       AND deleted_at IS NULL
     ORDER BY created_at ASC`
  );

  return result.rows;
}

async function decideRegistration(id, decision, actorId) {
  if (!["approve", "reject"].includes(decision)) {
    throw new Error("Decision must be 'approve' or 'reject'.");
  }

  const status = decision === "approve" ? "approved" : "rejected";

  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE users
       SET account_status = $1, updated_at = NOW()
       WHERE id = $2
         AND role = 'member'
         AND account_status = 'pending'
         AND deleted_at IS NULL
       RETURNING id, full_name AS name, phone, role,
                 account_status AS status`,
      [status, id]
    );

    const user = result.rows[0];
    if (!user) return null;

    await writeAudit(
      client,
      actorId,
      `registration.${decision}`,
      "user",
      id,
      { status: "pending" },
      { status }
    );

    return user;
  });
}

async function setMemberStatus(id, status, actorId) {
  if (!MEMBER_STATUSES.includes(status)) {
    throw new Error(
      `Invalid member status. Allowed values: ${MEMBER_STATUSES.join(", ")}.`
    );
  }

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id, account_status
       FROM users
       WHERE id = $1
         AND role = 'member'
         AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );

    const previous = existing.rows[0];
    if (!previous) return null;

    if (!["approved", "disabled"].includes(previous.account_status)) {
      return null;
    }

    const result = await client.query(
      `UPDATE users
       SET account_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, full_name AS name, phone, role,
                 account_status AS status`,
      [status, id]
    );

    if (status === "disabled") {
      // connect-pg-simple stores the session data in the sess JSON column.
      await client.query(
        `DELETE FROM sessions
         WHERE sess->'user'->>'id' = $1`,
        [String(id)]
      );
    }

    await writeAudit(
      client,
      actorId,
      `member.${status}`,
      "user",
      id,
      { status: previous.account_status },
      { status }
    );

    return result.rows[0];
  });
}

/**
 * Initiate a role transfer.
 *
 * This deliberately creates a pending transfer instead of changing roles
 * immediately. The successor must accept it and the transfer workflow must
 * complete it before the office holder's role changes.
 */
async function transferRole(role, actorId, targetId) {
  if (!OFFICE_ROLES.includes(role)) {
    throw new Error(
      `Invalid office role. Allowed values: ${OFFICE_ROLES.join(", ")}.`
    );
  }

  if (String(actorId) === String(targetId)) {
    throw new Error("You cannot transfer an office to yourself.");
  }

  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT id, full_name, role, account_status
       FROM users
       WHERE id = $1
         AND role = $2
         AND account_status = 'approved'
         AND deleted_at IS NULL
       FOR UPDATE`,
      [actorId, role]
    );

    const current = currentResult.rows[0];
    if (!current) return null;

    const successorResult = await client.query(
      `SELECT id, full_name, role, account_status
       FROM users
       WHERE id = $1
         AND role = 'member'
         AND account_status = 'approved'
         AND deleted_at IS NULL
       FOR UPDATE`,
      [targetId]
    );

    const successor = successorResult.rows[0];
    if (!successor) return null;

    const pendingResult = await client.query(
      `SELECT id
       FROM role_transfers
       WHERE office_role = $1
         AND status IN ('pending', 'accepted')
       LIMIT 1
       FOR UPDATE`,
      [role]
    );

    if (pendingResult.rows[0]) {
      throw new Error(
        `An active transfer already exists for the ${role} office.`
      );
    }

    const inserted = await client.query(
      `INSERT INTO role_transfers
         (office_role, current_holder_user_id, successor_user_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [role, actorId, targetId]
    );

    const transfer = inserted.rows[0];

    await writeAudit(
      client,
      actorId,
      `role.${role}_transfer_requested`,
      "role_transfer",
      transfer.id,
      null,
      {
        officeRole: role,
        currentHolderUserId: actorId,
        successorUserId: targetId,
        status: "pending",
      }
    );

    return transfer;
  });
}

async function requestAccountDeletion(memberId, reason) {
  return withTransaction(async (client) => {
    const memberResult = await client.query(
      `SELECT id, full_name
       FROM users
       WHERE id = $1
         AND role = 'member'
         AND account_status = 'approved'
         AND deleted_at IS NULL
       FOR UPDATE`,
      [memberId]
    );
    const member = memberResult.rows[0];
    if (!member) return null;

    const pendingResult = await client.query(
      `SELECT id, request_reason AS reason, status,
              requested_at AS "requestedAt"
       FROM member_deletion_requests
       WHERE member_user_id = $1 AND status = 'pending'`,
      [memberId]
    );
    if (pendingResult.rows[0]) return pendingResult.rows[0];

    const requestResult = await client.query(
      `INSERT INTO member_deletion_requests (member_user_id, request_reason)
       VALUES ($1, $2)
       RETURNING id, request_reason AS reason, status,
                 requested_at AS "requestedAt"`,
      [memberId, reason]
    );
    const deletionRequest = requestResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, target_id, new_values
       )
       VALUES ($1, 'member.deletion_requested', 'user', $2, $3::jsonb)`,
      [
        memberId,
        memberId,
        JSON.stringify({
          requestId: deletionRequest.id,
          reason,
          status: "pending",
        }),
      ]
    );
    await client.query(
      `INSERT INTO notifications (
         recipient_user_id, event_type, title, message
       )
       SELECT id, 'member_deletion_requested',
              'Member account deletion requested', $1
       FROM users
       WHERE role = 'chairperson'
         AND account_status = 'approved'
         AND deleted_at IS NULL`,
      [`${member.full_name} requested account deletion. Reason: ${reason}`]
    );

    return deletionRequest;
  });
}

async function listPendingAccountDeletions() {
  const result = await db.query(
    `SELECT request.id, request.member_user_id AS "memberId",
            account.full_name AS "memberName",
            request.request_reason AS "requestReason",
            request.requested_at AS "requestedAt"
     FROM member_deletion_requests AS request
     JOIN users AS account ON account.id = request.member_user_id
     WHERE request.status = 'pending'
       AND account.role = 'member'
       AND account.account_status = 'approved'
       AND account.deleted_at IS NULL
     ORDER BY request.requested_at ASC`
  );
  return result.rows;
}

async function anonymizeMember(client, {
  memberId,
  memberName,
  previousStatus,
  actorId,
  reason,
  requestId = null,
  requestReason = null,
}) {
  await client.query(
    `DELETE FROM sessions
     WHERE sess->'user'->>'id' = $1`,
    [String(memberId)]
  );
  await client.query(
    `UPDATE users
     SET full_name = 'Deleted member',
         phone = NULL,
         normalized_phone = NULL,
         recovery_email = NULL,
         normalized_email = NULL,
         password_hash = $2,
         account_status = 'anonymized',
         deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [memberId, crypto.randomBytes(32).toString("hex")]
  );
  await writeAudit(
    client,
    actorId,
    "member.deletion_approved",
    "user",
    memberId,
    {
      status: previousStatus,
      ...(requestReason ? { requestReason } : {}),
    },
    {
      status: "anonymized",
      ...(requestId ? { requestId } : {}),
      reason,
    }
  );
  await client.query(
    `INSERT INTO notifications (
       recipient_user_id, event_type, title, message
     )
     SELECT id, 'member_deletion_approved',
            'Member account deleted', $1
     FROM users
     WHERE id <> $2
       AND role = 'member'
       AND account_status = 'approved'
       AND deleted_at IS NULL`,
    [
      `${memberName}'s account was deleted by the chairperson. Reason: ${reason}`,
      memberId,
    ]
  );
}

async function deleteMemberAccount(memberId, actorId, reason) {
  return withTransaction(async (client) => {
    const memberResult = await client.query(
      `SELECT id, full_name, account_status
       FROM users
       WHERE id = $1
         AND role = 'member'
         AND account_status = 'approved'
         AND deleted_at IS NULL
       FOR UPDATE`,
      [memberId]
    );
    const member = memberResult.rows[0];
    if (!member) return null;

    const requestResult = await client.query(
      `SELECT id, request_reason
       FROM member_deletion_requests
       WHERE member_user_id = $1
         AND status = 'pending'
       FOR UPDATE`,
      [memberId]
    );
    const pendingRequest = requestResult.rows[0];
    if (pendingRequest) {
      await client.query(
        `UPDATE member_deletion_requests
         SET status = 'approved',
             reviewed_by = $1,
             review_reason = $2,
             reviewed_at = NOW()
         WHERE id = $3`,
        [actorId, reason, pendingRequest.id]
      );
    }

    await anonymizeMember(client, {
      memberId: member.id,
      memberName: member.full_name,
      previousStatus: member.account_status,
      actorId,
      reason,
      requestId: pendingRequest?.id || null,
      requestReason: pendingRequest?.request_reason || null,
    });

    return {
      memberId: member.id,
      memberName: member.full_name,
      status: "anonymized",
    };
  });
}

async function decideAccountDeletion(requestId, actorId, decision, reason) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Decision must be 'approved' or 'rejected'.");
  }

  return withTransaction(async (client) => {
    const requestResult = await client.query(
      `SELECT request.id, request.member_user_id, request.request_reason,
              account.full_name, account.role, account.account_status
       FROM member_deletion_requests AS request
       JOIN users AS account ON account.id = request.member_user_id
       WHERE request.id = $1
         AND request.status = 'pending'
         AND account.deleted_at IS NULL
       FOR UPDATE OF request, account`,
      [requestId]
    );
    const request = requestResult.rows[0];
    if (!request || request.role !== "member" || request.account_status !== "approved") {
      return null;
    }

    await client.query(
      `UPDATE member_deletion_requests
       SET status = $1,
           reviewed_by = $2,
           review_reason = $3,
           reviewed_at = NOW()
       WHERE id = $4`,
      [decision, actorId, reason, requestId]
    );

    const status = decision === "approved" ? "anonymized" : "approved";

    if (decision === "approved") {
      await anonymizeMember(client, {
        memberId: request.member_user_id,
        memberName: request.full_name,
        previousStatus: request.account_status,
        actorId,
        reason,
        requestId,
        requestReason: request.request_reason,
      });
    } else {
      await writeAudit(
        client,
        actorId,
        "member.deletion_rejected",
        "user",
        request.member_user_id,
        {
          status: request.account_status,
          requestReason: request.request_reason,
        },
        {
          status,
          requestId,
          reason,
        }
      );
      await client.query(
        `INSERT INTO notifications (
           recipient_user_id, event_type, title, message
         )
         VALUES (
           $1, 'member_deletion_rejected',
           'Account deletion request declined', $2
         )`,
        [
          request.member_user_id,
          `Your account deletion request was declined. Reason: ${reason}`,
        ]
      );
    }

    return {
      requestId,
      memberId: request.member_user_id,
      memberName: request.full_name,
      status: decision,
      reason,
    };
  });
}

module.exports = {
  list,
  listPending,
  decideRegistration,
  setMemberStatus,
  transferRole,
  requestAccountDeletion,
  listPendingAccountDeletions,
  deleteMemberAccount,
  decideAccountDeletion,
};
