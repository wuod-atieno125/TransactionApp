
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
console.log("Loaded app from:", require.resolve("./app"));
const { pool } = require("./config/database");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query("SELECT 1");

    app.listen(PORT, () => {
      console.log(`PATUMAS API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start PATUMAS API:", error);
    await pool.end();
    process.exit(1);
  }
}

startServer();
