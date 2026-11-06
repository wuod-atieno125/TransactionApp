
const crypto = require("crypto");
const { getClient } = require("../../../config/database");
const repository = require("../repositories/fineWithdrawals.repository");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createWithdrawalNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `FW-${date}-${random}`;
}

// Convert monetary values to integer cents to avoid floating-point arithmetic.
function toCents(value) {
  const text = String(value ?? "").trim();

  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
    throw createError("Enter a valid monetary amount with up to two decimal places.");
  }

  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function fromCents(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function validatePagination(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

async function writeAudit(client, actorId, action, targetId, newValues, oldValues = null) {
  await client.query(
    `INSERT INTO audit_logs (
       actor_user_id,
       action,
       target_type,
       target_id,
       old_values,
       new_values
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      actorId,
      action,
      "fine_withdrawal",
      targetId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ]
  );
}

async function listWithdrawals(filters = {}) {
  const allowedStatuses = [
    "pending",
    "approved",
    "rejected",
    "completed",
  ];

  const status = filters.status || null;

  if (status && !allowedStatuses.includes(status)) {
    throw createError("Invalid withdrawal status.");
  }

  return repository.listWithdrawals({
    status,
    limit: validatePagination(filters.limit, 100, 500),
    offset: validatePagination(filters.offset, 0, 100000),
  });
}

async function getWithdrawal(withdrawalId) {
  const withdrawal = await repository.findWithdrawalById(withdrawalId);

  if (!withdrawal) {
    throw createError("Withdrawal not found.", 404);
  }

  const client = await getClient();

  try {
    const allocations = await client.query(
      `SELECT
         a.id,
         a.fine_payment_id,
         a.allocated_amount,
         a.allocated_at,
         p.payment_number,
         p.fine_id,
         f.fine_number,
         p.member_id,
         u.full_name AS member_name
       FROM fine_withdrawal_allocations a
       JOIN fine_payments p ON p.id = a.fine_payment_id
       JOIN fines f ON f.id = p.fine_id
       JOIN users u ON u.id = p.member_id
       WHERE a.withdrawal_id = $1
       ORDER BY a.allocated_at ASC`,
      [withdrawalId]
    );

    return {
      ...withdrawal,
      allocations: allocations.rows,
    };
  } finally {
    client.release();
  }
}

async function initiateWithdrawal(data, actorId) {
  const amountCents = toCents(data.amount);

  if (amountCents <= 0n) {
    throw createError("Withdrawal amount must be greater than zero.");
  }

  const purpose = String(data.purpose || "").trim();
  const notes = data.notes ? String(data.notes).trim() : null;

  if (!purpose) {
    throw createError("Withdrawal purpose is required.");
  }

  if (purpose.length > 500) {
    throw createError("Withdrawal purpose cannot exceed 500 characters.");
  }

  if (notes && notes.length > 1000) {
    throw createError("Withdrawal notes cannot exceed 1,000 characters.");
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const withdrawalNumber = createWithdrawalNumber();

    const result = await client.query(
      `INSERT INTO fine_withdrawals (
         withdrawal_number,
         amount,
         currency,
         purpose,
         status,
         initiated_by,
         notes
       )
       VALUES ($1, $2, 'KES', $3, 'pending', $4, $5)
       RETURNING *`,
      [
        withdrawalNumber,
        fromCents(amountCents),
        purpose,
        actorId,
        notes,
      ]
    );

    const withdrawal = result.rows[0];

    await writeAudit(
      client,
      actorId,
      "fine_withdrawal_initiated",
      withdrawal.id,
      {
        withdrawal_number: withdrawal.withdrawal_number,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        purpose: withdrawal.purpose,
      }
    );

    // Notify all active chairpersons that approval is required.
    await client.query(
      `INSERT INTO notifications (
         recipient_user_id,
         event_type,
         title,
         message
       )
       SELECT
         id,
         'fine_withdrawal_pending',
         'Fine withdrawal requires approval',
         $1
       FROM users
       WHERE LOWER(role) = 'chairperson'
         AND account_status = 'approved'
         AND deleted_at IS NULL`,
      [
        `Withdrawal ${withdrawal.withdrawal_number} for KES ${withdrawal.amount} is awaiting your decision.`,
      ]
    );

    await client.query("COMMIT");

    return withdrawal;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function decideWithdrawal(withdrawalId, data, actorId) {
  const decision = String(data.decision || "").toLowerCase();
  const rejectionReason = data.rejectionReason
    ? String(data.rejectionReason).trim()
    : null;

  if (!["approve", "reject"].includes(decision)) {
    throw createError("Decision must be approve or reject.");
  }

  if (decision === "reject" && !rejectionReason) {
    throw createError("A reason is required when rejecting a withdrawal.");
  }

  if (rejectionReason && rejectionReason.length > 1000) {
    throw createError("Rejection reason cannot exceed 1,000 characters.");
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
       FROM fine_withdrawals
       WHERE id = $1
       FOR UPDATE`,
      [withdrawalId]
    );

    const withdrawal = result.rows[0];

    if (!withdrawal) {
      throw createError("Withdrawal not found.", 404);
    }

    if (withdrawal.status !== "pending") {
      throw createError("Only pending withdrawals can be approved or rejected.");
    }

    if (decision === "approve") {
      await client.query(
        `UPDATE fine_withdrawals
         SET status = 'approved',
             approved_by = $1,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [actorId, withdrawalId]
      );
    } else {
      await client.query(
        `UPDATE fine_withdrawals
         SET status = 'rejected',
             rejected_by = $1,
             rejected_at = NOW(),
             rejection_reason = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [actorId, rejectionReason, withdrawalId]
      );
    }

    const updated = await client.query(
      `SELECT * FROM fine_withdrawals WHERE id = $1`,
      [withdrawalId]
    );

    const updatedWithdrawal = updated.rows[0];

    await writeAudit(
      client,
      actorId,
      decision === "approve"
        ? "fine_withdrawal_approved"
        : "fine_withdrawal_rejected",
      withdrawalId,
      {
        status: updatedWithdrawal.status,
        rejection_reason: updatedWithdrawal.rejection_reason,
      },
      {
        status: withdrawal.status,
      }
    );

    await client.query(
      `INSERT INTO notifications (
         recipient_user_id,
         event_type,
         title,
         message
       )
       VALUES ($1, $2, $3, $4)`,
      [
        withdrawal.initiated_by,
        decision === "approve"
          ? "fine_withdrawal_approved"
          : "fine_withdrawal_rejected",
        decision === "approve"
          ? "Fine withdrawal approved"
          : "Fine withdrawal rejected",
        decision === "approve"
          ? `Your withdrawal ${withdrawal.withdrawal_number} has been approved.`
          : `Your withdrawal ${withdrawal.withdrawal_number} was rejected. Reason: ${rejectionReason}`,
      ]
    );

    await client.query("COMMIT");

    return updatedWithdrawal;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function executeWithdrawal(withdrawalId, data, actorId) {
  const allocations = data.allocations;

  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw createError("At least one payment allocation is required.");
  }

  const seenPaymentIds = new Set();
  let allocationTotal = 0n;

  const normalizedAllocations = allocations.map((allocation) => {
    const finePaymentId = String(allocation.finePaymentId || "").trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        finePaymentId
      )
    ) {
      throw createError("An allocation contains an invalid payment ID.");
    }

    if (seenPaymentIds.has(finePaymentId)) {
      throw createError("A payment cannot appear more than once in an allocation.");
    }

    seenPaymentIds.add(finePaymentId);

    const allocatedCents = toCents(allocation.allocatedAmount);

    if (allocatedCents <= 0n) {
      throw createError("Each allocation must be greater than zero.");
    }

    allocationTotal += allocatedCents;

    return {
      finePaymentId,
      allocatedAmount: fromCents(allocatedCents),
    };
  });

  if (normalizedAllocations.length > 200) {
    throw createError("A withdrawal cannot contain more than 200 allocations.");
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Serialize withdrawal executions so two treasurers cannot spend
    // the same available fund balance concurrently.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('fine_fund_withdrawal_execution'))"
    );

    const withdrawalResult = await client.query(
      `SELECT *
       FROM fine_withdrawals
       WHERE id = $1
       FOR UPDATE`,
      [withdrawalId]
    );

    const withdrawal = withdrawalResult.rows[0];

    if (!withdrawal) {
      throw createError("Withdrawal not found.", 404);
    }

    if (withdrawal.status !== "approved") {
      throw createError("Only approved withdrawals can be executed.");
    }

    const withdrawalCents = toCents(withdrawal.amount);

    if (allocationTotal !== withdrawalCents) {
      throw createError(
        `Allocations must total exactly KES ${fromCents(withdrawalCents)}.`
      );
    }

    // Lock payment rows in a stable order to reduce deadlock risk.
    const paymentIds = normalizedAllocations
      .map((item) => item.finePaymentId)
      .sort();

    const paymentResult = await client.query(
      `SELECT
         p.id,
         p.payment_number,
         p.amount,
         p.currency
       FROM fine_payments p
       WHERE p.id = ANY($1::uuid[])
       ORDER BY p.id
       FOR UPDATE`,
      [paymentIds]
    );

    if (paymentResult.rows.length !== normalizedAllocations.length) {
      throw createError("One or more selected fine payments could not be found.");
    }

    const paymentMap = new Map(
      paymentResult.rows.map((payment) => [payment.id, payment])
    );

    for (const allocation of normalizedAllocations) {
      const payment = paymentMap.get(allocation.finePaymentId);

      if (payment.currency !== withdrawal.currency) {
        throw createError("All allocated payments must use the withdrawal currency.");
      }

      const allocatedResult = await client.query(
        `SELECT COALESCE(SUM(allocated_amount), 0)::NUMERIC(14,2) AS total
         FROM fine_withdrawal_allocations
         WHERE fine_payment_id = $1`,
        [allocation.finePaymentId]
      );

      const alreadyAllocatedCents = toCents(allocatedResult.rows[0].total);
      const paymentCents = toCents(payment.amount);
      const requestedCents = toCents(allocation.allocatedAmount);
      const availableCents = paymentCents - alreadyAllocatedCents;

      if (requestedCents > availableCents) {
        throw createError(
          `Allocation exceeds the available amount for payment ${payment.payment_number}.`
        );
      }
    }

    const balanceResult = await client.query(
      `SELECT
         COALESCE(
           SUM(
             CASE
               WHEN movement_type = 'credit' THEN amount
               WHEN movement_type = 'debit' THEN -amount
               ELSE 0
             END
           ),
           0
         )::NUMERIC(14,2) AS available_balance
       FROM fine_fund_movements`
    );

    const availableFundCents = toCents(
      balanceResult.rows[0].available_balance
    );

    if (availableFundCents < withdrawalCents) {
      throw createError(
        `Insufficient fine funds. Available balance is KES ${fromCents(availableFundCents)}.`
      );
    }

    for (const allocation of normalizedAllocations) {
      await client.query(
        `INSERT INTO fine_withdrawal_allocations (
           withdrawal_id,
           fine_payment_id,
           allocated_amount,
           allocated_by
         )
         VALUES ($1, $2, $3, $4)`,
        [
          withdrawalId,
          allocation.finePaymentId,
          allocation.allocatedAmount,
          actorId,
        ]
      );
    }

    await client.query(
      `INSERT INTO fine_fund_movements (
         movement_type,
         amount,
         currency,
         withdrawal_id,
         description,
         recorded_by
       )
       VALUES ('debit', $1, $2, $3, $4, $5)`,
      [
        withdrawal.amount,
        withdrawal.currency,
        withdrawalId,
        `Execution of fine withdrawal ${withdrawal.withdrawal_number}`,
        actorId,
      ]
    );

    const paymentReference = data.paymentReference
      ? String(data.paymentReference).trim()
      : null;

    const notes = data.notes ? String(data.notes).trim() : null;

    if (paymentReference && paymentReference.length > 150) {
      throw createError("Payment reference cannot exceed 150 characters.");
    }

    if (notes && notes.length > 1000) {
      throw createError("Execution notes cannot exceed 1,000 characters.");
    }

    const updatedResult = await client.query(
      `UPDATE fine_withdrawals
       SET status = 'completed',
           completed_by = $1,
           completed_at = NOW(),
           payment_reference = $2,
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [actorId, paymentReference, notes, withdrawalId]
    );

    const updatedWithdrawal = updatedResult.rows[0];

    await writeAudit(
      client,
      actorId,
      "fine_withdrawal_completed",
      withdrawalId,
      {
        status: "completed",
        amount: updatedWithdrawal.amount,
        payment_reference: updatedWithdrawal.payment_reference,
        allocations: normalizedAllocations,
      },
      {
        status: "approved",
      }
    );

    // Notify all approved members when fine funds are withdrawn.
    await client.query(
      `INSERT INTO notifications (
         recipient_user_id,
         event_type,
         title,
         message
       )
       SELECT
         id,
         'fine_withdrawal_completed',
         'Fine fund withdrawal completed',
         $1
       FROM users
       WHERE LOWER(role) = 'member'
         AND account_status = 'approved'
         AND deleted_at IS NULL`,
      [
        `Fine fund withdrawal ${updatedWithdrawal.withdrawal_number} of KES ${updatedWithdrawal.amount} has been completed.`,
      ]
    );

    await client.query("COMMIT");

    return updatedWithdrawal;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createError(
        "This withdrawal has already been executed or an allocation already exists."
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listWithdrawals,
  getWithdrawal,
  initiateWithdrawal,
  decideWithdrawal,
  executeWithdrawal,
};