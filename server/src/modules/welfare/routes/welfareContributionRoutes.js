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
// GET /api/transactions

router.get(
  "/",
  requireAuth,
  requireRole("member", "treasurer", "chairperson", "secretary"),
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

      const role = String(req.session.user.role || "").toLowerCase();

      let result;

      if (role === "member" || role === "secretary") {
        result = await query(
          `SELECT transactions.id, transactions.member_user_id,
                  transactions.entered_member_name, transactions.amount,
                  transactions.paid_at, transactions.mpesa_reference,
                  transactions.status, transactions.notes,
                  transactions.created_at, transactions.updated_at,
                  reversal_request.status AS reversal_request_status,
                  reversal_request.reviewed_at AS reversal_reviewed_at,
                  transactions.created_at >= NOW() - INTERVAL '12 hours'
                    AS reversal_allowed
           FROM transactions
           LEFT JOIN LATERAL (
             SELECT status, reviewed_at
             FROM transaction_reversal_requests
             WHERE transaction_id = transactions.id
             ORDER BY created_at DESC
             LIMIT 1
           ) reversal_request ON TRUE
           WHERE transactions.member_user_id = $1
             AND (
               transactions.status = 'active'
               OR reversal_request.status = 'approved'
             )
           ORDER BY transactions.paid_at DESC
           LIMIT $2 OFFSET $3`,
          [req.session.user.id, limit, offset]
        );
      } else {
        result = await query(
          `SELECT transactions.id, transactions.member_user_id,
                  transactions.entered_member_name, transactions.amount,
                  transactions.paid_at, transactions.mpesa_reference,
                  transactions.status, transactions.notes,
                  transactions.created_at, transactions.updated_at,
                  reversal_request.status AS reversal_request_status,
                  reversal_request.reviewed_at AS reversal_reviewed_at,
                  transactions.created_at >= NOW() - INTERVAL '12 hours'
                    AS reversal_allowed
           FROM transactions
           LEFT JOIN LATERAL (
             SELECT status, reviewed_at
             FROM transaction_reversal_requests
             WHERE transaction_id = transactions.id
             ORDER BY created_at DESC
             LIMIT 1
           ) reversal_request ON TRUE
           WHERE transactions.status IN ('active', 'reversed')
           ORDER BY transactions.paid_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
      }

      return res.status(200).json({
        success: true,
        transactions: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/transactions
router.post(
  "/",
  requireAuth,
  requireRole("treasurer"),
  async (req, res, next) => {
    const {
      memberUserId,
      enteredMemberName,
      amount,
      paidAt,
      mpesaReference,
      notes,
    } = req.body;

    const name =
    typeof enteredMemberName === "string"
      ? enteredMemberName.trim()
      : "";
    const parsedAmount = Number(amount);


    if (!name || name.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Member name is required and must not exceed 150 characters.",
      });
    }

    if (
      amount === undefined ||
  amount === null ||
  amount === "" ||
  !Number.isFinite(parsedAmount) ||
  parsedAmount <= 0 ||
  parsedAmount > 9999999999.99 ||
  Math.round(parsedAmount * 100) !== parsedAmount * 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid positive amount with at most two decimal places.",
      });
    }

    if (
      memberUserId !== undefined &&
    memberUserId !== null &&
    (typeof memberUserId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberUserId))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid member user ID.",
      });
    }

    if (
      mpesaReference !== undefined &&
  mpesaReference !== null &&
  typeof mpesaReference !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "M-Pesa reference must be text.",
      });
    }

    if (
      typeof mpesaReference === "string" &&
  mpesaReference.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "M-Pesa reference must not exceed 100 characters.",
      });
    }

    if (
      notes !== undefined &&
  notes !== null &&
  typeof notes !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Notes must be text.",
      });
    }

    if (
      paidAt !== undefined &&
  (
    typeof paidAt !== "string" ||
    paidAt.trim() === "" ||
    !Number.isFinite(Date.parse(paidAt))
  )
    ) {
      return res.status(400).json({
        success: false,
        message: "Paid date must be a valid date string.",
      });
    }

    const reference = mpesaReference?.trim() || null;
    const normalizedReference = reference
      ? reference.toUpperCase()
      : null;

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      if (memberUserId) {
        const memberResult = await client.query(
          `SELECT id
   FROM users
   WHERE id = $1
     AND LOWER(TRIM(role)) IN ('member', 'chairperson', 'secretary', 'treasurer')
     AND LOWER(TRIM(account_status)) = 'approved'
     AND deleted_at IS NULL`,
          [memberUserId]
        );

        if (memberResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Approved contributor account not found.",
          });
        }
      }

      const result = await client.query(
        `INSERT INTO transactions (
         member_user_id,
         entered_member_name,
         amount,
         paid_at,
         mpesa_reference,
         normalized_mpesa_reference,
         status,
         notes,
         created_by,
         updated_by
       )
       VALUES (
         $1, $2, $3, COALESCE($4::timestamptz, NOW()),
         $5, $6, 'active', $7, $8, $8
       )
       RETURNING
         id,
         member_user_id,
         entered_member_name,
         amount,
         paid_at,
         mpesa_reference,
         status,
         notes,
         created_by,
         created_at`,
        [
          memberUserId || null,
          name,
          parsedAmount,
          paidAt || null,
          reference,
          normalizedReference,
          typeof notes === "string" && notes.trim()
            ? notes.trim()
            : null,
          req.session.user.id,
        ]
      );

      const transaction = result.rows[0];

      // Insert the audit log using the actual audit_logs schema.
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
          "transaction_created",
          "transaction",
          transaction.id,
          null,
          JSON.stringify(transaction),
        ]
      );

      await client.query(
        `INSERT INTO notifications (
           recipient_user_id,
           transaction_id,
           event_type,
           title,
           message
         )
         SELECT id, $1, 'transaction_created',
                'Contribution recorded',
                $2
         FROM users
         WHERE role = 'member'
           AND account_status = 'approved'
           AND deleted_at IS NULL`,
        [
          transaction.id,
          `A contribution has been recorded for ${transaction.entered_member_name}.`,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Transaction recorded successfully.",
        transaction,
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This M-Pesa reference has already been recorded.",
        });
      }

      if (error.code === "23503") {
        return res.status(400).json({
          success: false,
          message: "A referenced user does not exist.",
        });
      }

      return next(error);
    } finally {
      if (client) {
        client.release();
      }
    }
  });
// patch

router.patch(
  "/:id",
  requireAuth,
  requireRole("treasurer"),
  async (req, res, next) => {
    const { id } = req.params;
    let {
      enteredMemberName,
      amount,
      paidAt,
      mpesaReference,
      notes,
    } = req.body;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID.",
      });
    }

    if (enteredMemberName !== undefined) {
      if (
        typeof enteredMemberName !== "string" ||
        !enteredMemberName.trim() ||
        enteredMemberName.trim().length > 150
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Member name is required and must not exceed 150 characters.",
        });
      }

      enteredMemberName = enteredMemberName.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);

      if (
        amount === null ||
        amount === "" ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0 ||
        parsedAmount > 9999999999.99 ||
        Math.round(parsedAmount * 100) !== parsedAmount * 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Amount must be positive, must not exceed 9999999999.99, and may have at most two decimal places.",
        });
      }
    }

    if (paidAt !== undefined) {
      const parsedDate =
        typeof paidAt === "string" ? Date.parse(paidAt) : NaN;

      if (
        typeof paidAt !== "string" ||
        !paidAt.trim() ||
        !Number.isFinite(parsedDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Paid date must be a valid date string.",
        });
      }
    }

    if (
      mpesaReference !== undefined &&
      mpesaReference !== null &&
      (typeof mpesaReference !== "string" ||
        mpesaReference.trim().length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid M-Pesa reference.",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Notes must be text.",
      });
    }

    if (typeof notes === "string" && notes.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Notes must not exceed 5000 characters.",
      });
    }

    const reason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim()
        : "";

    if (!reason || reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message:
          "A reason is required and must not exceed 1000 characters.",
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const existingResult = await client.query(
        `SELECT *
         FROM transactions
         WHERE id = $1 AND status = 'active'
         FOR UPDATE`,
        [id]
      );

      if (existingResult.rowCount === 0) {
        await client.query("ROLLBACK").catch(()=>{});
        return res.status(404).json({
          success: false,
          message: "Active transaction not found.",
        });
      }

      const oldTransaction = existingResult.rows[0];

      const name =
        enteredMemberName === undefined
          ? oldTransaction.entered_member_name
          : enteredMemberName.trim();

      const newAmount =
        amount === undefined ? oldTransaction.amount : Number(amount);

      const newPaidAt =
        paidAt === undefined ? oldTransaction.paid_at : paidAt;

      const reference =
        mpesaReference === undefined
          ? oldTransaction.mpesa_reference
          : typeof mpesaReference === "string" && mpesaReference.trim()
            ? mpesaReference.trim()
            : null;

      const normalizedReference = reference
        ? reference.toUpperCase()
        : null;

      const newNotes =
        notes === undefined
          ? oldTransaction.notes
          : typeof notes === "string" && notes.trim()
            ? notes.trim()
            : null;

      const updatedResult = await client.query(
        `UPDATE transactions
         SET entered_member_name = $1,
             amount = $2,
             paid_at = $3,
             mpesa_reference = $4,
             normalized_mpesa_reference = $5,
             notes = $6,
             updated_by = $7,
             updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          name,
          newAmount,
          newPaidAt,
          reference,
          normalizedReference,
          newNotes,
          req.session.user.id,
          id,
        ]
      );

      const updatedTransaction = updatedResult.rows[0];

      await client.query(
        `INSERT INTO audit_logs (
           actor_user_id, action, target_type, target_id,
           old_values, new_values
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
        [
          req.session.user.id,
          "transaction_updated",
          "transaction",
          id,
          JSON.stringify(oldTransaction),
          JSON.stringify({
            ...updatedTransaction,
            change_reason: reason,
          }),
        ]
      );

      if (updatedTransaction.member_user_id) {
        await client.query(
          `INSERT INTO notifications (
             recipient_user_id, transaction_id,
             event_type, title, message
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            updatedTransaction.member_user_id,
            id,
            "transaction_updated",
            "Contribution updated",
            `Your contribution of ${updatedTransaction.amount} has been updated.`,
          ]
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Transaction updated successfully.",
        transaction: updatedTransaction,
      });
    } catch (error) {

      if (client) {
        await client.query("ROLLBACK").catch((rollbackError) => {
          console.error("Transaction update rollback failed:", rollbackError);
        });
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This M-Pesa reference has already been recorded.",
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
module.exports = router;
