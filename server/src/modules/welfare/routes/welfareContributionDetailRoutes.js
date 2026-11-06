const express = require("express");
const { query } = require("../../../config/database");
const { requireAuth, requireRole } = require("../../../shared/middleware/auth");


const router = express.Router();

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
