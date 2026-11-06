const express = require("express");
const { query } = require("../../../config/database");
const { requireAuth, requireRole } = require("../../../shared/middleware/auth");


const router = express.Router();
function getPagination(queryParams) {
  const parseIntegerParam = (value) => {
    if (value === undefined || value === "") {
      return null;
    }

    if (
      typeof value !== "string" ||
      !/^\d+$/.test(value)
    ) {
      return NaN;
    }

    const parsed = Number(value);

    return Number.isSafeInteger(parsed) ? parsed : NaN;
  };

  const parsedLimit = parseIntegerParam(queryParams.limit);
  const parsedOffset = parseIntegerParam(queryParams.offset);

  if (
    Number.isNaN(parsedLimit) ||
    Number.isNaN(parsedOffset) ||
    (parsedLimit !== null && parsedLimit < 1) ||
    (parsedOffset !== null && parsedOffset < 0)
  ) {
    return { error: "Invalid pagination parameters." };
  }

  return {
    limit: parsedLimit === null ? 50 : Math.min(parsedLimit, 100),
    offset: parsedOffset === null ? 0 : parsedOffset,
  };
}
function isValidDateRange(startDate, endDate, maxDays = 366) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !datePattern.test(startDate) ||
    !datePattern.test(endDate)
  ) {
    return false;
  }

  function toUtcDay(value) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return Math.floor(date.getTime() / 86400000);
  }

  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);

  return (
    start !== null &&
    end !== null &&
    end >= start &&
    end - start < maxDays
  );
}

// GET /api/transactions/reversed
router.get(
  "/reversed",
  requireAuth,
  requireRole("chairperson"),
  async (req, res, next) => {
    try {
      const pagination = getPagination(req.query);

      if (pagination.error) {
        return res.status(400).json({
          success: false,
          message: pagination.error,
        });
      }

      const { limit, offset } = pagination;

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
         WHERE status = 'reversed'
         ORDER BY updated_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return res.status(200).json({
        success: true,
        transactions: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/transactions/summary
router.get(
  "/summary",
  requireAuth,
  requireRole("member", "treasurer", "chairperson", "secretary"),
  async (req, res, next) => {
    try {
      const isMember = ["member", "secretary"].includes(
        String(req.session.user.role || "").toLowerCase()
      );

      const result = await query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status = 'active'
           ) AS active_transaction_count,

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'active'
             ),
             0
           ) AS active_contribution_total,

           COUNT(*) FILTER (
             WHERE status = 'reversed'
           ) AS reversed_transaction_count,

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'reversed'
             ),
             0
           ) AS reversed_contribution_total

         FROM transactions
         WHERE ($1::boolean = FALSE OR member_user_id = $2::uuid)`,
        [isMember, req.session.user.id]
      );

      const summary = result.rows[0];

      return res.status(200).json({
        success: true,
        summary: {
          activeTransactionCount: Number(
            summary.active_transaction_count
          ),
          activeContributionTotal: summary.active_contribution_total,
          reversedTransactionCount: Number(
            summary.reversed_transaction_count
          ),
          reversedContributionTotal: summary.reversed_contribution_total,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/transactions/weekly-report?weekStart=YYYY-MM-DD
router.get(
  "/weekly-report",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { weekStart } = req.query;
      let selectedSunday = null;

      if (weekStart !== undefined) {
        if (
          typeof weekStart !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
        ) {
          return res.status(400).json({
            success: false,
            message: "weekStart must be a valid Sunday date in YYYY-MM-DD format.",
          });
        }

        const parsedDate = new Date(`${weekStart}T00:00:00Z`);

        if (
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== weekStart ||
          parsedDate.getUTCDay() !== 0
        ) {
          return res.status(400).json({
            success: false,
            message: "weekStart must be a valid Sunday date in YYYY-MM-DD format.",
          });
        }

        selectedSunday = weekStart;
      }

      const result = await query(
        `WITH local_date AS (
           SELECT
             (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today
         ),
         reporting_week AS (
           SELECT COALESCE(
             $1::date,
             today - EXTRACT(DOW FROM today)::integer
           ) AS sunday
           FROM local_date
         )
         SELECT
           rw.sunday::text AS week_start,
           (rw.sunday + 6)::text AS week_end,
           COUNT(l.id) AS transaction_count,
           COALESCE(SUM(l.amount), 0) AS contribution_total
         FROM reporting_week rw
         LEFT JOIN welfare_ledger_entries l
           ON l.entry_type = 'deposit'
          AND l.created_at >= (
            rw.sunday::timestamp AT TIME ZONE 'Africa/Nairobi'
          )
          AND l.created_at < (
            (rw.sunday + 7)::timestamp AT TIME ZONE 'Africa/Nairobi'
          )
          AND (
            l.source_transaction_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM transactions source_transaction
              WHERE source_transaction.id = l.source_transaction_id
                AND source_transaction.status = 'active'
            )
          )
         GROUP BY rw.sunday`,
        [selectedSunday]
      );

      const report = result.rows[0];

      return res.status(200).json({
        success: true,
        weeklyReport: {
          weekStart: report.week_start,
          weekEnd: report.week_end,
          transactionCount: Number(report.transaction_count),
          contributionTotal: report.contribution_total,
          timezone: "Africa/Nairobi",
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);
// GET /api/transactions/weekly-report/members?weekStart=YYYY-MM-DD
router.get(
  "/weekly-report/members",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { weekStart } = req.query;
      let selectedSunday = null;

      if (weekStart !== undefined) {
        if (
          typeof weekStart !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
        ) {
          return res.status(400).json({
            success: false,
            message: "weekStart must be a valid Sunday date in YYYY-MM-DD format.",
          });
        }

        const parsedDate = new Date(`${weekStart}T00:00:00Z`);

        if (
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== weekStart ||
          parsedDate.getUTCDay() !== 0
        ) {
          return res.status(400).json({
            success: false,
            message: "weekStart must be a valid Sunday date in YYYY-MM-DD format.",
          });
        }

        selectedSunday = weekStart;
      }

      const result = await query(
        `WITH local_date AS (
           SELECT
             (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today
         ),
         reporting_week AS (
           SELECT COALESCE(
             $1::date,
             today - EXTRACT(DOW FROM today)::integer
           ) AS sunday
           FROM local_date
         )
         SELECT
           l.id AS "contributionId",
           l.member_user_id AS "memberUserId",
           COALESCE(u.full_name, 'Unknown contributor') AS "memberName",
           l.amount AS "contributionAmount",
           l.source_payment_reference AS "mpesaReference",
           l.created_at AS "paidAt"
         FROM welfare_ledger_entries l
         CROSS JOIN reporting_week rw
         LEFT JOIN users u ON u.id = l.member_user_id
         WHERE l.entry_type = 'deposit'
           AND l.created_at >= (
             rw.sunday::timestamp AT TIME ZONE 'Africa/Nairobi'
           )
           AND l.created_at < (
             (rw.sunday + 7)::timestamp AT TIME ZONE 'Africa/Nairobi'
           )
           AND (
             l.source_transaction_id IS NULL
             OR EXISTS (
               SELECT 1
               FROM transactions source_transaction
               WHERE source_transaction.id = l.source_transaction_id
                 AND source_transaction.status = 'active'
             )
           )
         ORDER BY l.created_at DESC, u.full_name ASC`,
        [selectedSunday]
      );

      const weekResult = await query(
        `SELECT
           COALESCE(
             $1::date,
             (
               (NOW() AT TIME ZONE 'Africa/Nairobi')::date
               - (
                 EXTRACT(
                   DOW FROM
                   (NOW() AT TIME ZONE 'Africa/Nairobi')::date
                 )::integer
               )
             )
           )::text AS week_start`,
        [selectedSunday]
      );

      const sunday = weekResult.rows[0].week_start;
      const saturday = new Date(`${sunday}T00:00:00Z`);
      saturday.setUTCDate(saturday.getUTCDate() + 6);

      const contributors = new Map();
      const contributions = result.rows.map((row) => {
        const contribution = {
          contributionId: row.contributionId,
          memberUserId: row.memberUserId,
          memberName: row.memberName,
          amount: row.contributionAmount,
          mpesaReference: row.mpesaReference,
          paidAt: row.paidAt,
        };
        const contributor = contributors.get(row.memberUserId) || {
          memberUserId: row.memberUserId,
          memberName: row.memberName,
          transactionCount: 0,
          contributionTotal: 0,
        };
        contributor.transactionCount += 1;
        contributor.contributionTotal += Number(row.contributionAmount);
        contributors.set(row.memberUserId, contributor);
        return contribution;
      });

      return res.status(200).json({
        success: true,
        weeklyReport: {
          weekStart: sunday,
          weekEnd: saturday.toISOString().slice(0, 10),
          timezone: "Africa/Nairobi",
          members: [...contributors.values()].map((contributor) => ({
            ...contributor,
            contributionTotal: contributor.contributionTotal.toFixed(2),
          })),
          contributions,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);
// GET /api/transactions/monthly-report?month=YYYY-MM
router.get(
  "/monthly-report",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { month } = req.query;
      let selectedMonth = null;

      if (month !== undefined) {
        if (
          typeof month !== "string" ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ) {
          return res.status(400).json({
            success: false,
            message: "month must be in YYYY-MM format, such as 2026-10.",
          });
        }

        selectedMonth = `${month}-01`;
      }

      const result = await query(
        `WITH current_month AS (
           SELECT
             date_trunc(
               'month',
               NOW() AT TIME ZONE 'Africa/Nairobi'
             )::date AS month_start
         ),
         reporting_month AS (
           SELECT COALESCE(
             $1::date,
             month_start
           ) AS month_start
           FROM current_month
         )
         SELECT
           rm.month_start AS "monthStart",
           (rm.month_start + INTERVAL '1 month - 1 day')::date
             AS "monthEnd",

           COUNT(l.id) FILTER (
             WHERE l.entry_type = 'deposit'
               AND (
                 l.source_transaction_id IS NULL
                 OR EXISTS (
                   SELECT 1
                   FROM transactions source_transaction
                   WHERE source_transaction.id = l.source_transaction_id
                     AND source_transaction.status = 'active'
                 )
               )
           ) AS "activeTransactionCount",

           COALESCE(
             SUM(l.amount) FILTER (
               WHERE l.entry_type = 'deposit'
                 AND (
                   l.source_transaction_id IS NULL
                   OR EXISTS (
                     SELECT 1
                     FROM transactions source_transaction
                     WHERE source_transaction.id = l.source_transaction_id
                       AND source_transaction.status = 'active'
                   )
                 )
             ),
             0
           ) AS "activeContributionTotal",

           COUNT(l.id) FILTER (
             WHERE l.entry_type = 'reversal'
           ) AS "reversedTransactionCount",

           COALESCE(
             SUM(l.amount) FILTER (
               WHERE l.entry_type = 'reversal'
             ),
             0
           ) AS "reversedContributionTotal"

         FROM reporting_month rm
         LEFT JOIN welfare_ledger_entries l
           ON l.entry_type IN ('deposit', 'reversal')
          AND l.created_at >= (
             rm.month_start::timestamp
             AT TIME ZONE 'Africa/Nairobi'
           )
          AND l.created_at < (
             (rm.month_start + INTERVAL '1 month')::timestamp
             AT TIME ZONE 'Africa/Nairobi'
           )
         GROUP BY rm.month_start`,
        [selectedMonth]
      );

      const report = result.rows[0];

      return res.status(200).json({
        success: true,
        monthlyReport: {
          monthStart: report.monthStart,
          monthEnd: report.monthEnd,
          timezone: "Africa/Nairobi",
          activeTransactionCount: Number(
            report.activeTransactionCount
          ),
          activeContributionTotal: report.activeContributionTotal,
          reversedTransactionCount: Number(
            report.reversedTransactionCount
          ),
          reversedContributionTotal: report.reversedContributionTotal,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);
// GET /api/transactions/monthly-report/members?month=YYYY-MM
router.get(
  "/monthly-report/members",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { month } = req.query;
      let selectedMonth = null;

      if (month !== undefined) {
        if (
          typeof month !== "string" ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ) {
          return res.status(400).json({
            success: false,
            message: "month must be in YYYY-MM format, such as 2026-10.",
          });
        }

        selectedMonth = `${month}-01`;
      }

      const result = await query(
        `WITH current_month AS (
           SELECT date_trunc(
             'month',
             NOW() AT TIME ZONE 'Africa/Nairobi'
           )::date AS month_start
         ),
         reporting_month AS (
           SELECT COALESCE(
             $1::date,
             month_start
           ) AS month_start
           FROM current_month
         )
         SELECT
           l.member_user_id AS "memberUserId",
           COALESCE(u.full_name, 'Unknown contributor') AS "memberName",
           COUNT(l.id) FILTER (
             WHERE l.entry_type = 'deposit'
               AND COALESCE(wt.status, 'active') = 'active'
           ) AS "activeTransactionCount",

           COALESCE(
             SUM(l.amount) FILTER (
               WHERE l.entry_type = 'deposit'
                 AND COALESCE(wt.status, 'active') = 'active'
             ),
             0
           ) AS "activeContributionTotal",

           COUNT(l.id) FILTER (
             WHERE l.entry_type = 'reversal'
           ) AS "reversedTransactionCount",

           COALESCE(
             SUM(l.amount) FILTER (
               WHERE l.entry_type = 'reversal'
             ),
             0
           ) AS "reversedContributionTotal"

         FROM reporting_month rm
         JOIN welfare_ledger_entries l
           ON l.entry_type IN ('deposit', 'reversal')
          AND l.created_at >= (
             rm.month_start::timestamp
             AT TIME ZONE 'Africa/Nairobi'
           )
          AND l.created_at < (
             (rm.month_start + INTERVAL '1 month')::timestamp
             AT TIME ZONE 'Africa/Nairobi'
           )
         LEFT JOIN users u
           ON u.id = l.member_user_id
         LEFT JOIN welfare_transactions wt
           ON wt.id = l.source_transaction_id
         GROUP BY l.member_user_id, u.full_name

         ORDER BY "activeContributionTotal" DESC, "memberName" ASC`,
        [selectedMonth]
      );

      const paymentResult = await query(
        `WITH current_month AS (
           SELECT date_trunc(
             'month',
             NOW() AT TIME ZONE 'Africa/Nairobi'
           )::date AS month_start
         ),
         reporting_month AS (
           SELECT COALESCE($1::date, month_start) AS month_start
           FROM current_month
         )
         SELECT
           l.id AS "contributionId",
           l.source_transaction_id AS "transactionId",
           l.member_user_id AS "memberUserId",
           COALESCE(u.full_name, 'Unknown contributor') AS "memberName",
           l.source_payment_reference AS "mpesaReference",
           l.amount,
           l.created_at AS "paidAt",
           COALESCE(
             wt.status,
             CASE WHEN EXISTS (
               SELECT 1
               FROM welfare_ledger_entries reversal
               WHERE reversal.entry_type = 'reversal'
                 AND reversal.member_user_id = l.member_user_id
                 AND reversal.amount = l.amount
                 AND reversal.created_at = l.created_at
             ) THEN 'reversed' ELSE 'active' END
           ) AS status
         FROM reporting_month rm
         JOIN welfare_ledger_entries l
           ON l.entry_type = 'deposit'
          AND l.created_at >= (
            rm.month_start::timestamp AT TIME ZONE 'Africa/Nairobi'
          )
          AND l.created_at < (
            (rm.month_start + INTERVAL '1 month')::timestamp
            AT TIME ZONE 'Africa/Nairobi'
          )
         LEFT JOIN users u ON u.id = l.member_user_id
         LEFT JOIN welfare_transactions wt
           ON wt.id = l.source_transaction_id
         ORDER BY l.created_at DESC, u.full_name ASC`,
        [selectedMonth]
      );

      const monthResult = await query(
        `SELECT TO_CHAR(
           COALESCE(
             $1::date,
             date_trunc(
               'month',
               NOW() AT TIME ZONE 'Africa/Nairobi'
             )::date
           ),
           'YYYY-MM-DD'
         ) AS month_start`,
        [selectedMonth]
      );

      const monthStart = monthResult.rows[0].month_start;

      const monthEndDate = new Date(`${monthStart}T00:00:00Z`);
      monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
      monthEndDate.setUTCDate(0);

      return res.status(200).json({
        success: true,
        monthlyMemberReport: {
          monthStart,
          monthEnd: monthEndDate.toISOString().slice(0, 10),
          timezone: "Africa/Nairobi",
          members: result.rows.map((row) => ({
            memberUserId: row.memberUserId,
            memberName: row.memberName,
            activeTransactionCount: Number(row.activeTransactionCount),
            activeContributionTotal: row.activeContributionTotal,
            reversedTransactionCount: Number(row.reversedTransactionCount),
            reversedContributionTotal: row.reversedContributionTotal,
          })),
          contributions: paymentResult.rows,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);
// GET /api/transactions/report-summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  "/report-summary",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;


      if (!isValidDateRange(startDate, endDate)) {
        return res.status(400).json({
          success: false,
          message:
      "Invalid date range. Use valid dates in YYYY-MM-DD format, with the end date on or after the start date and a maximum range of 366 calendar days.",
        });
      }

      const result = await query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status = 'active'
           ) AS "activeTransactionCount",

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'active'
             ),
             0
           ) AS "activeContributionTotal",

           COUNT(*) FILTER (
             WHERE status = 'reversed'
           ) AS "reversedTransactionCount",

           COALESCE(
             SUM(amount) FILTER (
               WHERE status = 'reversed'
             ),
             0
           ) AS "reversedContributionTotal"

         FROM transactions
         WHERE paid_at >= (
           $1::date::timestamp AT TIME ZONE 'Africa/Nairobi'
         )
           AND paid_at < (
             ($2::date + 1)::timestamp AT TIME ZONE 'Africa/Nairobi'
           )
           AND status IN ('active', 'reversed')`,
        [startDate, endDate]
      );

      const summary = result.rows[0];

      return res.status(200).json({
        success: true,
        reportSummary: {
          startDate,
          endDate,
          timezone: "Africa/Nairobi",
          activeTransactionCount: Number(
            summary.activeTransactionCount
          ),
          activeContributionTotal: summary.activeContributionTotal,
          reversedTransactionCount: Number(
            summary.reversedTransactionCount
          ),
          reversedContributionTotal: summary.reversedContributionTotal,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);
// GET /api/transactions/export.csv?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  "/export.csv",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;


      if (!isValidDateRange(startDate, endDate)) {
        return res.status(400).json({
          success: false,
          message:
      "Invalid date range. Use valid dates in YYYY-MM-DD format, with the end date on or after the start date and a maximum range of 366 calendar days.",
        });
      }

      const result = await query(
        `SELECT
           t.id AS "transactionId",
           COALESCE(u.full_name, t.entered_member_name) AS "memberName",
           t.member_user_id AS "memberUserId",
           t.amount,
           to_char(
             t.paid_at AT TIME ZONE 'Africa/Nairobi',
             'YYYY-MM-DD HH24:MI:SS'
           ) AS "paidAt",
           t.mpesa_reference AS "mpesaReference",
           t.status,
           t.notes,
           t.created_at AS "createdAt"
         FROM transactions t
         LEFT JOIN users u
           ON u.id = t.member_user_id
         WHERE t.paid_at >= (
           $1::date::timestamp AT TIME ZONE 'Africa/Nairobi'
         )
           AND t.paid_at < (
             ($2::date + 1)::timestamp AT TIME ZONE 'Africa/Nairobi'
           )
           AND t.status IN ('active', 'reversed')
         ORDER BY t.paid_at ASC, t.id ASC`,
        [startDate, endDate]
      );

      function escapeCsv(value) {
        let text = value == null ? "" : String(value);

        // Prevent spreadsheet formula injection in text fields.
        if (/^[\s]*[=+\-@]/.test(text)) {
          text = `'${text}`;
        }

        return `"${text.replace(/"/g, '""')}"`;
      }

      const headers = [
        "Transaction ID",
        "Member Name",
        "Member User ID",
        "Amount",
        "Paid At (Africa/Nairobi)",
        "M-Pesa Reference",
        "Status",
        "Notes",
        "Created At",
      ];

        const rows = result.rows.map((row) => [
        row.transactionId,
        row.memberName,
        row.memberUserId,
        row.amount,
        row.paidAt,
        row.mpesaReference,
        row.status,
        row.notes,
        row.createdAt
          ? new Date(row.createdAt).toISOString()
          : "",
      ]);

      const csv = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
      ].join("\r\n");

      const filename = `contributions_${startDate}_to_${endDate}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Cache-Control", "no-store");

      return res.status(200).send("\uFEFF" + csv);
    } catch (error) {
      return next(error);
    }
  }
);
// GET /api/transactions/monthly-report/members.csv?month=YYYY-MM
router.get(
  "/monthly-report/members.csv",
  requireAuth,
  requireRole("treasurer", "chairperson"),
  async (req, res, next) => {
    try {
      const { month } = req.query;

      if (
        typeof month !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ) {
        return res.status(400).json({
          success: false,
          message: "month is required in YYYY-MM format, such as 2026-10.",
        });
      }

      const monthStart = `${month}-01`;

      const result = await query(
        `WITH reporting_month AS (
           SELECT $1::date AS month_start
         )
         SELECT
           t.member_user_id AS "memberUserId",
           CASE
             WHEN t.member_user_id IS NOT NULL
               THEN COALESCE(u.full_name, t.entered_member_name)
             ELSE t.entered_member_name
           END AS "memberName",

           COUNT(t.id) FILTER (
             WHERE t.status = 'active'
           ) AS "activeTransactionCount",

           COALESCE(
             SUM(t.amount) FILTER (
               WHERE t.status = 'active'
             ),
             0
           ) AS "activeContributionTotal",

           COUNT(t.id) FILTER (
             WHERE t.status = 'reversed'
           ) AS "reversedTransactionCount",

           COALESCE(
             SUM(t.amount) FILTER (
               WHERE t.status = 'reversed'
             ),
             0
           ) AS "reversedContributionTotal"

         FROM reporting_month rm
         JOIN transactions t
           ON t.paid_at >= (
             rm.month_start::timestamp
             AT TIME ZONE 'Africa/Nairobi'
           )
          AND t.paid_at < (
             (rm.month_start + INTERVAL '1 month')::timestamp
             AT TIME ZONE 'Africa/Nairobi'
           )
         LEFT JOIN users u
           ON u.id = t.member_user_id
         WHERE t.status IN ('active', 'reversed')
         GROUP BY
           t.member_user_id,
           CASE
             WHEN t.member_user_id IS NOT NULL
               THEN COALESCE(u.full_name, t.entered_member_name)
             ELSE t.entered_member_name
           END
         ORDER BY
           COALESCE(
             SUM(t.amount) FILTER (
               WHERE t.status = 'active'
             ),
             0
           ) DESC,
           "memberName" ASC`,
        [monthStart]
      );

      function escapeCsv(value) {
        let text = value == null ? "" : String(value);

        // Protect spreadsheet users from formula injection.
        if (/^[\s]*[=+\-@]/.test(text)) {
          text = `'${text}`;
        }

        return `"${text.replace(/"/g, '""')}"`;
      }

      const headers = [
        "Member User ID",
        "Member Name",
        "Active Transaction Count",
        "Active Contribution Total",
        "Reversed Transaction Count",
        "Reversed Contribution Total",
      ];

      const rows = result.rows.map((row) => [
        row.memberUserId,
        row.memberName,
        Number(row.activeTransactionCount),
        row.activeContributionTotal,
        Number(row.reversedTransactionCount),
        row.reversedContributionTotal,
      ]);

      const csv = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
      ].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="monthly_member_summary_${month}.csv"`
      );
      res.setHeader("Cache-Control", "no-store");

      return res.status(200).send("\uFEFF" + csv);
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
