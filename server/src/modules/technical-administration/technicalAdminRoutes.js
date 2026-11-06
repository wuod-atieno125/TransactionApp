

"use strict";

const express = require("express");
const { pool, query } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ASSIGNABLE_ROLES = [
  "member",
  "treasurer",
  "chairperson",
  "secretary",
];
const MINIMUM_OFFICE_HOLDERS = {
  chairperson: 1,
};
const MAX_TREASURERS = 2;
const ANNOUNCEMENT_ROLES = [
  "chairperson",
  "secretary",
  "treasurer",
  "member",
];

router.use(requireAuth, requireRole("technical_admin"));

// GET /api/technical-admin/audit-logs
router.get("/audit-logs", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT audit.id,
              audit.action,
              audit.target_type AS "targetType",
              target.full_name AS "targetName",
              audit.created_at AS "createdAt",
              actor.full_name AS "actorName",
              actor.role AS "actorRole"
       FROM audit_logs audit
       LEFT JOIN users actor ON actor.id = audit.actor_user_id
       LEFT JOIN users target
         ON audit.target_type = 'user'
        AND target.id = audit.target_id
       WHERE actor.role = 'technical_admin'
          OR audit.action IN (
            'user_role_changed',
            'official_role_removal_approved',
            'official_role_removal_rejected',
            'app_update_announcement_sent'
          )
       ORDER BY audit.created_at DESC, audit.id DESC
       LIMIT 50`
    );

    return res.status(200).json({
      success: true,
      auditLogs: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/audit-logs", async (req, res, next) => {
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const deleted = await client.query("DELETE FROM audit_logs");

    const notifications = await client.query(
      `INSERT INTO notifications (
         recipient_user_id, event_type, title, message
       )
       SELECT id, 'audit_logs_cleared', 'Audit logs cleared',
              'The Technical Administrator cleared the audit logs.'
       FROM users
       WHERE role = ANY($1::text[])
         AND account_status = 'approved'
         AND deleted_at IS NULL`,
      [ANNOUNCEMENT_ROLES]
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, new_values
       )
       VALUES ($1, 'audit_logs_cleared', 'audit_logs', $2::jsonb)`,
      [
        req.user.id,
        JSON.stringify({ deleted_count: deleted.rowCount }),
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Audit logs cleared. Active approved members were notified.",
      deletedCount: deleted.rowCount,
      notifiedCount: notifications.rowCount,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("Audit log deletion rollback failed:", rollbackError);
      });
    }

    return next(error);
  } finally {
    if (client) client.release();
  }
});

router.get("/role-removal-requests", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT request.id, request.requester_user_id AS "requesterUserId",
              request.office_role AS "officeRole", request.reason,
              request.requested_at AS "requestedAt",
              requester.full_name AS "requesterName"
       FROM official_role_removal_requests request
       JOIN users requester ON requester.id = request.requester_user_id
       WHERE request.status = 'pending'
         AND requester.role = request.office_role
         AND requester.account_status = 'approved'
         AND requester.deleted_at IS NULL
       ORDER BY request.requested_at ASC`
    );

    return res.status(200).json({
      success: true,
      requests: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/role-removal-requests/:id", async (req, res, next) => {
  const { id } = req.params;
  const decision = req.body?.decision;

  if (!UUID_REGEX.test(id) || !["approved", "rejected"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid request ID and an approved or rejected decision.",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT request.id, request.requester_user_id,
              request.office_role, request.reason,
              requester.full_name, requester.role AS current_role
       FROM official_role_removal_requests request
       JOIN users requester ON requester.id = request.requester_user_id
       WHERE request.id = $1
         AND request.status = 'pending'
         AND requester.account_status = 'approved'
         AND requester.deleted_at IS NULL
       FOR UPDATE OF request, requester`,
      [id]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Pending role-removal request not found.",
      });
    }

    const request = requestResult.rows[0];
    if (request.current_role !== request.office_role) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "The official's role changed before this request was reviewed.",
      });
    }

    if (decision === "approved" && request.office_role === "chairperson") {
      const otherChairperson = await client.query(
        `SELECT 1
         FROM users
         WHERE role = 'chairperson'
           AND id <> $1
           AND account_status = 'approved'
           AND deleted_at IS NULL
         LIMIT 1`,
        [request.requester_user_id]
      );

      if (otherChairperson.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Assign another chairperson before approving this role-removal request.",
        });
      }
    }

    if (decision === "approved") {
      await client.query(
        `UPDATE users
         SET role = 'member', updated_at = NOW()
         WHERE id = $1`,
        [request.requester_user_id]
      );
    }

    await client.query(
      `UPDATE official_role_removal_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [decision, req.user.id, request.id]
    );

    if (decision === "approved") {
      await client.query(
        `INSERT INTO notifications (
           recipient_user_id, event_type, title, message
         )
         SELECT id, 'user_role_changed', 'Member role changed', $2
         FROM users
         WHERE account_status = 'approved'
           AND deleted_at IS NULL
           AND (role = 'member' OR id = $1)`,
        [
          request.requester_user_id,
          `${request.full_name} stepped down from ${request.office_role} and is now a member.`,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO notifications (
           recipient_user_id, event_type, title, message
         )
         VALUES ($1, 'transaction_updated', 'Role-removal request declined', $2)`,
        [
          request.requester_user_id,
          `Your request to step down as ${request.office_role} was declined. Contact the Technical Admin for more information.`,
        ]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, target_id, old_values, new_values
       )
       VALUES ($1, $2, 'official_role_removal_request', $3, $4::jsonb, $5::jsonb)`,
      [
        req.user.id,
        `official_role_removal_${decision}`,
        request.id,
        JSON.stringify({
          requester_user_id: request.requester_user_id,
          office_role: request.office_role,
          reason: request.reason,
          status: "pending",
        }),
        JSON.stringify({
          status: decision,
          new_role: decision === "approved" ? "member" : request.office_role,
        }),
      ]
    );

    await client.query("COMMIT");
    return res.status(200).json({
      success: true,
      message: decision === "approved"
        ? "Role-removal request approved. The member was notified of the role change."
        : "Role-removal request declined.",
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("Role-removal decision rollback failed:", rollbackError);
      });
    }
    return next(error);
  } finally {
    if (client) client.release();
  }
});

// POST /api/technical-admin/announcements
router.post("/announcements", async (req, res, next) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (title.length < 3 || title.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Announcement title must be between 3 and 200 characters.",
    });
  }

  if (message.length < 5 || message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Announcement message must be between 5 and 2000 characters.",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const notificationResult = await client.query(
      `INSERT INTO notifications (
         recipient_user_id, event_type, title, message
       )
       SELECT id, 'app_update_announcement', $1, $2
       FROM users
       WHERE role = ANY($3::text[])
         AND account_status = 'approved'
         AND deleted_at IS NULL`,
      [title, message, ANNOUNCEMENT_ROLES]
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, new_values
       )
       VALUES ($1, 'app_update_announcement_sent', 'notification', $2::jsonb)`,
      [
        req.user.id,
        JSON.stringify({
          title,
          message,
          recipient_roles: ANNOUNCEMENT_ROLES,
          recipient_count: notificationResult.rowCount,
        }),
      ]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: "App update announcement sent.",
      recipientCount: notificationResult.rowCount,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("App update announcement rollback failed:", rollbackError);
      });
    }
    return next(error);
  } finally {
    if (client) client.release();
  }
});

// GET /api/technical-admin/users
router.get("/users", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, full_name, phone, recovery_email,
              role, account_status, created_at
       FROM users
       WHERE account_status = 'approved'
         AND deleted_at IS NULL
       ORDER BY full_name ASC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      users: result.rows.map((user) => ({
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        recoveryEmail: user.recovery_email,
        role: user.role,
        accountStatus: user.account_status,
        createdAt: user.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/technical-admin/users/:id/role
router.patch("/users/:id/role", async (req, res, next) => {
  const { id } = req.params;
  const body = req.body;

  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID.",
    });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, "role")
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide only the role field.",
    });
  }

  if (
    typeof body.role !== "string" ||
    !ASSIGNABLE_ROLES.includes(body.role)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Role must be member, treasurer, chairperson, or secretary.",
    });
  }

  const actorId = req.user.id;

  if (id === actorId) {
    return res.status(403).json({
      success: false,
      message: "You cannot change your own role.",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Serialize role changes so concurrent updates cannot bypass staffing rules.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      ["gcms_technical_admin_role_assignment"]
    );

    const targetResult = await client.query(
      `SELECT id, full_name, role, account_status
       FROM users
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );

    if (targetResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const target = targetResult.rows[0];

    if (target.account_status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Only approved accounts can be assigned roles.",
      });
    }

    if (target.role === "technical_admin") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message:
          "Technical Administrator accounts cannot be changed through routine role assignment.",
      });
    }

    if (target.role === body.role) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        success: true,
        message: "The user already has this role.",
        user: {
          id: target.id,
          fullName: target.full_name,
          role: target.role,
        },
      });
    }

    if (body.role === "treasurer") {
      const treasurerCountResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE role = 'treasurer'
           AND account_status = 'approved'
           AND deleted_at IS NULL`
      );

      if (treasurerCountResult.rows[0].count >= MAX_TREASURERS) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message:
            "A group can have no more than two approved treasurers. Change an existing treasurer's role before assigning this role.",
        });
      }
    }

    const minimumForCurrentRole = MINIMUM_OFFICE_HOLDERS[target.role];
    if (minimumForCurrentRole && body.role !== target.role) {
      const roleCountResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE role = $1
           AND account_status = 'approved'
           AND deleted_at IS NULL`,
        [target.role]
      );

      const currentCount = roleCountResult.rows[0].count;
      if (currentCount <= minimumForCurrentRole) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: `At least ${minimumForCurrentRole} approved ${target.role} account${minimumForCurrentRole === 1 ? "" : "s"} must remain. Assign another ${target.role} before changing this role.`,
        });
      }
    }

    const updatedResult = await client.query(
      `UPDATE users
       SET role = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, full_name, role, account_status`,
      [body.role, id]
    );

    const updated = updatedResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         old_values,
         new_values
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        actorId,
        "user_role_changed",
        "user",
        updated.id,
        JSON.stringify({ role: target.role }),
        JSON.stringify({ role: updated.role }),
      ]
    );

    await client.query(
      `INSERT INTO notifications (
         recipient_user_id, event_type, title, message
       )
       SELECT id, 'user_role_changed', 'Member role changed', $2
       FROM users
       WHERE account_status = 'approved'
         AND deleted_at IS NULL
         AND (role = 'member' OR id = $1)`,
      [
        updated.id,
        `${updated.full_name}'s role was changed from ${target.role} to ${updated.role} by a Technical Administrator.`,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "User role updated successfully. The account holder was notified.",
      user: {
        id: updated.id,
        fullName: updated.full_name,
        role: updated.role,
        accountStatus: updated.account_status,
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return next(error);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
