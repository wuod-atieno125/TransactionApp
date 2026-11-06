"use strict";

const KENYAN_MOBILE_PHONE_RE = /^(?:\+?254|0)(?:7|1)[0-9]{8}$/;

function normalizePhoneInput(value) {
  return typeof value === "string"
    ? value.trim().replace(/[\s().-]/g, "")
    : "";
}

function isKenyanMobilePhone(value) {
  return typeof value === "string" &&
    KENYAN_MOBILE_PHONE_RE.test(normalizePhoneInput(value));
}

module.exports = { isKenyanMobilePhone, normalizePhoneInput };
