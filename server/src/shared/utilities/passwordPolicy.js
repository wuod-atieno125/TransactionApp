"use strict";

function isTechnicalAdminPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 40 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password)
  );
}

module.exports = { isTechnicalAdminPassword };
