const express = require("express");
const { query, pool } = require("../../../config/database");
const { requireAuth, requireRole } = require("../../../shared/middleware/auth");


const router = express.Router();
function getPagination(queryParams) {
  const parseIntegerParam = (value) => {
    if (value === undefined || value === "") {
      return null;
    }

    if (
      typeof value !== "string" ||
      !/^\d+$/.test(value)
    ) {
      return NaN;
    }

    const parsed = Number(value);

    return Number.isSafeInteger(parsed) ? parsed : NaN;
  };

  const parsedLimit = parseIntegerParam(queryParams.limit);
  const parsedOffset = parseIntegerParam(queryParams.offset);

  if (
    Number.isNaN(parsedLimit) ||
    Number.isNaN(parsedOffset) ||
    (parsedLimit !== null && parsedLimit < 1) ||
    (parsedOffset !== null && parsedOffset < 0)
  ) {
    return { error: "Invalid pagination parameters." };
  }

  return {
    limit: parsedLimit === null ? 50 : Math.min(parsedLimit, 100),
    offset: parsedOffset === null ? 0 : parsedOffset,
  };
}
function isValidDateRange(startDate, endDate, maxDays = 366) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !datePattern.test(startDate) ||
    !datePattern.test(endDate)
  ) {
    return false;
  }

  function toUtcDay(value) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return Math.floor(date.getTime() / 86400000);
  }

  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);

  return (
    start !== null &&
    end !== null &&
    end >= start &&
    end - start < maxDays
  );
}

async function reverseTransaction(client, {
  transaction,
  actorUserId,
  reason,
  approvalRequestId = null,
  excludedMemberUserId = null,
}) {
  const result = await client.query(
    `UPDATE transactions
     SET status = 'reversed',
         updated_by = $1,
         updated_at = NOW()
     WHERE id = $2
       AND status = 'active'
     RETURNING *`,
    [actorUserId, transaction.id]
  );
  const reversedTransaction = result.rows[0];

  if (!reversedTransaction) {
    const error = new Error("Active transaction not found.");
    error.statusCode = 404;
    throw error;
  }

  await client.query(
    `INSERT INTO audit_logs (
       actor_user_id, action, target_type, target_id,
       old_values, new_values
     )
     VALUES ($1, 'transaction_reversed', 'transaction', $2, $3::jsonb, $4::jsonb)`,
    [
      actorUserId,
      transaction.id,
      JSON.stringify(transaction),
      JSON.stringify({
        ...reversedTransaction,
        reversal_reason: reason,
        reversal_approval_request_id: approvalRequestId,
      }),
    ]
  );

  if (reversedTransaction.member_user_id) {
    const sourceEntry = await client.query(
      `SELECT id
       FROM welfare_ledger_entries
       WHERE source_transaction_id = $1
         AND entry_type = 'deposit'
       FOR UPDATE`,
      [reversedTransaction.id]
    );

    if (sourceEntry.rowCount) {
      await client.query("SELECT pg_advisory_xact_lock(284731)");
      const balanceResult = await client.query(
        `SELECT COALESCE(SUM(
           CASE WHEN entry_type = 'deposit' THEN amount ELSE -amount END
         ), 0)::numeric(12,2) AS balance
         FROM welfare_ledger_entries
         WHERE member_user_id = $1`,
        [reversedTransaction.member_user_id]
      );
      const balanceBefore = Number(balanceResult.rows[0].balance);
      const balanceAfter = (balanceBefore - Number(reversedTransaction.amount)).toFixed(2);
      if (Number(balanceAfter) < 0) {
        const error = new Error("The welfare ledger balance cannot cover this reversal.");
        error.statusCode = 409;
        throw error;
      }

      await client.query(
        `INSERT INTO welfare_ledger_entries (
           member_user_id, entry_type, amount, balance_before, balance_after,
           recorded_by, description, source_payment_reference
         )
         VALUES ($1, 'reversal', $2, $3, $4, $5, $6, $7)`,
        [
          reversedTransaction.member_user_id,
          reversedTransaction.amount,
          balanceBefore.toFixed(2),
          balanceAfter,
          actorUserId,
          `Reversal of welfare contribution: ${reason}`,
          reversedTransaction.mpesa_reference,
        ]
      );
    }
  }

  await client.query(
    `INSERT INTO notifications (
       recipient_user_id, transaction_id, event_type, title, message
     )
     SELECT id, $1, 'transaction_updated',
            'Contribution reversal completed',
            'A contribution reversal was approved and completed.'
     FROM users
     WHERE LOWER(TRIM(role)) IN ('member', 'chairperson', 'secretary', 'treasurer')
       AND account_status = 'approved'
       AND deleted_at IS NULL
       AND ($2::uuid IS NULL OR id <> $2)`,
    [
      transaction.id,
      excludedMemberUserId,
    ]
  );

  return reversedTransaction;
}

// PATCH /api/transactions/:id/reverse
router.patch(
  "/:id/reverse",
  requireAuth,
  requireRole("member", "chairperson", "secretary", "treasurer"),
  async (req, res, next) => {
    const { id } = req.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID.",
      });
    }
    let client;
    try {
      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason.trim()
          : "";

      if (reason.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "A reversal reason cannot exceed 1000 characters.",
        });
      }

      client = await pool.connect();
      await client.query("BEGIN");

      const role = String(req.session.user.role || "").toLowerCase();
      const contributorRequestRole = ["member", "chairperson", "secretary"].includes(role);
      const existingResult = await client.query(
        `SELECT *,
                created_at >= NOW() - INTERVAL '12 hours'
                  AS reversal_allowed
         FROM transactions
         WHERE id = $1
           AND status = 'active'
           AND (NOT $2::boolean OR member_user_id = $3)
         FOR UPDATE`,
        [id, contributorRequestRole, req.session.user.id]
      );

      if (existingResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Active transaction not found.",
        });
      }

      const oldTransaction = existingResult.rows[0];

      if (!oldTransaction.reversal_allowed) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Transaction reversal requests are only allowed within 12 hours of the transaction being recorded.",
        });
      }

      if (
        (contributorRequestRole || role === "treasurer") &&
        reason.length < 5
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Enter a reason of at least 5 characters.",
        });
      }

      if (contributorRequestRole) {
        const requestResult = await client.query(
          `INSERT INTO transaction_reversal_requests (
             transaction_id, requested_by, reason, status
           )
           VALUES ($1, $2, $3, 'pending_treasurer')
           ON CONFLICT (transaction_id)
             WHERE status IN ('pending_treasurer', 'pending_chairperson')
           DO NOTHING
           RETURNING id`,
          [id, req.session.user.id, reason]
        );

        if (requestResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            success: false,
            message: "A reversal request is already under review for this transaction.",
          });
        }

        const requestId = requestResult.rows[0].id;
        await client.query(
          `INSERT INTO audit_logs (
             actor_user_id, action, target_type, target_id, new_values
           )
           VALUES ($1, 'transaction_reversal_requested', 'transaction', $2, $3::jsonb)`,
          [
            req.session.user.id,
            id,
            JSON.stringify({ request_id: requestId, reason, status: "pending_treasurer" }),
          ]
        );

        await client.query(
          `INSERT INTO notifications (
             recipient_user_id, transaction_id, event_type, title, message
           )
           SELECT id, $1, 'transaction_reversal_requested',
                  'Contributor reversal request needs review', $2
           FROM users
           WHERE role = 'treasurer'
             AND account_status = 'approved'
             AND deleted_at IS NULL`,
          [
            id,
            `A contributor requested reversal of a contribution. Reason: ${reason}`,
          ]
        );

        await client.query("COMMIT");
        return res.status(202).json({
          success: true,
          approvalRequired: true,
          message: "Reversal request submitted to the treasurer for review.",
          requestId,
        });
      }

      if (role === "treasurer") {
        const requestResult = await client.query(
          `INSERT INTO transaction_reversal_requests (
             transaction_id, requested_by, reason, status
           )
           VALUES ($1, $2, $3, 'pending_chairperson')
           ON CONFLICT (transaction_id)
             WHERE status IN ('pending_treasurer', 'pending_chairperson')
           DO NOTHING
           RETURNING id`,
          [id, req.session.user.id, reason]
        );

        if (requestResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            success: false,
            message: "A reversal approval request is already pending for this transaction.",
          });
        }

        const requestId = requestResult.rows[0].id;
        await client.query(
          `INSERT INTO audit_logs (
             actor_user_id, action, target_type, target_id, new_values
           )
           VALUES ($1, 'transaction_reversal_requested', 'transaction', $2, $3::jsonb)`,
          [
            req.session.user.id,
            id,
            JSON.stringify({
              request_id: requestId,
              reason,
              status: "pending_chairperson",
            }),
          ]
        );

        await client.query(
          `INSERT INTO notifications (
             recipient_user_id, transaction_id, event_type, title, message
           )
           SELECT id, $1, 'transaction_reversal_requested',
                  'Transaction reversal approval needed', $2
           FROM users
           WHERE role = 'chairperson'
             AND account_status = 'approved'
             AND deleted_at IS NULL`,
          [
            id,
            `The treasurer requested approval to reverse a transaction. Reason: ${reason}`,
          ]
        );

        await client.query("COMMIT");
        return res.status(202).json({
          success: true,
          approvalRequired: true,
          message: "Your reversal approval request was sent to the chairperson.",
          requestId,
        });
      }

      const reversedTransaction = await reverseTransaction(client, {
        transaction: oldTransaction,
        actorUserId: req.session.user.id,
        reason,
      });

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Transaction reversed successfully.",
        transaction: reversedTransaction,
      });
    } catch (error) {

      if (client) {
        await client.query("ROLLBACK").catch((rollbackError) => {
          console.error("Transaction reversal rollback failed:", rollbackError);
        });
      }

      return next(error);
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.get(
  "/reversal-requests",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const role = String(req.session.user.role || "").toLowerCase();
      const requestStatus = role === "treasurer"
        ? "pending_treasurer"
        : "pending_chairperson";
      const result = await query(
        `SELECT
           request.id,
           request.transaction_id,
           request.reason,
           request.created_at,
           requester.full_name AS requested_by_name,
           requester.role AS requester_role,
           t.entered_member_name,
           t.amount,
           t.mpesa_reference,
           t.paid_at,
           t.created_at >= NOW() - INTERVAL '12 hours' AS reversal_allowed
         FROM transaction_reversal_requests request
         JOIN users requester ON requester.id = request.requested_by
         JOIN transactions t ON t.id = request.transaction_id
         WHERE request.status = $1
           AND t.status = 'active'
         ORDER BY request.created_at ASC`
        ,
       [requestStatus]
      );

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        requests: result.rows,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/reversal-requests/:id",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    const { id } = req.params;
    const decision = req.body?.decision;
    const decisionReason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const role = String(req.session.user.role || "").toLowerCase();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      !["approved", "rejected"].includes(decision)
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid request ID and an approved or rejected decision.",
      });
    }
    if (
      role === "chairperson" &&
      (decisionReason.length < 5 || decisionReason.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a response reason of at least 5 characters and no more than 1000 characters.",
      });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const expectedStatus = role === "treasurer"
        ? "pending_treasurer"
        : "pending_chairperson";
      const requestResult = await client.query(
        `SELECT request.id AS reversal_request_id,
                request.reason AS reversal_reason,
                request.requested_by,
                requester.role AS requester_role,
                request.treasurer_reviewed_by,
                request.transaction_id,
                t.*,
                t.created_at >= NOW() - INTERVAL '12 hours' AS reversal_allowed
         FROM transaction_reversal_requests request
         JOIN users requester ON requester.id = request.requested_by
         JOIN transactions t ON t.id = request.transaction_id
         WHERE request.id = $1
           AND request.status = $2
           AND t.status = 'active'
         FOR UPDATE OF request, t`,
        [id, expectedStatus]
      );

      if (requestResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Pending reversal request not found.",
        });
      }

      const request = requestResult.rows[0];
      if (!request.reversal_allowed) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Transaction reversal approvals are only allowed within 12 hours of the transaction being recorded.",
        });
      }

      let reversedTransaction = null;
      if (decision === "approved") {
        if (role === "treasurer" && ["member", "secretary"].includes(request.requester_role)) {
          await client.query(
            `UPDATE transaction_reversal_requests
             SET status = 'pending_chairperson',
                 treasurer_reviewed_by = $1,
                 treasurer_reviewed_at = NOW()
             WHERE id = $2`,
            [req.session.user.id, request.reversal_request_id]
          );

          await client.query(
            `INSERT INTO notifications (
               recipient_user_id, transaction_id, event_type, title, message
             )
             SELECT id, $1, 'transaction_reversal_requested',
                    'Transaction reversal approval needed',
                    'The treasurer reviewed and forwarded a contributor reversal request to you. Reason: ' || $2
             FROM users
             WHERE LOWER(TRIM(role)) = 'chairperson'
               AND account_status = 'approved'
               AND deleted_at IS NULL`,
            [request.transaction_id, request.reversal_reason]
          );

          await client.query(
            `INSERT INTO notifications (
               recipient_user_id, transaction_id, event_type, title, message
             )
             SELECT id, $1, 'transaction_reversal_requested',
                    'Reversal request under review',
                    'The treasurer reviewed your reversal request and forwarded it to the chairperson. It is now under review.'
             FROM users
             WHERE id = $2
               AND role = $3
               AND account_status = 'approved'
               AND deleted_at IS NULL`,
            [request.transaction_id, request.requested_by, request.requester_role]
          );
        } else {
          reversedTransaction = await reverseTransaction(client, {
            transaction: request,
            actorUserId: req.session.user.id,
            reason: request.reversal_reason,
            approvalRequestId: request.reversal_request_id,
            excludedMemberUserId: role === "chairperson"
              ? request.member_user_id
              : null,
          });
        }
      }

      if (role === "chairperson" || decision === "rejected" ||
          (role === "treasurer" && decision === "approved" &&
            request.requester_role === "chairperson")) {
        await client.query(
          `UPDATE transaction_reversal_requests
           SET status = $1,
               reviewed_by = $2,
               reviewed_at = NOW()
           WHERE id = $3`,
          [decision, req.session.user.id, request.reversal_request_id]
        );
      }

      if (role === "chairperson") {
        await client.query(
          `INSERT INTO notifications (
             recipient_user_id, transaction_id, event_type, title, message
           )
           SELECT DISTINCT recipients.recipient_user_id,
                  $1::uuid,
                  'transaction_updated',
                  'Reversal request ' || $2,
                  'The chairperson ' || $2 || ' the reversal request. Request reason: ' || $7 ||
                    '. Chairperson response: ' || $3
           FROM (
             VALUES
               ($4::uuid),
               ($5::uuid),
               ($6::uuid)
           ) AS recipients(recipient_user_id)
           WHERE recipients.recipient_user_id IS NOT NULL`,
          [
            request.transaction_id,
            decision,
            decisionReason,
            request.requested_by,
            request.treasurer_reviewed_by,
            request.member_user_id,
            request.reversal_reason,
          ]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (
           actor_user_id, action, target_type, target_id, old_values, new_values
         )
         VALUES ($1, $2, 'transaction_reversal_request', $3, $4::jsonb, $5::jsonb)`,
        [
          req.session.user.id,
          `transaction_reversal_request_${role}_${decision}`,
          request.reversal_request_id,
          JSON.stringify({
            transaction_id: request.transaction_id,
            reason: request.reversal_reason,
            status: expectedStatus,
          }),
          JSON.stringify({
            status: role === "treasurer" && decision === "approved" && ["member", "secretary"].includes(request.requester_role)
              ? "pending_chairperson"
              : decision,
            ...(role === "chairperson" ? { response_reason: decisionReason } : {}),
          }),
        ]
      );

      await client.query("COMMIT");
      return res.status(200).json({
        success: true,
        message: decision === "rejected"
          ? "Reversal request declined."
          : role === "treasurer" && ["member", "secretary"].includes(request.requester_role)
            ? "Request approved and forwarded to the chairperson for final approval."
            : "Reversal approved and the transaction has been reversed.",
        transaction: reversedTransaction,
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch((rollbackError) => {
          console.error("Reversal approval rollback failed:", rollbackError);
        });
      }
      return next(error);
    } finally {
      if (client) client.release();
    }
  }
);
/* GET /api/transactions/notifications */
router.get(
  "/notifications",
  requireAuth,
  async (req, res, next) => {
    try {
      const pagination = getPagination(req.query);

      if (pagination.error) {
        return res.status(400).json({
          success: false,
          message: pagination.error,
        });
      }

      const { limit, offset } = pagination;

      const result = await query(
        `SELECT
           id,
           transaction_id,
           event_type,
           title,
           message,
           created_at,
           read_at,
           (read_at IS NULL) AS unread
         FROM notifications
         WHERE recipient_user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.session.user.id, limit, offset]
      );

      return res.status(200).json({
        success: true,
        notifications: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* PATCH /api/transactions/notifications/:id/read */
router.patch(
  "/notifications/:id/read",
  requireAuth,
  async (req, res, next) => {
    const { id } = req.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    try {
      const result = await query(
        `UPDATE notifications
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1
           AND recipient_user_id = $2
         RETURNING id, title, read_at`,
        [id, req.session.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Notification marked as read.",
        notification: result.rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }
);
module.exports = router;
