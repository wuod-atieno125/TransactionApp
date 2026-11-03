"use strict";

const { isTechnicalAdminPassword } = require("../utils/passwordPolicy");
const { isKenyanMobilePhone } = require("../utils/phoneNumber");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rejectUnknownFields(body, allowed) {
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

function validateRegistration(body) {
  const unknown = rejectUnknownFields(body, [
    "fullName", "full_name", "name",
    "username", "phone", "recoveryEmail", "recovery_email", "email",
    "password"
  ]);
  if (unknown) return unknown;

  const name = firstValue(body, ["fullName", "full_name", "name"]);
  const username = body.username;
  const phone = body.phone;
  const email = firstValue(body, [
    "recoveryEmail", "recovery_email", "email"
  ]);
  const password = body.password;

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
    return "Full name must be between 2 and 120 characters";
  }

  if (
    typeof username !== "string" ||
    !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())
  ) {
    return "Username must be 3 to 30 characters using letters, numbers, or underscores";
  }

  if (!isKenyanMobilePhone(phone)) {
    return "Enter a valid Kenyan mobile number (e.g. 0712 345 678 or +254 712 345 678)";
  }

  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    return "Enter a valid recovery email address";
  }

  if (typeof password !== "string" || password.length < 8 || password.length > 40) {
    return "Password must be between 8 and 40 characters";
  }

  if (!/[A-Za-z]/.test(password)) {
    return "Password must include at least one letter";
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one digit";
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return "Password must include at least one special character";
  }

  return null;
}

function validateLogin(body) {
  const unknown = rejectUnknownFields(body, ["username", "phone", "password"]);
  if (unknown) return unknown;

  const username = body.username;
  const phone = body.phone;
  const password = body.password;

  if (
    typeof username !== "string" ||
    !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())
  ) {
    return "Enter your valid username.";
  }

  if (!isKenyanMobilePhone(phone)) {
    return "Enter your valid registered phone number.";
  }

  if (typeof password !== "string" || password.length < 1 || password.length > 40) {
    return "Password is required and must not exceed 40 characters";
  }

  return null;
}

function validateChangePassword(body, req) {
  const unknown = rejectUnknownFields(body, ["currentPassword", "newPassword"]);
  if (unknown) return unknown;

  if (typeof body.currentPassword !== "string" || body.currentPassword.length < 1 || body.currentPassword.length > 128) {
    return "Enter your current password.";
  }

  const password = body.newPassword;
  if (typeof password !== "string" || password.length < 8 || password.length > 40) {
    return "New password must be between 8 and 40 characters.";
  }
  if (req?.user?.role === "technical_admin" && !isTechnicalAdminPassword(password)) {
    return "Technical Administrator passwords must include uppercase and lowercase letters, a digit, and a special character.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
    return "New password must include a letter, a number, and a special character.";
  }

  return null;
}
function validateForgotPassword(body) {
  const unknown = rejectUnknownFields(body, ["email", "recoveryEmail"]);
  if (unknown) return unknown;

  const email = firstValue(body, ["email", "recoveryEmail"]);

  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !EMAIL_RE.test(email.trim())
  ) {
    return "Enter a valid email address.";
  }

  return null;
}


function validateResetPassword(body) {
  const unknown = rejectUnknownFields(body, [
    "email",
    "code",
    "newPassword",
    "username",
  ]);

  if (unknown) return unknown;

  const email = body.email;

  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !EMAIL_RE.test(email.trim())
  ) {
    return "Enter a valid email address.";
  }

  if (
    typeof body.code !== "string" ||
    !/^\d{6}$/.test(body.code)
  ) {
    return "Enter the six-digit password reset code.";
  }

  const password = body.newPassword;

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 40
  ) {
    return "New password must be between 8 and 40 characters.";
  }

  if (
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  ) {
    return "New password must include a letter, a number, and a special character.";
  }

  if (
    body.username !== undefined &&
    (typeof body.username !== "string" ||
      !/^[a-zA-Z0-9_]{3,30}$/.test(body.username.trim()))
  ) {
    return "Username must be 3 to 30 characters using letters, numbers, or underscores.";
  }

  return null;
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateChangePassword,
  rejectUnknownFields,
  validateForgotPassword,
  validateResetPassword
};
