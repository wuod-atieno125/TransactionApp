
const express = require("express");
const { query, pool } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const memberRepository = require("../members/memberRepository");

const router = express.Router();

// Require an approved, authenticated chairperson for every admin endpoint.
router.use(requireAuth, requireRole("chairperson"));

// GET /api/admin/pending-members
router.get("/pending-members", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, full_name, phone, recovery_email, created_at
       FROM users
       WHERE account_status = 'pending'
         AND deleted_at IS NULL
       ORDER BY created_at ASC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      members: result.rows.map((user) => ({
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        recoveryEmail: user.recovery_email,
        registeredAt: user.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});


async function decideMember(req, res, next, decision) {
  const { id } = req.params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid member ID.",
    });
  }

  const nextStatus =
  decision === "approved" ? "approved" : "rejected";

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const memberResult = await client.query(
      `SELECT id, full_name, role, account_status
       FROM users
       WHERE id = $1
         AND account_status = 'pending'
         AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );

    if (memberResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Pending member account not found.",
      });
    }

    const oldMember = memberResult.rows[0];

    const updatedResult = await client.query(
      `UPDATE users
       SET account_status = $1,
           updated_at = NOW()
       WHERE id = $2
         AND account_status = 'pending'
       RETURNING id, full_name, phone, recovery_email,
                 role, account_status, created_at, updated_at`,
      [nextStatus, id]
    );

    if (updatedResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "The member's status has already changed.",
      });
    }

    const updatedMember = updatedResult.rows[0];

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
        req.session.user.id,
        `member_${nextStatus}`,
        "user",
        updatedMember.id,
        JSON.stringify({
          account_status: oldMember.account_status,
        }),
        JSON.stringify({
          account_status: updatedMember.account_status,
        }),
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message:
        nextStatus === "approved"
          ? "Member approved successfully."
          : "Member rejected successfully.",
      member: updatedMember,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// PATCH /api/admin/members/:id/approve
router.patch("/members/:id/approve", (req, res, next) =>
  decideMember(req, res, next, "approved")
);

// PATCH /api/admin/members/:id/reject
router.patch("/members/:id/reject", (req, res, next) =>
  decideMember(req, res, next, "rejected")
);

// GET /api/admin/member-deletion-requests
router.get("/member-deletion-requests", async (req, res, next) => {
  try {
    const deletionRequests = await memberRepository.listPendingAccountDeletions();
    return res.status(200).json({
      success: true,
      count: deletionRequests.length,
      deletionRequests,
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/admin/member-deletion-requests/:id
router.patch("/member-deletion-requests/:id", async (req, res, next) => {
  const { id } = req.params;
  const { decision } = req.body || {};
  const reason = typeof req.body?.reason === "string"
    ? req.body.reason.trim()
    : "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid deletion request ID.",
    });
  }

  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be approved or rejected.",
    });
  }

  if (reason.length < 5 || reason.length > 1000) {
    return res.status(400).json({
      success: false,
      message: "Provide a decision reason between 5 and 1000 characters.",
    });
  }

  try {
    const result = await memberRepository.decideAccountDeletion(
      id,
      req.user.id,
      decision,
      reason
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Pending member deletion request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: decision === "approved"
        ? "Member account deleted. Existing transaction records were retained."
        : "Member deletion request declined.",
      deletionRequest: result,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/admin/members/:id
router.delete("/members/:id", async (req, res, next) => {
  const { id } = req.params;
  const reason = typeof req.body?.reason === "string"
    ? req.body.reason.trim()
    : "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid member ID.",
    });
  }

  if (reason.length < 5 || reason.length > 1000) {
    return res.status(400).json({
      success: false,
      message: "Provide a deletion reason between 5 and 1000 characters.",
    });
  }

  try {
    const result = await memberRepository.deleteMemberAccount(
      id,
      req.user.id,
      reason
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Active member account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member account deleted. Other active members have been notified; transaction records were retained.",
      member: result,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/admin/audit-logs?limit=50&offset=0&action=transaction_created
router.get(
  "/audit-logs",
  requireRole("chairperson"),
  async (req, res, next) => {
    try {
      const parsedLimit = Number.parseInt(req.query.limit, 10);
      const limit = Number.isInteger(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 100)
        : 50;

      const parsedOffset = Number.parseInt(req.query.offset, 10);
      const offset = Number.isInteger(parsedOffset)
        ? Math.max(parsedOffset, 0)
        : 0;

      const { action } = req.query;

      if (
        action !== undefined &&
        (
          typeof action !== "string" ||
          action.trim().length === 0 ||
          action.length > 100
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid action filter.",
        });
      }

      const values = [];
      let whereClause = "";

      if (action !== undefined) {
        values.push(action.trim());
        whereClause = `WHERE al.action = $${values.length}`;
      }

      values.push(limit);
      const limitPlaceholder = `$${values.length}`;

      values.push(offset);
      const offsetPlaceholder = `$${values.length}`;

      const result = await query(
        `SELECT
           al.id,
           al.actor_user_id AS "actorUserId",
           u.full_name AS "actorName",
           u.role AS "actorRole",
           al.action,
           al.target_type AS "targetType",
           al.target_id AS "targetId",
           al.old_values AS "oldValues",
           al.new_values AS "newValues",
           al.created_at AS "createdAt"
         FROM audit_logs al
         LEFT JOIN users u
           ON u.id = al.actor_user_id
         ${whereClause}
         ORDER BY al.created_at DESC, al.id DESC
         LIMIT ${limitPlaceholder}
         OFFSET ${offsetPlaceholder}`,
        values
      );

      return res.status(200).json({
        success: true,
        auditLogs: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);
module.exports = router;
