"use strict";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuidParam(paramName = "id") {
  return function uuidParamValidator(value) {
    const id = value && value[paramName];

    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return `Invalid ${paramName}`;
    }

    return null;
  };
}

function validateDecision(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const unknown = Object.keys(body).filter(
    (key) => !["decision", "status"].includes(key)
  );
  if (unknown.length) return `Unknown field(s): ${unknown.join(", ")}`;

  const decision = String(body.decision ?? body.status ?? "").toLowerCase();

  if (!["approve", "approved", "reject", "rejected"].includes(decision)) {
    return "Decision must be approve or reject";
  }

  return null;
}

function validateMemberStatus(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const unknown = Object.keys(body).filter(
    (key) => !["status", "accountStatus", "account_status"].includes(key)
  );
  if (unknown.length) return `Unknown field(s): ${unknown.join(", ")}`;

  const status = String(
    body.status ?? body.accountStatus ?? body.account_status ?? ""
  ).toLowerCase();

  if (!["approved", "disabled"].includes(status)) {
    return "Member status must be approved or disabled";
  }

  return null;
}

function validatePagination(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return "Query parameters must be an object";
  }

  const unknown = Object.keys(query).filter(
    (key) => !["page", "limit"].includes(key)
  );
  if (unknown.length) return `Unknown query parameter(s): ${unknown.join(", ")}`;

  for (const key of ["page", "limit"]) {
    if (query[key] === undefined) continue;

    const value = Number(query[key]);

    if (!Number.isInteger(value) || value < 1) {
      return `${key} must be a positive integer`;
    }

    if (key === "limit" && value > 100) {
      return "limit must not exceed 100";
    }
  }

  return null;
}

module.exports = {
  UUID_RE,
  validateUuidParam,
  validateDecision,
  validateMemberStatus,
  validatePagination
};
