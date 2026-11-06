"use strict";

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const requestedStatus = Number(error.statusCode || error.status);
  const isClientError =
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus < 500;

  const statusCode = isClientError ? requestedStatus : 500;

  if (statusCode >= 500) {
    console.error("Unhandled request error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: isClientError
      ? error.message || "Request failed"
      : "Internal server error",
  });
}

module.exports = errorHandler;