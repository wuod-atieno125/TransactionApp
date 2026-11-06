const { getClient, query } = require("../../../config/database");

function assertAmount(value, field = "Amount") {
  const amount = typeof value === "number" || typeof value === "string"
    ? Number(value)
    : NaN;

  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99
      || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
    const error = new Error(`${field} must be positive with no more than two decimal places.`);
    error.statusCode = 400;
    throw error;
  }

  return amount.toFixed(2);
}

function requireText(value, field, maxLength) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > maxLength) {
    const error = new Error(`${field} must be between 3 and ${maxLength} characters.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

async function getRequirementHistory() {
  const result = await query(
    `SELECT r.*, u.full_name AS set_by_name
     FROM welfare_contribution_requirements r
     JOIN users u ON u.id = r.set_by
     ORDER BY r.created_at DESC`
  );
  return result.rows;
}

async function listContributions({ role, userId, limit = 50, offset = 0 }) {
  const result = await query(
    `    SELECT COALESCE(l.source_transaction_id, legacy_reversal.source_transaction_id, l.id) AS id,
           l.member_user_id,
           u.full_name AS entered_member_name,
           l.amount,
           COALESCE(t.paid_at, l.created_at) AS paid_at,
           l.source_payment_reference AS mpesa_reference,
           COALESCE(t.status, 'active') AS status,
           reversal_request.status AS reversal_request_status,
           COALESCE(t.created_at, l.created_at) >= NOW() - INTERVAL '12 hours' AS reversal_allowed,
           l.balance_before,
           l.balance_after,
           l.description AS notes,
           l.created_at
    FROM welfare_ledger_entries l
    LEFT JOIN users u ON u.id = l.member_user_id
    LEFT JOIN LATERAL (
      SELECT reversal.source_transaction_id
      FROM welfare_ledger_entries reversal
      WHERE reversal.entry_type = 'reversal'
        AND reversal.member_user_id = l.member_user_id
        AND reversal.amount = l.amount
        AND reversal.created_at = l.created_at
        AND reversal.source_transaction_id IS NOT NULL
      ORDER BY reversal.id
      LIMIT 1
    ) legacy_reversal ON TRUE
    LEFT JOIN welfare_transactions t
      ON t.id = COALESCE(l.source_transaction_id, legacy_reversal.source_transaction_id)
    LEFT JOIN LATERAL (
      SELECT status
      FROM welfare_reversal_requests
      WHERE transaction_id = t.id
      ORDER BY created_at DESC
      LIMIT 1
    ) reversal_request ON TRUE
    WHERE l.entry_type = 'deposit'
      AND ($1 IN ('treasurer', 'chairperson') OR l.member_user_id = $2)
    ORDER BY l.created_at DESC
    LIMIT $3 OFFSET $4`,
    [role, userId, limit, offset]
  );
  return result.rows.map((row) => ({
    ...row,
    can_request_reversal: ["member", "chairperson", "secretary"].includes(role) &&
     row.member_user_id === userId,
  }));
}

async function setRequirement({ amount, reason, userId }) {
  const normalizedAmount = assertAmount(amount, "Contribution amount");
  const client = await getClient();

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE welfare_contribution_requirements
       SET ended_at = NOW()
       WHERE ended_at IS NULL`
    );
    const result = await client.query(
      `INSERT INTO welfare_contribution_requirements (amount, reason, set_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [normalizedAmount, reason ? requireText(reason, "Reason", 1000) : null, userId]
    );
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, new_values)
       VALUES ($1, 'welfare_requirement_changed', 'welfare_requirement', $2, $3::jsonb)`,
      [userId, result.rows[0].id, JSON.stringify(result.rows[0])]
    );
    await client.query(
      `INSERT INTO notifications (recipient_user_id, event_type, title, message)
       SELECT id, 'welfare_requirement_changed', 'Minimum welfare contribution changed',
              $1 FROM users
       WHERE LOWER(TRIM(role)) IN ('member', 'chairperson', 'secretary', 'treasurer')
         AND LOWER(TRIM(account_status)) = 'approved'
         AND deleted_at IS NULL`,
      [`The minimum welfare contribution is now KSh ${normalizedAmount}.`]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function recordContribution({ memberUserId, amount, description, mpesaReference, userId }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberUserId || "")) {
    const error = new Error("Member user ID must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }
  if (
    mpesaReference !== undefined &&
    mpesaReference !== null &&
    (typeof mpesaReference !== "string" || mpesaReference.trim().length > 100)
  ) {
    const error = new Error("M-Pesa reference must be text no longer than 100 characters.");
    error.statusCode = 400;
    throw error;
  }
  const normalizedAmount = assertAmount(amount);
  const paymentReference = typeof mpesaReference === "string"
    ? mpesaReference.trim() || null
    : null;
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const member = await client.query(
      `SELECT id, full_name FROM users
       WHERE id = $1
         AND LOWER(TRIM(role)) IN ('member', 'chairperson', 'secretary', 'treasurer')
         AND LOWER(TRIM(account_status)) = 'approved'
         AND deleted_at IS NULL`,
      [memberUserId]
    );
    if (!member.rowCount) {
      const error = new Error("Approved contributor account not found.");
      error.statusCode = 400;
      throw error;
    }
    const requirement = await client.query(
      `SELECT amount FROM welfare_contribution_requirements
       WHERE ended_at IS NULL LIMIT 1`
    );
    if (!requirement.rowCount) {
      const error = new Error("The chairperson must set a minimum welfare contribution before contributions can be recorded.");
      error.statusCode = 400;
      throw error;
    }
    if (Number(normalizedAmount) < Number(requirement.rows[0].amount)) {
      const error = new Error(`Contribution amount must be at least KSh ${requirement.rows[0].amount}.`);
      error.statusCode = 400;
      throw error;
    }
    await client.query("SELECT pg_advisory_xact_lock(284731)");
    const transaction = await client.query(
      `INSERT INTO welfare_transactions (
         member_user_id, entered_member_name, amount, paid_at,
         mpesa_reference, normalized_mpesa_reference, status,
         notes, created_by, updated_by
       )
       VALUES ($1, $2, $3, NOW(), $4, $5, 'active', $6, $7, $7)
       RETURNING id`,
      [
        memberUserId,
        member.rows[0].full_name,
        normalizedAmount,
        paymentReference,
        paymentReference?.toUpperCase() || null,
        description || null,
        userId,
      ]
    );
    const balance = await client.query(
      `SELECT COALESCE(SUM(
         CASE WHEN entry_type = 'deposit' THEN amount ELSE -amount END
       ), 0)::numeric(12,2) AS balance
       FROM welfare_ledger_entries WHERE member_user_id = $1`,
      [memberUserId]
    );
    const before = Number(balance.rows[0].balance);
    const after = (before + Number(normalizedAmount)).toFixed(2);
    const entry = await client.query(
      `INSERT INTO welfare_ledger_entries
       (member_user_id, entry_type, amount, balance_before, balance_after,
        recorded_by, description, source_payment_reference, source_transaction_id)
       VALUES ($1, 'deposit', $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [memberUserId, normalizedAmount, before.toFixed(2), after, userId, description || null, paymentReference, transaction.rows[0].id]
    );
    await client.query(
      `INSERT INTO notifications (recipient_user_id, event_type, title, message)
       SELECT id, 'welfare_contribution_recorded', 'Welfare contribution recorded',
              $1 FROM users WHERE role = 'member' AND account_status = 'approved'
              AND deleted_at IS NULL`,
      [`A welfare contribution of KSh ${normalizedAmount} was recorded for ${member.rows[0].full_name}.`]
    );
    await client.query("COMMIT");
    return entry.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getStatement(memberUserId) {
  const result = await query(
    `SELECT u.id, u.full_name, u.phone,
            COALESCE(SUM(CASE WHEN l.entry_type = 'deposit' THEN l.amount ELSE -l.amount END), 0)::numeric(12,2) AS balance,
            COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'deposit'), 0)::numeric(12,2) AS total_contributions,
            json_agg(l ORDER BY l.created_at DESC) FILTER (WHERE l.id IS NOT NULL) AS entries
     FROM users u
     LEFT JOIN welfare_ledger_entries l ON l.member_user_id = u.id
     WHERE u.id = $1
       AND LOWER(TRIM(u.role)) IN ('member', 'chairperson', 'secretary', 'treasurer')
       AND u.deleted_at IS NULL
     GROUP BY u.id`,
    [memberUserId]
  );
  return result.rows[0] || null;
}

async function getGroupBalance() {
  const result = await query(
    `SELECT COALESCE(SUM(CASE WHEN entry_type = 'deposit' THEN amount ELSE -amount END), 0)::numeric(12,2) AS balance,
            COALESCE(SUM(amount) FILTER (WHERE entry_type = 'deposit'), 0)::numeric(12,2) AS total_contributions
     FROM welfare_ledger_entries
     WHERE member_user_id IS NOT NULL`
  );
  return result.rows[0];
}

async function requestWithdrawal({ amount, purpose, userId }) {
  const requestedAmount = assertAmount(amount, "Requested amount");
  const normalizedPurpose = requireText(purpose, "Purpose", 1000);
  const requester = await query(
    `SELECT id, full_name, phone, role FROM users WHERE id = $1`,
    [userId]
  );
  const client = await getClient();
  try {
    const snapshot = requester.rows[0];
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO welfare_withdrawal_requests
       (requested_amount, purpose, requested_by, requester_snapshot)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      [requestedAmount, normalizedPurpose, userId, JSON.stringify(snapshot)]
    );
    await client.query(
      `INSERT INTO notifications (recipient_user_id, event_type, title, message)
       SELECT id, 'welfare_withdrawal_requested', 'Welfare withdrawal approval requested',
              $1 FROM users
       WHERE LOWER(TRIM(role)) IN ('member', 'chairperson')
         AND account_status = 'approved'
              AND deleted_at IS NULL`,
      [`A collective welfare withdrawal request for KSh ${requestedAmount} requires chairperson review.`]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listWithdrawals() {
  const result = await query(
    `SELECT r.*, requester.full_name AS requester_name,
            reviewer.full_name AS reviewer_name,
            COALESCE(deductions.total_amount, 0)::numeric(12,2) AS deducted_amount
     FROM welfare_withdrawal_requests r
     JOIN users requester ON requester.id = r.requested_by
     LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
     LEFT JOIN LATERAL (
       SELECT SUM(entry.amount) AS total_amount
       FROM welfare_ledger_entries entry
       WHERE entry.welfare_withdrawal_request_id = r.id
         AND entry.entry_type = 'deduction'
     ) deductions ON TRUE
     ORDER BY r.requested_at DESC`
  );
  return result.rows;
}

async function getWithdrawalExportData() {
  const [withdrawalsResult, officeHoldersResult] = await Promise.all([
    query(
      `SELECT r.*, requester.full_name AS requester_name,
              reviewer.full_name AS reviewer_name,
              COALESCE(deductions.items, '[]'::json) AS deductions,
              COALESCE(deductions.total_amount, 0)::numeric(12,2) AS deducted_amount
       FROM welfare_withdrawal_requests r
       JOIN users requester ON requester.id = r.requested_by
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'member_user_id', entry.member_user_id,
                    'member_name', member.full_name,
                    'amount', entry.amount,
                    'created_at', entry.created_at
                  )
                  ORDER BY entry.created_at, member.full_name
                ) AS items,
                SUM(entry.amount) AS total_amount
         FROM welfare_ledger_entries entry
         JOIN users member ON member.id = entry.member_user_id
         WHERE entry.welfare_withdrawal_request_id = r.id
           AND entry.entry_type = 'deduction'
       ) deductions ON TRUE
       ORDER BY r.requested_at DESC`
    ),
    query(
      `SELECT full_name, phone, role
       FROM users
       WHERE LOWER(TRIM(role)) IN ('chairperson', 'secretary', 'treasurer')
         AND LOWER(TRIM(account_status)) = 'approved'
         AND deleted_at IS NULL
       ORDER BY CASE LOWER(TRIM(role))
         WHEN 'chairperson' THEN 1
         WHEN 'secretary' THEN 2
         WHEN 'treasurer' THEN 3
       END, full_name`
    ),
  ]);
  return {
    withdrawals: withdrawalsResult.rows,
    officeHolders: officeHoldersResult.rows,
  };
}

async function decideWithdrawal({ requestId, approved, reason, userId }) {
  const reviewer = await query(`SELECT id, full_name, phone, role FROM users WHERE id = $1`, [userId]);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE welfare_withdrawal_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
           review_reason = $3, reviewer_snapshot = $4::jsonb
       WHERE id = $5 AND status = 'pending'
       RETURNING *`,
      [approved ? "approved" : "rejected", userId, reason || null, JSON.stringify(reviewer.rows[0]), requestId]
    );
    if (!result.rowCount) {
      const error = new Error("Pending welfare withdrawal request not found.");
      error.statusCode = 404;
      throw error;
    }
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, new_values)
       VALUES ($1, $2, 'welfare_withdrawal_request', $3, $4::jsonb)`,
      [userId, approved ? "welfare_withdrawal_approved" : "welfare_withdrawal_rejected",
       requestId, JSON.stringify(result.rows[0])]
    );
    await client.query(
      `INSERT INTO notifications (recipient_user_id, event_type, title, message)
       SELECT id, 'welfare_withdrawal_decided', 'Welfare withdrawal request decided', $1
       FROM users WHERE role = 'member' AND account_status = 'approved'
       AND deleted_at IS NULL`,
      [`The collective welfare withdrawal request was ${approved ? "approved" : "rejected"}.`]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function executeWithdrawal({ requestId, userId }) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(284731)");
    const request = await client.query(
      `SELECT * FROM welfare_withdrawal_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );
    if (!request.rowCount || request.rows[0].status !== "approved") {
      const error = new Error("Only an approved welfare withdrawal can be executed.");
      error.statusCode = 409;
      throw error;
    }
    const members = await client.query(
      `SELECT u.id
       FROM users u
       WHERE LOWER(TRIM(u.role)) IN ('member', 'chairperson', 'secretary', 'treasurer')
         AND LOWER(TRIM(u.account_status)) = 'approved'
         AND u.deleted_at IS NULL
       ORDER BY u.id
       FOR UPDATE OF u`
    );
    const memberIds = members.rows.map((member) => member.id);
    const balancesResult = memberIds.length
      ? await client.query(
        `SELECT member_user_id,
                COALESCE(SUM(
                  CASE WHEN entry_type = 'deposit' THEN amount ELSE -amount END
                ), 0)::numeric(12,2) AS balance
         FROM welfare_ledger_entries
         WHERE member_user_id = ANY($1::uuid[])
         GROUP BY member_user_id`,
        [memberIds]
      )
      : { rows: [] };
    const balances = new Map(
      balancesResult.rows.map((row) => [row.member_user_id, row.balance])
    );
    const contributors = members.rows
      .map((member) => ({
        ...member,
        balance: balances.get(member.id) || "0.00",
      }))
      .filter((member) => Number(member.balance) > 0);
    const toCents = (amount) => {
      const [whole, fraction = ""] = String(amount).split(".");
      return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
    };
    const requestedCents = toCents(request.rows[0].requested_amount);
    const totalCents = contributors.reduce(
      (sum, member) => sum + toCents(member.balance),
      0n
    );
    if (requestedCents > totalCents) {
      const error = new Error("Requested amount exceeds the available welfare balance.");
      error.statusCode = 409;
      throw error;
    }

    const allocations = contributors.map((member) => {
      const balanceCents = toCents(member.balance);
      const proportionalCents = requestedCents * balanceCents;
      return {
        ...member,
        balanceCents,
        amountCents: proportionalCents / totalCents,
        remainder: proportionalCents % totalCents,
      };
    });
    let unallocatedCents = requestedCents - allocations.reduce(
      (sum, member) => sum + member.amountCents,
      0n
    );
    allocations
      .slice()
      .sort((left, right) => {
        if (left.remainder === right.remainder) {
          return left.id.localeCompare(right.id);
        }
        return left.remainder > right.remainder ? -1 : 1;
      })
      .forEach((member) => {
        if (unallocatedCents > 0n) {
          member.amountCents += 1n;
          unallocatedCents -= 1n;
        }
      });

    const formatCents = (cents) => {
      const whole = cents / 100n;
      const fraction = String(cents % 100n).padStart(2, "0");
      return `${whole}.${fraction}`;
    };
    for (const member of allocations) {
      if (member.amountCents === 0n) continue;
      const amountCents = member.amountCents;
      const afterCents = member.balanceCents - amountCents;
      await client.query(
        `INSERT INTO welfare_ledger_entries
         (member_user_id, entry_type, amount, balance_before, balance_after,
          welfare_withdrawal_request_id, recorded_by, description)
         VALUES ($1, 'deduction', $2, $3, $4, $5, $6, $7)`,
        [member.id, formatCents(amountCents), formatCents(member.balanceCents), formatCents(afterCents),
         requestId, userId, "Proportional collective welfare withdrawal deduction"]
      );
    }
    await client.query(
      `INSERT INTO welfare_ledger_entries
       (entry_type, amount, balance_before, balance_after, welfare_withdrawal_request_id, recorded_by, description)
       VALUES ('withdrawal', $1, $2, $3, $4, $5, $6)`,
      [formatCents(requestedCents), formatCents(totalCents), formatCents(totalCents - requestedCents),
       requestId, userId, request.rows[0].purpose]
    );
    const updated = await client.query(
      `UPDATE welfare_withdrawal_requests
       SET status = 'executed', executed_by = $1, executed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [userId, requestId]
    );
    await client.query(
      `INSERT INTO notifications (recipient_user_id, event_type, title, message)
       SELECT id, 'welfare_withdrawal_executed', 'Collective welfare withdrawal executed',
              $1 FROM users WHERE role = 'member' AND account_status = 'approved'
              AND deleted_at IS NULL`,
      [`KSh ${formatCents(requestedCents)} was deducted proportionally from contributor welfare balances.`]
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getRequirementHistory,
  listContributions,
  setRequirement,
  recordContribution,
  getStatement,
  getGroupBalance,
  requestWithdrawal,
  listWithdrawals,
  decideWithdrawal,
  executeWithdrawal,
  getWithdrawalExportData,
};
