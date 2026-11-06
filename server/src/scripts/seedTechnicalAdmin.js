
"use strict";

const path = require("path");

const useProduction = process.argv.includes("--production");

require("dotenv").config({
  path: path.resolve(__dirname, useProduction
    ? "../../.env.production"
    : "../../.env"),
  override: true,
});

const bcrypt = require("bcryptjs");
const readline = require("readline");
const { pool } = require("../config/database");
const { isTechnicalAdminPassword } = require("../shared/utilities/passwordPolicy");

const CONFIRMATION_FLAG = "--confirm-initial-technical-admin";
const LOCK_KEY = "gcms_initial_technical_admin_bootstrap";

function ask(rl, prompt, { secret = false } = {}) {
  return new Promise((resolve) => {
    if (secret) {
      rl.stdoutMuted = true;
    }

    rl.question(prompt, (answer) => {
      if (secret) {
        rl.stdoutMuted = false;
        rl.output.write("\n");
      }

      resolve(answer);
    });
  });
}

function normalizePhone(value) {
  return String(value || "").trim().replace(/[^\d+]/g, "");
}

function validPhone(phone) {
  return /^\+?[0-9]{9,15}$/.test(phone);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    console.error(
      "Setup blocked. To explicitly authorize initial Technical Administrator setup, run:\n" +
      `node src/scripts/seedTechnicalAdmin.js ${CONFIRMATION_FLAG}`
    );
    process.exitCode = 1;
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("Run this script directly in an interactive terminal.");
    process.exitCode = 1;
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not configured.");
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.stdoutMuted = false;
  rl._writeToOutput = function (value) {
    if (this.stdoutMuted) {
      this.output.write(value.replace(/[^\r\n]/g, "*"));
    } else {
      this.output.write(value);
    }
  };

  let client;
  let transactionStarted = false;

  try {
    console.log("\n=== INITIAL GCMS TECHNICAL ADMINISTRATOR SETUP ===");
    console.log("This is for first-time system administrator setup only.");
    console.log("This account manages system roles; it does not automatically grant group office permissions.\n");

    const fullName = (await ask(rl, "Technical Administrator full name: ")).trim();
    const phone = normalizePhone(await ask(rl, "Phone number: "));
    const email = (await ask(rl, "Recovery email: ")).trim().toLowerCase();

    const password = await ask(rl, "New password (8-40 characters; uppercase, lowercase, digit, special character; hidden): ", {
      secret: true,
    });
    const confirmation = await ask(rl, "Confirm password (hidden): ", {
      secret: true,
    });

    if (fullName.length < 2 || fullName.length > 120) {
      throw new Error("Name must be between 2 and 120 characters.");
    }

    if (!validPhone(phone)) {
      throw new Error("Enter a valid phone number with 9–15 digits.");
    }

    if (!validEmail(email) || email.length > 254) {
      throw new Error("Enter a valid recovery email address.");
    }

    if (!isTechnicalAdminPassword(password)) {
      throw new Error(
        "Password must be 8-40 characters and include uppercase and lowercase letters, a digit, and a special character."
      );
    }

    if (password !== confirmation) {
      throw new Error("Passwords do not match.");
    }

    const accepted = (
      await ask(
        rl,
        `\nCreate an APPROVED Technical Administrator account for "${fullName}"? Type YES to continue: `
      )
    ).trim();

    if (accepted !== "YES") {
      console.log("Setup cancelled. No database changes were made.");
      return;
    }

    // Hash before opening the transaction to keep the DB lock brief.
    const passwordHash = await bcrypt.hash(password, 12);

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    // Serialize simultaneous attempts to bootstrap this system role.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [LOCK_KEY]
    );

    const existingAdmin = await client.query(
      `SELECT id
         FROM users
        WHERE role = 'technical_admin'
          AND deleted_at IS NULL
        LIMIT 1`
    );

    if (existingAdmin.rowCount > 0) {
      throw new Error(
        "A non-deleted Technical Administrator already exists. " +
        "Bootstrap refused; inspect the existing account instead."
      );
    }

    const existingContact = await client.query(
      `SELECT id
         FROM users
        WHERE deleted_at IS NULL
          AND (
            normalized_phone = $1
            OR normalized_email = $2
          )
        LIMIT 1`,
      [phone, email]
    );

    if (existingContact.rowCount > 0) {
      throw new Error(
        "That phone number or recovery email is already in use. " +
        "No account was created."
      );
    }

    const created = await client.query(
      `INSERT INTO users (
         full_name,
         phone,
         normalized_phone,
         recovery_email,
         normalized_email,
         password_hash,
         role,
         account_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'technical_admin', 'approved')
       RETURNING id, full_name, role, account_status`,
      [fullName, phone, phone, email, email, passwordHash]
    );

    const user = created.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         new_values
       )
       VALUES (
         NULL,
         'initial_technical_admin_bootstrap',
         'user',
         $1,
         $2::jsonb
       )`,
      [
        user.id,
        JSON.stringify({
          role: user.role,
          account_status: user.account_status,
        }),
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    console.log("\nInitial Technical Administrator account created successfully.");
    console.log("Account ID:", user.id);
    console.log("Role:", user.role);
    console.log("Status:", user.account_status);
    console.log("The password was hashed and is not stored as plain text.");
    console.log("Keep the password private. It will not be displayed again.");
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError.message);
      }
    }

    console.error("\nSetup failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();

    if (client) {
      client.release();
    }

    await pool.end();
  }
}

main();
