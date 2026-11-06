
const express = require("express");
const { query, pool } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateRuleInput(body) {
  const { content } = body || {};

  if (
    typeof content !== "string" ||
    content.trim().length === 0 ||
    content.trim().length > 20000
  ) {
    return "Rule content is required and must not exceed 20000 characters.";
  }

  return null;
}

// GET /api/group-rules
// Return the current version of the group rules.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, version, content, created_by, created_at
       FROM group_rules
       ORDER BY version DESC
       LIMIT 1`
    );

    return res.status(200).json({
      success: true,
      rule: result.rows[0] || null,
    });
  } catch (error) {
    return next(error);
  }
});
// GET /api/group-rules/history
// Return all rule versions, newest first.
router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, version, content, created_by, created_at
       FROM group_rules
       ORDER BY version DESC`
    );

    return res.status(200).json({
      success: true,
      rules: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/group-rules/:id
// Return a specific historical version.
router.get("/:id", requireAuth, async (req, res, next) => {
  const { id } = req.params;

  if (!UUID_PATTERN.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid rule ID.",
    });
  }

  try {
    const result = await query(
      `SELECT id, version, content, created_by, created_at
       FROM group_rules
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Group rule version not found.",
      });
    }

    return res.status(200).json({
      success: true,
      rule: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/group-rules
// Create the first version or append a new version.
router.post(
  "/",
  requireAuth,
  requireRole("chairperson"),
  async (req, res, next) => {
    const validationError = validateRuleInput(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Serialize version creation to prevent concurrent requests
      // from trying to create the same next version.
      await client.query(
        "LOCK TABLE group_rules IN EXCLUSIVE MODE"
      );

      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM group_rules`
      );

      const nextVersion = Number(versionResult.rows[0].next_version);
      const content = req.body.content.trim();

      const insertResult = await client.query(
        `INSERT INTO group_rules (version, content, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, version, content, created_by, created_at`,
        [nextVersion, content, req.session.user.id]
      );

      const rule = insertResult.rows[0];

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
          req.session.user.id,
          "group_rule_created",
          "group_rule",
          rule.id,
          null,
          JSON.stringify(rule),
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Group rule version created successfully.",
        rule,
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      return next(error);
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;
