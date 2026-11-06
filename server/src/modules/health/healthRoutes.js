const express = require("express");
const { query } = require("../../config/database");

const router = express.Router();

// GET /api/health
router.get("/", async (req, res) => {
  try {
    await query("SELECT 1");

    return res.status(200).json({
      success: true,
      message: "Application and database are healthy.",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database is unavailable.",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;