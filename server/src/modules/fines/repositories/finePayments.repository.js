const { query } = require("../../../config/database");

async function findPaymentById(paymentId) {
  const result = await query(
    `SELECT *
     FROM fine_payments
     WHERE id = $1
     LIMIT 1`,
    [paymentId]
  );

  return result.rows[0] || null;
}

async function listPayments({ memberId, fineId, limit = 100, offset = 0 }) {
  const values = [];
  const conditions = [];

  if (memberId) {
    values.push(memberId);
    conditions.push(`p.member_id = $${values.length}`);
  }

  if (fineId) {
    values.push(fineId);
    conditions.push(`p.fine_id = $${values.length}`);
  }

  values.push(limit);
  const limitIndex = values.length;

  values.push(offset);
  const offsetIndex = values.length;

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await query(
    `SELECT
       p.id,
       p.payment_number,
       p.fine_id,
       f.fine_number,
       p.member_id,
       u.full_name AS member_name,
       p.amount,
       p.currency,
       p.payment_method,
       p.payment_reference,
       p.payment_date,
       p.recorded_by,
       p.notes,
       p.created_at,
       (
         p.amount - COALESCE(allocations.allocated_amount, 0)
       )::NUMERIC(14,2) AS available_amount
     FROM fine_payments p
     JOIN fines f ON f.id = p.fine_id
     JOIN users u ON u.id = p.member_id
     LEFT JOIN (
       SELECT
         fine_payment_id,
         SUM(allocated_amount) AS allocated_amount
       FROM fine_withdrawal_allocations
       GROUP BY fine_payment_id
     ) allocations ON allocations.fine_payment_id = p.id
     ${whereClause}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    values
  );

  return result.rows;
}

async function createPayment(client, data) {
  const result = await client.query(
    `INSERT INTO fine_payments (
       payment_number,
       fine_id,
       member_id,
       amount,
       currency,
       payment_method,
       payment_reference,
       payment_date,
       recorded_by,
       notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.paymentNumber,
      data.fine.id,
      data.fine.member_id,
      data.amount,
      data.fine.currency,
      data.paymentMethod,
      data.paymentReference || null,
      data.paymentDate,
      data.actorId,
      data.notes || null,
    ]
  );

  return result.rows[0];
}

async function createFundCredit(client, payment, actorId) {
  return client.query(
    `INSERT INTO fine_fund_movements (
       movement_type,
       amount,
       currency,
       fine_payment_id,
       description,
       recorded_by
     )
     VALUES (
       'credit',
       $1,
       $2,
       $3,
       $4,
       $5
     )`,
    [
      payment.amount,
      payment.currency,
      payment.id,
      `Fine payment ${payment.payment_number}`,
      actorId,
    ]
  );
}

module.exports = {
  findPaymentById,
  listPayments,
  createPayment,
  createFundCredit,
};