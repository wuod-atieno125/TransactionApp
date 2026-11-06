const express = require("express");
const { query } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(["chairperson", "treasurer"]));

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIT_LOG_COLUMNS = `
  al.id,
  al.actor_user_id,
  u.full_name AS actor_name,
  u.role AS actor_role,
  al.action,
  al.target_type,
  al.target_id,
  al.old_values,
  al.new_values,
  al.created_at`;

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isValidPositiveInteger(value) {
  return (
    typeof value === "string" &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

// GET /api/audit
// List audit logs with pagination and optional filters.
router.get("/", async (req, res, next) => {
  const pageValue = req.query.page ?? "1";
  const limitValue = req.query.limit ?? "20";

  if (
    !isValidPositiveInteger(pageValue) ||
    !isValidPositiveInteger(limitValue)
  ) {
    return res.status(400).json({
      success: false,
      message: "Page and limit must be positive integers.",
    });
  }

  const page = Number(pageValue);
  const limit = Number(limitValue);

  if (limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
    return res.status(400).json({
      success: false,
      message: "Limit cannot exceed 100 and pagination must be within a supported range.",
    });
  }

  const {
    action,
    targetType,
    actorUserId,
    startDate,
    endDate,
  } = req.query;

  // Reject repeated query parameters instead of treating arrays as values.
  for (const value of [
    action,
    targetType,
    actorUserId,
    startDate,
    endDate,
  ]) {
    if (value !== undefined && typeof value !== "string") {
      return res.status(400).json({
        success: false,
        message: "Each filter must be supplied only once as a string.",
      });
    }
  }

  if (actorUserId && !UUID_REGEX.test(actorUserId)) {
    return res.status(400).json({
      success: false,
      message: "actorUserId must be a valid UUID.",
    });
  }

  if (startDate && !isValidDate(startDate)) {
    return res.status(400).json({
      success: false,
      message: "startDate must be a valid date in YYYY-MM-DD format.",
    });
  }

  if (endDate && !isValidDate(endDate)) {
    return res.status(400).json({
      success: false,
      message: "endDate must be a valid date in YYYY-MM-DD format.",
    });
  }

  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({
      success: false,
      message: "startDate cannot be after endDate.",
    });
  }

  const conditions = [];
  const params = [];

  function addFilter(sql, value) {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  }

  if (action) addFilter("al.action = ?", action);
  if (targetType) addFilter("al.target_type = ?", targetType);
  if (actorUserId) addFilter("al.actor_user_id = ?::uuid", actorUserId);

  if (startDate) {
    addFilter("al.created_at >= ?::date", startDate);
  }

  if (endDate) {
    addFilter(
      "al.created_at < (?::date + INTERVAL '1 day')",
      endDate
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const offset = (page - 1) * limit;

  try {
    const countResult = await query(
      `SELECT COUNT(*)::text AS total
       FROM audit_logs al
       ${whereClause}`,
      params
    );

    const total = countResult.rows[0].total;

    const result = await query(
      `SELECT
         ${AUDIT_LOG_COLUMNS}
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       ${whereClause}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(Number(total) / limit),
      },
      auditLogs: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/audit/:id
// Retrieve one audit entry using its PostgreSQL bigint ID.
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

  if (
    !/^[1-9]\d*$/.test(id) ||
    id.length > 19 ||
    (id.length === 19 && id > "9223372036854775807")
  ) {
    return res.status(400).json({
      success: false,
      message: "Audit log ID must be a valid positive bigint.",
    });
  }

  try {
    const result = await query(
      `SELECT
         ${AUDIT_LOG_COLUMNS}
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE al.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Audit log entry not found.",
      });
    }

    return res.status(200).json({
      success: true,
      auditLog: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
