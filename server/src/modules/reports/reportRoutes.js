
const express = require("express");
const { query } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);

const canViewReports = requireRole(["treasurer", "chairperson"]);
const TIME_ZONE = "Africa/Nairobi";

function isValidMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return false;
  }

  return true;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isSunday(value) {
  return new Date(`${value}T00:00:00Z`).getUTCDay() === 0;
}

// Convert a Nairobi-local date to its UTC instant.
// Nairobi is UTC+03:00 and does not observe daylight saving time.
function nairobiMidnightUtc(date) {
  return `${date}T00:00:00+03:00`;
}

// GET /api/reports/monthly?month=YYYY-MM
router.get("/monthly", canViewReports, async (req, res, next) => {
  try {
    const { month } = req.query;

    if (!isValidMonth(month)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid month in YYYY-MM format.",
      });
    }

    const result = await query(
      `SELECT
         status,
         COUNT(*)::int AS transaction_count,
         COALESCE(SUM(amount), 0) AS total_amount
       FROM transactions
       WHERE paid_at >= ($1::date::timestamp AT TIME ZONE $3)
         AND paid_at < (($2::date)::timestamp AT TIME ZONE $3)
       GROUP BY status
       ORDER BY status`,
      [
        `${month}-01`,
        nextMonth(month),
        TIME_ZONE,
      ]
    );

    return res.status(200).json({
      success: true,
      month,
      timeZone: TIME_ZONE,
      report: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// Return the first day of the next month.
function nextMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);

  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;

  return `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}-01`;
}

// GET /api/reports/monthly/members?month=YYYY-MM
router.get("/monthly/members", canViewReports, async (req, res, next) => {
  try {
    const { month } = req.query;

    if (!isValidMonth(month)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid month in YYYY-MM format.",
      });
    }

    const result = await query(
      `SELECT
         u.id AS member_id,
         u.full_name AS member_name,
         COUNT(t.id) FILTER (
           WHERE t.status = 'active'
         )::int AS active_transactions,
         COALESCE(
           SUM(t.amount) FILTER (
             WHERE t.status = 'active'
           ), 0
         ) AS active_total,
         COUNT(t.id) FILTER (
           WHERE t.status = 'reversed'
         )::int AS reversed_transactions,
         COALESCE(
           SUM(t.amount) FILTER (
             WHERE t.status = 'reversed'
           ), 0
         ) AS reversed_total
       FROM users u
       LEFT JOIN transactions t
         ON t.member_user_id = u.id
        AND t.paid_at >= ($1::date::timestamp AT TIME ZONE $3)
        AND t.paid_at < ($2::date::timestamp AT TIME ZONE $3)
       WHERE u.role = 'member'
         AND u.deleted_at IS NULL
       GROUP BY u.id, u.full_name
       ORDER BY u.full_name`,
      [
        `${month}-01`,
        nextMonth(month),
        TIME_ZONE,
      ]
    );

    return res.status(200).json({
      success: true,
      month,
      timeZone: TIME_ZONE,
      report: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reports/weekly/members?weekStart=YYYY-MM-DD
// Sunday through Saturday in Africa/Nairobi.
router.get("/weekly/members", canViewReports, async (req, res, next) => {
  try {
    const { weekStart } = req.query;

    if (!isValidDate(weekStart) || !isSunday(weekStart)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid Sunday date in YYYY-MM-DD format for weekStart.",
      });
    }

    const saturday = new Date(
      new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86400000
    )
      .toISOString()
      .slice(0, 10);

    const nextSunday = new Date(
      new Date(`${weekStart}T00:00:00Z`).getTime() + 7 * 86400000
    )
      .toISOString()
      .slice(0, 10);

    const result = await query(
      `SELECT
         u.id AS member_id,
         u.full_name AS member_name,
         COUNT(t.id) FILTER (
           WHERE t.status = 'active'
         )::int AS active_transactions,
         COALESCE(
           SUM(t.amount) FILTER (
             WHERE t.status = 'active'
           ), 0
         ) AS active_total,
         COUNT(t.id) FILTER (
           WHERE t.status = 'reversed'
         )::int AS reversed_transactions,
         COALESCE(
           SUM(t.amount) FILTER (
             WHERE t.status = 'reversed'
           ), 0
         ) AS reversed_total
       FROM users u
       LEFT JOIN transactions t
         ON t.member_user_id = u.id
        AND t.paid_at >= ($1::date::timestamp AT TIME ZONE $3)
        AND t.paid_at < ($2::date::timestamp AT TIME ZONE $3)
       WHERE u.role = 'member'
         AND u.deleted_at IS NULL
       GROUP BY u.id, u.full_name
       ORDER BY u.full_name`,
      [
        weekStart,
        nextSunday,
        TIME_ZONE,
      ]
    );

    return res.status(200).json({
      success: true,
      weekStart,
      weekEnd: saturday,
      timeZone: TIME_ZONE,
      report: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/reports/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Inclusive Nairobi-local date range; Sundays are included.
router.get("/summary", canViewReports, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate) ||
      endDate < startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid startDate and endDate values in YYYY-MM-DD format.",
      });
    }

    const result = await query(
      `SELECT
         status,
         COUNT(*)::int AS transaction_count,
         COALESCE(SUM(amount), 0) AS total_amount
       FROM transactions
       WHERE paid_at >= ($1::date::timestamp AT TIME ZONE $3)
         AND paid_at < (($2::date + 1)::timestamp AT TIME ZONE $3)
       GROUP BY status
       ORDER BY status`,
      [startDate, endDate, TIME_ZONE]
    );

    return res.status(200).json({
      success: true,
      startDate,
      endDate,
      timeZone: TIME_ZONE,
      report: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
