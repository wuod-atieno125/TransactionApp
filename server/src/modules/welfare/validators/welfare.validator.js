"use strict";

const { UUID_RE } = require("../../members/memberValidator");

const ALLOWED_FIELDS = [
  "memberUserId", "member_user_id", "memberId",
  "enteredMemberName", "entered_member_name", "memberName",
  "amount", "paidAt", "paid_at", "date",
  "mpesaReference", "mpesa_reference", "mpesaRef",
  "notes"
];

function rejectUnknownFields(body, allowed = ALLOWED_FIELDS) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  return unknown.length
    ? `Unknown field(s): ${unknown.join(", ")}`
    : null;
}

function firstValue(body, names) {
  for (const name of names) {
    if (body[name] !== undefined) return body[name];
  }
  return undefined;
}

function validateTransactionFields(body, { partial = false } = {}) {
  const unknown = rejectUnknownFields(body);
  if (unknown) return unknown;

  if (partial && Object.keys(body).length === 0) {
    return "At least one field must be provided for an update";
  }

  const memberId = firstValue(body, [
    "memberUserId", "member_user_id", "memberId"
  ]);

  if (memberId !== undefined && memberId !== null && memberId !== "") {
    if (typeof memberId !== "string" || !UUID_RE.test(memberId)) {
      return "Member user ID must be a valid UUID";
    }
  }

  const memberName = firstValue(body, [
    "enteredMemberName", "entered_member_name", "memberName"
  ]);

  if (memberName !== undefined) {
    if (
      typeof memberName !== "string" ||
      memberName.trim().length > 120
    ) {
      return "Entered member name must not exceed 120 characters";
    }
  }

  if (!partial || body.amount !== undefined) {
    const amount = body.amount;
    const numericAmount =
      typeof amount === "number" || typeof amount === "string"
        ? Number(amount)
        : NaN;

    if (
      amount === "" ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > 9999999999.99 ||
      !/^\d+(\.\d{1,2})?$/.test(String(amount))
    ) {
      return "Amount must be positive and have no more than two decimal places";
    }
  }

  const paidAt = firstValue(body, ["paidAt", "paid_at", "date"]);

  if (paidAt !== undefined) {
    if (
      typeof paidAt !== "string" ||
      paidAt.trim() === "" ||
      Number.isNaN(Date.parse(paidAt))
    ) {
      return "Payment date invalid";
    }
  }

  const mpesaReference = firstValue(body, [
    "mpesaReference", "mpesa_reference", "mpesaRef"
  ]);

  if (mpesaReference !== undefined && mpesaReference !== null) {
    if (
      typeof mpesaReference !== "string" ||
      mpesaReference.trim().length > 100
    ) {
      return "M-Pesa reference must not exceed 100 characters";
    }
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) {
      return "Notes must not exceed 2000 characters";
    }
  }

  return null;
}

function validateTransaction(body) {
  return validateTransactionFields(body);
}

function validateTransactionUpdate(body) {
  return validateTransactionFields(body, { partial: true });
}

module.exports = {
  validateTransaction,
  validateTransactionUpdate,
  rejectUnknownFields
};
