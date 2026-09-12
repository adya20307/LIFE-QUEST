const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const REWARD_CATALOG = [
  { id: "focus-break", name: "30-minute focus break", cost: 25 },
  { id: "favorite-snack", name: "Favorite snack", cost: 50 },
  { id: "movie-night", name: "Movie night", cost: 100 },
];

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    req.user = jwt.verify(
      authHeader.slice("Bearer ".length),
      process.env.JWT_SECRET
    );
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

router.get("/", authenticateToken, async (req, res) => {
  try {
    const purchased = await db.query(
      `SELECT id, name, cost, purchased_at
       FROM rewards
       WHERE user_id = $1
       ORDER BY purchased_at DESC`,
      [req.user.userId]
    );

    res.json({
      success: true,
      catalog: REWARD_CATALOG,
      purchased: purchased.rows,
    });
  } catch (error) {
    console.error("Get rewards error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load rewards",
    });
  }
});

router.post("/purchase", authenticateToken, async (req, res) => {
  const client = await db.connect();

  try {
    const reward = REWARD_CATALOG.find((item) => item.id === req.body.rewardId);
    if (!reward) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward",
      });
    }

    await client.query("BEGIN");
    const userResult = await client.query(
      "SELECT gold FROM users WHERE id = $1 FOR UPDATE",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const gold = Number(userResult.rows[0].gold || 0);
    if (gold < reward.cost) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Insufficient gold",
      });
    }

    const purchased = await client.query(
      `INSERT INTO rewards (user_id, name, cost)
       VALUES ($1, $2, $3)
       RETURNING id, name, cost, purchased_at`,
      [req.user.userId, reward.name, reward.cost]
    );
    const updatedUser = await client.query(
      `UPDATE users
       SET gold = gold - $1
       WHERE id = $2
       RETURNING gold`,
      [reward.cost, req.user.userId]
    );

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      reward: purchased.rows[0],
      gold: Number(updatedUser.rows[0].gold),
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Reward rollback error:", rollbackError);
    }

    console.error("Purchase reward error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to purchase reward",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
