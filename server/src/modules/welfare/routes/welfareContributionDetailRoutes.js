const express = require("express");
const { query, pool } = require("../../../config/database");
const { requireAuth, requireRole } = require("../../../shared/middleware/auth");


const router = express.Router();
const MEMBER_REVERSAL_WINDOW_MINUTES = 15;

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

  await client.query(
    `INSERT INTO notifications (
       recipient_user_id, transaction_id, event_type, title, message
     )
     SELECT id, $1, 'transaction_updated',
            'Contribution reversal completed',
            'A contribution reversal was approved and completed.'
     FROM users
     WHERE role = 'member'
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

router.get(
  "/:id",
  requireAuth,
  requireRole("member", "treasurer", "chairperson", "secretary"),
  async (req, res, next) => {
  const { id } = req.params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction ID.",
    });
  }

  try {
    const result = await query(
      `SELECT
         id,
         member_user_id,
         entered_member_name,
         amount,
         paid_at,
         mpesa_reference,
         notes,
         status,
         created_by,
         updated_by,
         created_at,
         updated_at
       FROM transactions
       WHERE id = $1
         AND (
           $2 IN ('treasurer', 'chairperson')
           OR member_user_id = $3
         )`,
      [id, req.session.user.role, req.session.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
        }
      );
    }

    return res.status(200).json({
      success: true,
      transaction: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});


router.get(
  "/summary/overview",
  requireAuth,
  requireRole("member", "treasurer", "chairperson", "secretary"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
           COALESCE(
             SUM(amount) FILTER (WHERE status = 'active'),
             0
           )::numeric(12, 2) AS active_total,
           COUNT(*) FILTER (WHERE status = 'reversed')::int AS reversed_count,
           COALESCE(
             SUM(amount) FILTER (WHERE status = 'reversed'),
             0
           )::numeric(12, 2) AS reversed_total
         FROM transactions
         WHERE (
           $1 IN ('treasurer', 'chairperson')
           OR member_user_id = $2
         )`,
        [req.session.user.role, req.session.user.id]
      );

      return res.status(200).json({
        success: true,
        summary: {
          activeCount: result.rows[0].active_count,
          activeTotal: result.rows[0].active_total,
          reversedCount: result.rows[0].reversed_count,
          reversedTotal: result.rows[0].reversed_total,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
