"use strict";

function getActivityType(method, path) {
  if (method === "POST" && path === "/api/auth/register") {
    return "registrations";
  }
  if (method === "POST" && path === "/api/auth/login") {
    return "logins";
  }
  if (
    method === "POST" &&
    ["/api/auth/forgot-password", "/api/auth/reset-password"].includes(path)
  ) {
    return "password_resets";
  }
  if (method === "PUT" && path === "/api/members/me/profile-picture") {
    return "picture_uploads";
  }
  if (method === "POST" && path === "/api/transactions") {
    return "transaction_recordings";
  }
  if (
    method === "PATCH" &&
    (
      /^\/api\/transactions\/[0-9a-f-]+\/reverse$/i.test(path) ||
      /^\/api\/transactions\/reversal-requests\/[0-9a-f-]+$/i.test(path)
    )
  ) {
    return "reversal_requests";
  }
  if (
    method === "GET" &&
    (
      path.startsWith("/api/reports/") ||
      path === "/api/transactions/weekly-report" ||
      path === "/api/transactions/weekly-report/members"
    )
  ) {
    return "report_generations";
  }
  if (method === "POST" && path === "/api/auth/logout") {
    return "logouts";
  }
  if (
    (method === "POST" && path === "/api/members/me/deletion-request") ||
    (method === "PATCH" && /^\/api\/admin\/member-deletion-requests\/[0-9a-f-]+$/i.test(path)) ||
    (method === "DELETE" && /^\/api\/admin\/members\/[0-9a-f-]+$/i.test(path))
  ) {
    return "account_deletions";
  }

  return null;
}

function createActivityTracker(pool) {
  return function trackActivity(req, res, next) {
    const eventType = getActivityType(req.method, req.path);
    if (!eventType) return next();

    const actorUserId = req.user?.id || req.session?.user?.id || null;

    res.once("finish", () => {
      const outcome = res.statusCode >= 400 ? "error" : "success";
      pool.query(
        `INSERT INTO application_activity_events (
           event_type, outcome, actor_user_id
         )
         VALUES ($1, $2, $3)`,
        [eventType, outcome, actorUserId]
      ).catch((error) => {
        console.error("Unable to record application activity:", error);
      });
    });

    return next();
  };
}

module.exports = { createActivityTracker, getActivityType };
