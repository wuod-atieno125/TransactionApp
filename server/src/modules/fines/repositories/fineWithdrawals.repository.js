const { query } = require("../../../config/database");

async function listWithdrawals({ status, limit = 100, offset = 0 }) {
  const values = [];
  let whereClause = "";

  if (status) {
    values.push(status);
    whereClause = `WHERE w.status = $${values.length}`;
  }

  values.push(limit);
  const limitIndex = values.length;

  values.push(offset);
  const offsetIndex = values.length;

  const result = await query(
    `SELECT
       w.*,
       initiator.full_name AS initiated_by_name,
       approver.full_name AS approved_by_name,
       rejector.full_name AS rejected_by_name,
       completer.full_name AS completed_by_name
     FROM fine_withdrawals w
     LEFT JOIN users initiator ON initiator.id = w.initiated_by
     LEFT JOIN users approver ON approver.id = w.approved_by
     LEFT JOIN users rejector ON rejector.id = w.rejected_by
     LEFT JOIN users completer ON completer.id = w.completed_by
     ${whereClause}
     ORDER BY w.initiated_at DESC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    values
  );

  return result.rows;
}

async function findWithdrawalById(withdrawalId) {
  const result = await query(
    `SELECT
       w.*,
       initiator.full_name AS initiated_by_name,
       approver.full_name AS approved_by_name,
       rejector.full_name AS rejected_by_name,
       completer.full_name AS completed_by_name
     FROM fine_withdrawals w
     LEFT JOIN users initiator ON initiator.id = w.initiated_by
     LEFT JOIN users approver ON approver.id = w.approved_by
     LEFT JOIN users rejector ON rejector.id = w.rejected_by
     LEFT JOIN users completer ON completer.id = w.completed_by
     WHERE w.id = $1
     LIMIT 1`,
    [withdrawalId]
  );

  return result.rows[0] || null;
}

module.exports = {
  listWithdrawals,
  findWithdrawalById,
};