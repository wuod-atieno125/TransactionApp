
const express = require("express");
const { query } = require("../../config/database");
const { requireAuth } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePagination(queryParams) {
  const limitValue = queryParams.limit ?? "20";
  const offsetValue = queryParams.offset ?? "0";

  // Reject arrays and other non-string query parameter values.
  if (
    typeof limitValue !== "string" ||
    typeof offsetValue !== "string" ||
    !/^\d+$/.test(limitValue) ||
    !/^\d+$/.test(offsetValue)
  ) {
    return null;
  }

  const limit = Number(limitValue);
  const offset = Number(offsetValue);

  if (
    !Number.isSafeInteger(limit) ||
    !Number.isSafeInteger(offset) ||
    limit < 1 ||
    limit > 100 ||
    offset < 0
  ) {
    return null;
  }

  return { limit, offset };
}

// GET /api/notifications
// List notifications belonging to the authenticated user.
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);

    if (!pagination) {
      return res.status(400).json({
        success: false,
        message:
          "limit must be an integer from 1 to 100, and offset must be a non-negative integer.",
      });
    }

    const result = await query(
      `SELECT
         id,
         transaction_id,
         event_type,
         title,
         message,
         created_at,
         read_at
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [
        req.session.user.id,
        pagination.limit,
        pagination.offset,
      ]
    );

    return res.status(200).json({
      success: true,
      notifications: result.rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        count: result.rowCount,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::text AS unread_count
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

// PATCH /api/notifications/read-all
router.patch("/read-all", async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE recipient_user_id = $1
         AND read_at IS NULL`,
      [req.session.user.id]
    );

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read.",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const result = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND recipient_user_id = $2
       RETURNING id, read_at`,
      [id, req.session.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/notifications/:id
// Delete only a notification owned by the authenticated user.
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const result = await query(
      `DELETE FROM notifications
       WHERE id = $1
         AND recipient_user_id = $2
       RETURNING id`,
      [id, req.session.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted.",
      id: result.rows[0].id,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
