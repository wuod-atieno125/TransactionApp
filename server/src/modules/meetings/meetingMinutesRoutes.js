
const express = require("express");
const { query, getClient } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);

const canManageMinutes = requireRole(["secretary"]);

function isValidUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function validateContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    return "Minutes content is required and cannot be empty.";
  }

  if (content.trim().length > 50000) {
    return "Minutes content must not exceed 50,000 characters.";
  }

  return null;
}

// GET /api/meeting-minutes
// All authenticated users can read meeting minutes.
router.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         mm.id,
         mm.meeting_id,
         mm.content,
         mm.recorded_by,
         mm.updated_by,
         mm.created_at,
         mm.updated_at,
         m.title AS meeting_title,
         m.starts_at AS meeting_starts_at,
         m.location AS meeting_location
       FROM meeting_minutes mm
       JOIN meetings m ON m.id = mm.meeting_id
       ORDER BY m.starts_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      minutes: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/meeting-minutes/:id
// Retrieve one set of minutes.
router.get("/:id", async (req, res, next) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "A valid meeting-minutes ID is required.",
    });
  }

  try {
    const result = await query(
      `SELECT
         mm.id,
         mm.meeting_id,
         mm.content,
         mm.recorded_by,
         mm.updated_by,
         mm.created_at,
         mm.updated_at,
         m.title AS meeting_title,
         m.starts_at AS meeting_starts_at,
         m.location AS meeting_location
       FROM meeting_minutes mm
       JOIN meetings m ON m.id = mm.meeting_id
       WHERE mm.id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Meeting minutes not found.",
      });
    }

    return res.status(200).json({
      success: true,
      minutes: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/meeting-minutes
// The secretary records minutes for an existing meeting.
router.post("/", canManageMinutes, async (req, res, next) => {
  const { meetingId, content } = req.body || {};
  const contentError = validateContent(content);

  if (!isValidUuid(meetingId)) {
    return res.status(400).json({
      success: false,
      message: "A valid meeting ID is required.",
    });
  }

  if (contentError) {
    return res.status(400).json({
      success: false,
      message: contentError,
    });
  }

  const actorId = req.session.user.id;
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const meetingResult = await client.query(
      `SELECT id, starts_at < NOW() AS has_taken_place
       FROM meetings
       WHERE id = $1
       FOR SHARE`,
      [meetingId]
    );

    if (meetingResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "The specified meeting does not exist.",
      });
    }

    if (!meetingResult.rows[0].has_taken_place) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Minutes can only be recorded after the meeting has taken place.",
      });
    }

    const result = await client.query(
      `INSERT INTO meeting_minutes (
         meeting_id,
         content,
         recorded_by
       )
       VALUES ($1, $2, $3)
       RETURNING *`,
      [meetingId, content.trim(), actorId]
    );

    const minutes = result.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         new_values
       )
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        actorId,
        "meeting_minutes_created",
        "meeting_minutes",
        minutes.id,
        JSON.stringify(minutes),
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Meeting minutes recorded successfully.",
      minutes,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return next(error);
  } finally {
    if (client) client.release();
  }
});

// PUT /api/meeting-minutes/:id
// The secretary updates minutes; changes are audit-logged atomically.
router.put("/:id", canManageMinutes, async (req, res, next) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "A valid meeting-minutes ID is required.",
    });
  }

  const { content } = req.body || {};
  const contentError = validateContent(content);

  if (contentError) {
    return res.status(400).json({
      success: false,
      message: contentError,
    });
  }

  const actorId = req.session.user.id;
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT *
       FROM meeting_minutes
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Meeting minutes not found.",
      });
    }

    const oldMinutes = existingResult.rows[0];
    const meetingResult = await client.query(
      `SELECT starts_at < NOW() AS has_taken_place
       FROM meetings
       WHERE id = $1
       FOR SHARE`,
      [oldMinutes.meeting_id]
    );

    if (
      meetingResult.rowCount === 0 ||
      !meetingResult.rows[0].has_taken_place
    ) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Minutes can only be updated after the meeting has taken place.",
      });
    }

    const updatedResult = await client.query(
      `UPDATE meeting_minutes
       SET content = $2,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, content.trim(), actorId]
    );

    const minutes = updatedResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         old_values,
         new_values
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        actorId,
        "meeting_minutes_updated",
        "meeting_minutes",
        minutes.id,
        JSON.stringify(oldMinutes),
        JSON.stringify(minutes),
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Meeting minutes updated successfully.",
      minutes,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return next(error);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
