
"use strict";

const crypto = require("node:crypto");
const { getClient, query } = require("../../config/database");
const { sendEmailVerificationCode } = require("../../shared/adapters/emailService");

function authError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashCode(code) {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.EMAIL_VERIFICATION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET or EMAIL_VERIFICATION_SECRET must be configured."
    );
  }

  return crypto
    .createHmac("sha256", secret)
    .update(String(code))
    .digest("hex");
}

async function sendCode(emailValue) {
  const email = normalizeEmail(emailValue);

  const existing = await query(
    "SELECT 1 FROM users WHERE normalized_email = $1 LIMIT 1",
    [email]
  );

  if (existing.rowCount) {
    throw authError(
      "An account with that email already exists.",
      409
    );
  }

  const code = String(crypto.randomInt(100000, 1000000));

  await query(
    `INSERT INTO email_verification_codes
       (normalized_email, code_hash, expires_at, attempts,
        verified_at, created_at)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NULL, NOW())
     ON CONFLICT (normalized_email) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       verified_at = NULL,
       created_at = NOW()`,
    [email, hashCode(code)]
  );

  await sendEmailVerificationCode(email, code);

  return {
    message:
      "A verification code has been sent to your email. It expires in 10 minutes."
  };
}

async function verifyCode(emailValue, codeValue) {
  const email = normalizeEmail(emailValue);
  const code = String(codeValue || "").trim();

  if (!/^\d{6}$/.test(code)) {
    throw authError("Enter the six-digit verification code.", 400);
  }

  const client = await getClient();
  let failure;

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT code_hash, expires_at, attempts, verified_at
         FROM email_verification_codes
        WHERE normalized_email = $1
        FOR UPDATE`,
      [email]
    );

    const record = result.rows[0];

    if (!record) {
      failure = authError(
        "Request a verification code first.",
        400
      );
    } else if (new Date(record.expires_at).getTime() <= Date.now()) {
      await client.query(
        "DELETE FROM email_verification_codes WHERE normalized_email = $1",
        [email]
      );

      failure = authError(
        "The verification code has expired. Request a new code.",
        400
      );
    } else if (record.verified_at) {
      await client.query("COMMIT");
      return { message: "Email verified successfully." };
    } else if (record.attempts >= 5) {
      failure = authError(
        "Too many incorrect attempts. Request a new verification code.",
        429
      );
    } else {
      const submittedHash = Buffer.from(hashCode(code), "hex");
      const storedHash = Buffer.from(record.code_hash, "hex");

      if (!crypto.timingSafeEqual(submittedHash, storedHash)) {
        await client.query(
          `UPDATE email_verification_codes
              SET attempts = attempts + 1
            WHERE normalized_email = $1`,
          [email]
        );

        failure = authError("Incorrect verification code.", 400);
      } else {
        await client.query(
          `UPDATE email_verification_codes
              SET verified_at = NOW()
            WHERE normalized_email = $1`,
          [email]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  if (failure) throw failure;

  return {
    message:
      "Email verified successfully. You can now create your account."
  };
}

module.exports = { sendCode, verifyCode };
