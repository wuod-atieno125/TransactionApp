
const express = require("express");
const { query, getClient } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);

const canManageSettings = requireRole(["chairperson"]);
const canViewSettings = requireRole([
  "chairperson",
  "treasurer",
  "secretary",
]);

const SETTING_KEY_REGEX = /^[a-z][a-z0-9_]{0,99}$/;

// GET /api/settings
// Chairperson, treasurer, and secretary can view settings.
router.get("/", canViewSettings, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT setting_key, setting_value, updated_at
       FROM system_settings
       ORDER BY setting_key ASC`
    );

    return res.status(200).json({
      success: true,
      settings: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/settings/:key
// Only the chairperson can create or update settings.
router.put("/:key", canManageSettings, async (req, res, next) => {
  const { key } = req.params;
  const { value } = req.body || {};

  if (!SETTING_KEY_REGEX.test(key)) {
    return res.status(400).json({
      success: false,
      message:
        "Setting key must start with a lowercase letter and contain only lowercase letters, numbers, or underscores, up to 100 characters.",
    });
  }

  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: "Setting value must be non-empty text of at most 2000 characters.",
    });
  }

  const normalizedValue = value.trim();
  const actorId = req.session.user.id;
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const oldResult = await client.query(
      `SELECT setting_key, setting_value, updated_by, updated_at
       FROM system_settings
       WHERE setting_key = $1
       FOR UPDATE`,
      [key]
    );

    const oldSetting = oldResult.rows[0] || null;

    const result = await client.query(
      `INSERT INTO system_settings (
         setting_key,
         setting_value,
         updated_by,
         updated_at
       )
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING setting_key, setting_value, updated_by, updated_at`,
      [key, normalizedValue, actorId]
    );

    const setting = result.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         action,
         target_type,
         old_values,
         new_values
       )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        actorId,
        oldSetting ? "system_setting_updated" : "system_setting_created",
        "system_setting",
        JSON.stringify(oldSetting),
        JSON.stringify(setting),
      ]
    );

    await client.query("COMMIT");

    return res.status(oldSetting ? 200 : 201).json({
      success: true,
      message: oldSetting
        ? "System setting updated successfully."
        : "System setting created successfully.",
      setting,
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
