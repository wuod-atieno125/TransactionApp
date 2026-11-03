const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const errorHandler = require("./middleware/errorHandler");
const { createActivityTracker } = require("./middleware/activityTracker");

const { pool } = require("./config/database");
const apiRoutes = require("./routes");

const app = express();
const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured");
}

function getAllowedClientOrigins() {
  const configuredOrigins =
    process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || "";
  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let parsed;

      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`Invalid client origin configured: ${origin}`);
      }

      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.origin !== origin.replace(/\/+$/, "")
      ) {
        throw new Error(
          "CLIENT_ORIGIN must contain comma-separated origins without paths."
        );
      }

      if (
        process.env.NODE_ENV === "production" &&
        (parsed.protocol !== "https:" ||
          ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname))
      ) {
        throw new Error(
          "Production CLIENT_ORIGIN values must use HTTPS and a public hostname."
        );
      }

      return parsed.origin;
    });

  if (process.env.NODE_ENV === "production" && origins.length === 0) {
    throw new Error(
      "CLIENT_ORIGIN must be configured with the deployed frontend origin."
    );
  }

  return origins;
}

const allowedClientOrigins = getAllowedClientOrigins();

function validateFrontendUrl() {
  const configuredUrl = process.env.FRONTEND_URL;

  if (!configuredUrl) {
    throw new Error("FRONTEND_URL must be configured.");
  }

  let frontendUrl;
  try {
    frontendUrl = new URL(configuredUrl);
  } catch {
    throw new Error("FRONTEND_URL must be an absolute web address.");
  }

  if (!["http:", "https:"].includes(frontendUrl.protocol)) {
    throw new Error("FRONTEND_URL must use HTTP or HTTPS.");
  }

  if (!allowedClientOrigins.includes(frontendUrl.origin)) {
    throw new Error(
      "The FRONTEND_URL origin must also be included in CLIENT_ORIGIN."
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    (frontendUrl.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "::1"].includes(frontendUrl.hostname))
  ) {
    throw new Error(
      "Production FRONTEND_URL must use HTTPS and a public hostname."
    );
  }
}

validateFrontendUrl();

// Trust the reverse proxy only in deployments that terminate HTTPS upstream.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedClientOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));


app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
      pruneSessionInterval: 15 * 60, // Clean expired sessions every 15 minutes
    }),
    name: "transaction.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: SESSION_IDLE_TIMEOUT_MS,
    },
  })
);

app.use(createActivityTracker(pool));

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use(errorHandler);

module.exports = app;
