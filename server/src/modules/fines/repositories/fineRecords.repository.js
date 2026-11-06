
const { query } = require("../../../config/database");

async function findActiveRuleById(ruleId) {
  const result = await query(
    `SELECT *
     FROM fine_rules
     WHERE id = $1
       AND status = 'active'
       AND effective_from <= NOW()
       AND (effective_to IS NULL OR effective_to >= NOW())
     LIMIT 1`,
    [ruleId]
  );

  return result.rows[0] || null;
}

async function findMember(memberId) {
  const result = await query(
    `SELECT id, full_name, role, account_status
     FROM users
     WHERE id = $1
       AND deleted_at IS NULL
       AND account_status = 'approved'
       AND LOWER(role) = 'member'
     LIMIT 1`,
    [memberId]
  );

  return result.rows[0] || null;
}

async function listActiveMembers() {
  const result = await query(
    `SELECT id, full_name
     FROM users
     WHERE LOWER(role) = 'member'
       AND account_status = 'approved'
       AND deleted_at IS NULL
     ORDER BY full_name ASC`
  );

  return result.rows;
}

async function findFineById(fineId) {
  const result = await query(
    `SELECT
       f.*,
       u.full_name AS member_name,
       r.title AS current_rule_title
     FROM fines f
     JOIN users u ON u.id = f.member_id
     LEFT JOIN fine_rules r ON r.id = f.fine_rule_id
     WHERE f.id = $1
     LIMIT 1`,
    [fineId]
  );

  return result.rows[0] || null;
}

async function listFines({ memberId, status, limit = 100, offset = 0 }) {
  const values = [];
  const conditions = [];

  if (memberId) {
    values.push(memberId);
    conditions.push(`f.member_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`f.status = $${values.length}`);
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
       f.id,
       f.fine_number,
       f.fine_rule_id,
       f.member_id,
       u.full_name AS member_name,
       f.rule_code,
       f.rule_version,
       f.rule_title,
       f.rule_description,
       f.rule_conditions,
       f.assessed_amount,
       f.currency,
       f.issued_at,
       f.due_date,
       f.status,
       f.recorded_by,
       COALESCE(p.amount_paid, 0)::NUMERIC(14,2) AS amount_paid,
       (f.assessed_amount - COALESCE(p.amount_paid, 0))::NUMERIC(14,2)
         AS outstanding_amount
     FROM fines f
     JOIN users u ON u.id = f.member_id
     LEFT JOIN (
       SELECT fine_id, SUM(amount) AS amount_paid
       FROM fine_payments
       GROUP BY fine_id
     ) p ON p.fine_id = f.id
     ${whereClause}
     ORDER BY f.issued_at DESC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    values
  );

  return result.rows;
}

async function createFine(client, data) {
  const result = await client.query(
    `INSERT INTO fines (
       fine_number,
       fine_rule_id,
       member_id,
       rule_code,
       rule_version,
       rule_title,
       rule_description,
       rule_conditions,
       assessed_amount,
       currency,
       due_date,
       recorded_by
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
     )
     RETURNING *`,
    [
      data.fineNumber,
      data.rule.id,
      data.member.id,
      data.rule.rule_code,
      data.rule.version,
      data.rule.title,
      data.rule.description,
      data.rule.conditions,
      data.rule.fine_amount,
      data.rule.currency,
      data.dueDate || null,
      data.actorId,
    ]
  );

  return result.rows[0];
}

module.exports = {
  findActiveRuleById,
  findMember,
  listActiveMembers,
  findFineById,
  listFines,
  createFine,
};