
const express = require("express");
const { query, getClient } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);

const canManageMeetings = requireRole(["chairperson"]);

// GET /api/meetings
// List meetings for selecting a meeting when recording minutes.
router.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         m.id,
         m.title,
         m.starts_at,
         m.location,
         EXISTS (
           SELECT 1
           FROM meeting_minutes mm
           WHERE mm.meeting_id = m.id
         ) AS has_minutes
       FROM meetings m
       WHERE m.starts_at < NOW()
       ORDER BY m.starts_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      meetings: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

function validateMeetingInput(body) {
  const { title, startsAt, location = null, description = null } = body || {};

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 200
  ) {
    return "A meeting title is required and must not exceed 200 characters.";
  }

    if (
    typeof startsAt !== "string" ||
    !startsAt.trim() ||
    !/(Z|[+-]\d{2}:\d{2})$/i.test(startsAt)
  ) {
    return "A valid meeting date and time with an explicit timezone is required.";
  }

  const parsedStartsAt = Date.parse(startsAt);

  if (!Number.isFinite(parsedStartsAt)) {
    return "A valid meeting date and time is required.";
  }

  // Require an explicit timezone to avoid interpreting local time
  // differently across servers and clients.
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(startsAt)) {
    return "Meeting time must include a timezone, such as Z or +03:00.";
  }

  if (location !== null &&
      (typeof location !== "string" || location.length > 255)) {
    return "Location must be text of at most 255 characters, or null.";
  }

  if (description !== null && typeof description !== "string") {
    return "Description must be text or null.";
  }

  return null;
}

// GET /api/meetings/next
// Retrieve the next meeting, or null if none has been scheduled.
router.get("/next", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         id,
         title,
         description,
         starts_at,
         location,
         created_by,
         updated_by,
         created_at,
         updated_at
       FROM meetings
       WHERE starts_at >= NOW()
       ORDER BY starts_at ASC
       LIMIT 1`
    );

    return res.status(200).json({
      success: true,
      meeting: result.rows[0] || null,
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/meetings/next
// Chairperson creates the first meeting or updates the existing next meeting.
router.put("/next", canManageMeetings, async (req, res, next) => {
  const validationError = validateMeetingInput(req.body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const { title, startsAt, location = null, description = null } = req.body;
  const actorId = req.session.user.id;
  const startsAtUtc = new Date(startsAt).toISOString();

  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    // Serialize competing updates so two requests cannot both create
    // the first next meeting.
    await client.query(
      "LOCK TABLE meetings IN EXCLUSIVE MODE"
    );

    const existingResult = await client.query(
      `SELECT *
       FROM meetings
       WHERE starts_at >= NOW()
       ORDER BY starts_at ASC
       LIMIT 1
       FOR UPDATE`
    );

    let result;
    let action;
    let oldMeeting = null;

    if (existingResult.rowCount === 0) {
      result = await client.query(
        `INSERT INTO meetings (
           title,
           description,
           starts_at,
           location,
           created_by,
           updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING
           id, title, description, starts_at, location,
           created_by, updated_by, created_at, updated_at`,
        [title.trim(), description, startsAtUtc, location, actorId]
      );

      action = "meeting_created";
    } else {
      oldMeeting = existingResult.rows[0];

      result = await client.query(
        `UPDATE meetings
         SET title = $2,
             description = $3,
             starts_at = $4,
             location = $5,
             updated_by = $6,
             updated_at = NOW()
         WHERE id = $1
         RETURNING
           id, title, description, starts_at, location,
           created_by, updated_by, created_at, updated_at`,
        [
          oldMeeting.id,
          title.trim(),
          description,
          startsAtUtc,
          location,
          actorId,
        ]
      );

      action = "meeting_updated";
    }

    const meeting = result.rows[0];

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
        action,
        "meeting",
        meeting.id,
        oldMeeting ? JSON.stringify(oldMeeting) : null,
        JSON.stringify(meeting),
      ]
    );

    await client.query("COMMIT");

    return res.status(oldMeeting ? 200 : 201).json({
      success: true,
      message: oldMeeting
        ? "Next meeting updated successfully."
        : "Next meeting scheduled successfully.",
      meeting,
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

// DELETE /api/meetings/next
// The chairperson may delete the next meeting if it has no recorded minutes.
router.delete("/next", canManageMeetings, async (req, res, next) => {
  const actorId = req.session.user.id;
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");
    await client.query("LOCK TABLE meetings IN EXCLUSIVE MODE");

    const existingResult = await client.query(
      `SELECT *
       FROM meetings
       WHERE starts_at >= NOW()
       ORDER BY starts_at ASC
       LIMIT 1
       FOR UPDATE`
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "There is no upcoming meeting to delete.",
      });
    }

    const meeting = existingResult.rows[0];
    const minutesResult = await client.query(
      "SELECT 1 FROM meeting_minutes WHERE meeting_id = $1 LIMIT 1",
      [meeting.id]
    );

    if (minutesResult.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "This meeting has recorded minutes and cannot be deleted.",
      });
    }

    await client.query("DELETE FROM meetings WHERE id = $1", [meeting.id]);
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         old_values
       )
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        actorId,
        "meeting_deleted",
        "meeting",
        meeting.id,
        JSON.stringify(meeting),
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Next meeting deleted successfully.",
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
