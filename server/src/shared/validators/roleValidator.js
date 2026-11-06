"use strict";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateRoleTransfer(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const allowed = [
    "successorUserId", "successor_user_id", "successorId",
    "role", "officeRole", "office_role"
  ];

  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) return `Unknown field(s): ${unknown.join(", ")}`;

  const successorId =
    body.successorUserId ?? body.successor_user_id ?? body.successorId;

  if (typeof successorId !== "string" || !UUID_RE.test(successorId)) {
    return "A valid successor user ID is required";
  }

  const role = body.role ?? body.officeRole ?? body.office_role;

  if (
    role !== undefined &&
    !["treasurer", "chairperson", "secretary"].includes(
      String(role).toLowerCase()
    )
  ) {
    return "Role must be treasurer, chairperson, or secretary";
  }

  return null;
}

module.exports = { validateRoleTransfer };
