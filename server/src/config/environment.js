const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

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

function validateFrontendUrl(allowedClientOrigins) {
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

module.exports = {
  getAllowedClientOrigins,
  validateFrontendUrl,
};
