const crypto = require("crypto");
const { getClient } = require("../../../config/database");
const repository = require("../repositories/finePayments.repository");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createPaymentNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `FPAY-${date}-${random}`;
}

function validMoney(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return false;
  }

  return /^\d{1,12}(\.\d{1,2})?$/.test(String(value).trim()) &&
    Number(value) > 0;
}

function validNonNegativeMoney(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }

  return /^\d{1,12}(\.\d{1,2})?$/.test(String(value).trim()) &&
    Number(value) >= 0;
}

function validDate(value) {
  if (!value) return false;

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

function validatePaymentData(data, { allowZero = false } = {}) {
  const amountIsValid = allowZero
    ? validNonNegativeMoney(data.amount)
    : validMoney(data.amount);

  if (!amountIsValid) {
    throw createError(
      allowZero
        ? "Enter a valid payment amount of zero or more."
        : "Enter a valid payment amount greater than zero."
    );
  }

  const allowedMethods = ["cash", "bank", "mpesa", "other"];
  const paymentMethod = String(data.paymentMethod || "").toLowerCase();

  if (!allowedMethods.includes(paymentMethod)) {
    throw createError("Select a valid payment method.");
  }

  const paymentDate = data.paymentDate || new Date().toISOString();

  if (!validDate(paymentDate)) {
    throw createError("Enter a valid payment date.");
  }

  const paymentReference = data.paymentReference
    ? String(data.paymentReference).trim()
    : null;
  const notes = data.notes ? String(data.notes).trim() : null;

  if (paymentReference && paymentReference.length > 150) {
    throw createError("Payment reference cannot exceed 150 characters.");
  }

  if (notes && notes.length > 1000) {
    throw createError("Payment notes cannot exceed 1,000 characters.");
  }

  return {
    amount: String(data.amount).trim(),
    paymentMethod,
    paymentReference,
    paymentDate,
    notes,
  };
}

async function recordPaymentInTransaction(client, fine, data, actorId) {
  const paymentNumber = createPaymentNumber();
  const payment = await repository.createPayment(client, {
    paymentNumber,
    fine,
    ...data,
    actorId,
  });

  await repository.createFundCredit(client, payment, actorId);

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
      "fine_payment_recorded",
      "fine_payment",
      payment.id,
      null,
      JSON.stringify({
        payment_number: payment.payment_number,
        fine_id: payment.fine_id,
        amount: payment.amount,
        currency: payment.currency,
        payment_method: payment.payment_method,
        payment_reference: payment.payment_reference,
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
      fine.member_id,
      "fine_payment_recorded",
      "Fine payment received",
      `A payment of ${fine.currency} ${payment.amount} has been recorded for fine ${fine.fine_number}.`,
    ]
  );

  return payment;
}

async function listPayments(filters, actor) {
  const memberId =
    actor.role === "member" ? actor.id : filters.memberId || null;

  return repository.listPayments({
    memberId,
    fineId: filters.fineId || null,
    limit: Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 500),
    offset: Math.max(Number.parseInt(filters.offset, 10) || 0, 0),
  });
}

async function recordPayment(fineId, data, actorId) {
  if (!fineId) {
    throw createError("Fine record ID is required.");
  }

  const paymentData = validatePaymentData(data);

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Lock the fine while checking and recording the payment.
    const fineResult = await client.query(
      `SELECT *
       FROM fines
       WHERE id = $1
       FOR UPDATE`,
      [fineId]
    );

    const fine = fineResult.rows[0];

    if (!fine) {
      throw createError("Fine record not found.", 404);
    }

    const payment = await recordPaymentInTransaction(
      client,
      fine,
      paymentData,
      actorId
    );

    await client.query("COMMIT");

    return payment;
  } catch (error) {
    await client.query("ROLLBACK");

    // Convert common PostgreSQL constraint errors into readable messages.
    if (error.code === "23505") {
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
  listPayments,
  recordPayment,
  validatePaymentData,
  recordPaymentInTransaction,
};