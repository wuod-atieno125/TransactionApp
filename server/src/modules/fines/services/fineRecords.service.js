
const crypto = require("crypto");
const { getClient } = require("../../../config/database");
const repository = require("../repositories/fineRecords.repository");
const finePaymentsService = require("./finePayments.service");

function createNumber(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePagination(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

function moneyToCents(value) {
  const [whole, fraction = ""] = String(value).split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

async function listFines(filters, actor) {
  const memberId =
    actor.role === "member" ? actor.id : filters.memberId || null;

  const status = filters.status || null;
  const allowedStatuses = ["unpaid", "partially_paid", "paid"];

  if (status && !allowedStatuses.includes(status)) {
    throw createError("Invalid fine status.");
  }

  return repository.listFines({
    memberId,
    status,
    limit: validatePagination(filters.limit, 100, 500),
    offset: validatePagination(filters.offset, 0, 100000),
  });
}

async function listActiveMembers() {
  return repository.listActiveMembers();
}

async function getFine(fineId, actor) {
  const fine = await repository.findFineById(fineId);

  if (!fine) {
    throw createError("Fine record not found.", 404);
  }

  if (actor.role === "member" && fine.member_id !== actor.id) {
    throw createError("You are not permitted to view this fine.", 403);
  }

  const client = await getClient();

  try {
    const payments = await client.query(
      `SELECT
         id,
         payment_number,
         amount,
         currency,
         payment_method,
         payment_reference,
         payment_date,
         notes
       FROM fine_payments
       WHERE fine_id = $1
       ORDER BY payment_date DESC, created_at DESC`,
      [fineId]
    );

    const totalPaid = payments.rows.reduce(
      (total, payment) => total + Number(payment.amount),
      0
    );

    return {
      ...fine,
      amount_paid: totalPaid.toFixed(2),
      outstanding_amount: (
        Number(fine.assessed_amount) - totalPaid
      ).toFixed(2),
      payments: payments.rows,
    };
  } finally {
    client.release();
  }
}

async function issueFine(data, actorId) {
  const fineRuleId = data.fineRuleId;
  const memberId = data.memberId;
  const initialPayment = finePaymentsService.validatePaymentData(
    {
      amount: data.initialPaymentAmount ?? "0",
      paymentMethod: data.initialPaymentMethod || "mpesa",
      paymentReference:
        Number(data.initialPaymentAmount ?? 0) > 0
          ? data.initialPaymentReference
          : null,
    },
    { allowZero: true }
  );

  if (!fineRuleId || !memberId) {
    throw createError("An active fine rule and member are required.");
  }

  let dueDate = null;

  if (data.dueDate) {
    const parsedDate = new Date(`${data.dueDate}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== data.dueDate
    ) {
      throw createError("The due date is invalid.");
    }

    dueDate = data.dueDate;
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const ruleResult = await client.query(
      `SELECT *
       FROM fine_rules
       WHERE id = $1
         AND status = 'active'
         AND (effective_from AT TIME ZONE 'UTC')::date <=
             (NOW() AT TIME ZONE 'UTC')::date
         AND (
           effective_to IS NULL
           OR (effective_to AT TIME ZONE 'UTC')::date >=
              (NOW() AT TIME ZONE 'UTC')::date
         )
       FOR SHARE`,
      [fineRuleId]
    );

    const rule = ruleResult.rows[0];

    if (!rule) {
      throw createError("The selected fine rule is not currently active.", 404);
    }

    if (
      moneyToCents(initialPayment.amount) >
      moneyToCents(rule.fine_amount)
    ) {
      throw createError("Initial payment cannot exceed the fine amount.");
    }

    const memberResult = await client.query(
      `SELECT id, full_name
       FROM users
       WHERE id = $1
         AND deleted_at IS NULL
         AND account_status = 'approved'
         AND LOWER(role) = 'member'
       LIMIT 1`,
      [memberId]
    );

    const member = memberResult.rows[0];

    if (!member) {
      throw createError("The selected member was not found or is not approved.", 404);
    }

    const fineNumber = createNumber("FINE");

    const fine = await repository.createFine(client, {
      fineNumber,
      rule,
      member,
      dueDate,
      actorId,
    });

    if (moneyToCents(initialPayment.amount) > 0) {
      await finePaymentsService.recordPaymentInTransaction(
        client,
        fine,
        initialPayment,
        actorId
      );
    }

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
        "fine_issued",
        "fine",
        fine.id,
        null,
        JSON.stringify({
          fine_number: fine.fine_number,
          member_id: fine.member_id,
          fine_rule_id: fine.fine_rule_id,
          assessed_amount: fine.assessed_amount,
          currency: fine.currency,
        }),
      ]
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
        memberId,
        "fine_issued",
        "A fine has been recorded",
        `Fine ${fine.fine_number} has been recorded against your account for ${fine.currency} ${fine.assessed_amount}.`,
      ]
    );

    await client.query("COMMIT");
    return fine;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505" && error.constraint === "uq_fine_payments_reference") {
      throw createError("This payment reference has already been recorded.");
    }

    if (error.code === "P0001") {
      throw createError(error.message || "The payment could not be recorded.");
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listFines,
  listActiveMembers,
  getFine,
  issueFine,
};