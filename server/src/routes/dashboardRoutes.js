
const express = require("express");
const { query } = require("../config/database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

const canViewDashboard = requireRole([
  "member",
  "treasurer",
  "chairperson",
  "secretary",
]);

// GET /api/dashboard/overview
// Members receive their own summary and the aggregate collective total.
// Treasurers and chairpersons receive the group overview.
router.get("/overview", canViewDashboard, async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const role = String(req.session.user.role || "").toLowerCase();

    if (role === "member" || role === "secretary") {
      const result = await query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status = 'active'
           )::int AS active_transaction_count,

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'active'
             ), 0
           ) AS total_contributions,

           COUNT(*) FILTER (
             WHERE status = 'reversed'
           )::int AS reversed_transaction_count,

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'reversed'
             ), 0
           ) AS reversed_contributions,

           MAX(paid_at) FILTER (
             WHERE status = 'active'
           ) AS last_contribution_at,

           (
             SELECT COALESCE(SUM(amount), 0)
             FROM transactions
             WHERE status = 'active'
           ) AS collective_total_contributions

         FROM transactions
         WHERE member_user_id = $1`,
        [userId]
      );

      return res.status(200).json({
        success: true,
        dashboard: {
          role,
          ...result.rows[0],
        },
      });
    }

    const [transactionResult, memberResult] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status = 'active'
           )::int AS active_transaction_count,

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'active'
             ), 0
           ) AS total_contributions,

           COUNT(*) FILTER (
             WHERE status = 'reversed'
           )::int AS reversed_transaction_count,

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'reversed'
             ), 0
           ) AS reversed_contributions,

           COUNT(DISTINCT member_user_id) FILTER (
             WHERE status = 'active'
               AND member_user_id IS NOT NULL
           )::int AS contributing_member_count,

           MAX(paid_at) FILTER (
             WHERE status = 'active'
           ) AS last_contribution_at

         FROM transactions`
      ),

      query(
        `SELECT
           COUNT(*) FILTER (
             WHERE account_status = 'approved'
           )::int AS approved_members,

           COUNT(*) FILTER (
             WHERE account_status = 'pending'
           )::int AS pending_members,

           COUNT(*) FILTER (
             WHERE account_status = 'rejected'
           )::int AS rejected_members,

           COUNT(*) FILTER (
             WHERE account_status = 'disabled'
           )::int AS disabled_members

         FROM users
         WHERE role = 'member'
           AND deleted_at IS NULL`
      ),
    ]);

    return res.status(200).json({
      success: true,
      dashboard: {
        role,
        contributions: transactionResult.rows[0],
        members: memberResult.rows[0],
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
