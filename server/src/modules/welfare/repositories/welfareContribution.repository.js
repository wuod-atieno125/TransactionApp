const { query } = require("../../../config/database");

const TRANSACTION_COLUMNS = `
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
`;

async function findById(id, { role, userId }) {
  const result = await query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions
     WHERE id = $1
       AND ($2 IN ('treasurer', 'chairperson') OR member_user_id = $3)`,
    [id, role, userId]
  );

  return result.rows[0] || null;
}

async function list({ role, userId, limit, offset }) {
  const result = await query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions
     WHERE ($1 IN ('treasurer', 'chairperson') OR member_user_id = $2)
     ORDER BY paid_at DESC, created_at DESC
     LIMIT $3 OFFSET $4`,
    [role, userId, limit, offset]
  );

  return result.rows;
}

module.exports = {
  findById,
  list,
};
