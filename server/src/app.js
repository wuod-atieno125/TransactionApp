const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const errorHandler = require("./shared/middleware/errorHandler");
const { createActivityTracker } = require("./shared/middleware/activityTracker");

const { pool } = require("./config/database");
const {
  getAllowedClientOrigins,
  validateFrontendUrl,
} = require("./config/environment");
const { createCorsOptions } = require("./config/cors");
const apiRoutes = require("./modules");

const app = express();
const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured");
}

const allowedClientOrigins = getAllowedClientOrigins();
validateFrontendUrl(allowedClientOrigins);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(helmet());
app.use(cors(createCorsOptions(allowedClientOrigins)));

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
