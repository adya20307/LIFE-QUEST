const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const authRoutes = require("./routes/auth");
const questRoutes = require("./routes/quests");
const progressionRoutes = require("./routes/progression");
const rewardRoutes = require("./routes/rewards");
// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/quests", questRoutes);
app.use("/api/progression", progressionRoutes);
app.use("/api/rewards", rewardRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "LIFE//QUEST API is running 🚀"
  });
});

// Database test route
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");

    res.json({
      success: true,
      message: "PostgreSQL connected successfully ✅",
      time: result.rows[0].now
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed ❌"
    });
  }
});

// Start server
const startServer = async () => {
  await questRoutes.ready;
  app.listen(PORT, () => {
    console.log(`🚀 LIFE//QUEST backend running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("❌ Backend startup failed:", error);
  process.exitCode = 1;
});