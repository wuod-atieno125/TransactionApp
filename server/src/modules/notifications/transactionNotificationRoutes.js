const express = require("express");
const { query } = require("../../config/database");
const { requireAuth } = require("../../shared/middleware/auth");

const router = express.Router();

router.patch("/notifications/read-all", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE recipient_user_id = $1
         AND read_at IS NULL
       RETURNING id`,
      [req.session.user.id]
    );

    return res.status(200).json({
      success: true,
      message: "All unread notifications marked as read.",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/notifications/unread-count", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE recipient_user_id = $1
         AND read_at IS NULL`,
      [req.session.user.id]
    );

    return res.status(200).json({
      success: true,
      unreadCount: result.rows[0].unread_count,
    });
  } catch (error) {
    return next(error);
  }
});



module.exports = router;