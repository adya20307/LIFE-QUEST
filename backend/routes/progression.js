const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const ATTRIBUTE_MAP = {
  coding: "intelligence",
  study: "intelligence",
  programming: "intelligence",
  fitness: "strength",
  gym: "strength",
  workout: "strength",
  meditation: "vitality",
  health: "vitality",
  wellness: "vitality",
  reading: "wisdom",
  books: "wisdom",
  work: "discipline",
  productivity: "discipline",
  habits: "discipline",
  art: "creativity",
  design: "creativity",
  running: "endurance",
  cardio: "endurance",
};

const getRequiredXP = (level) =>
  Math.floor(100 * Math.pow(Number(level), 1.5));

const calculateLevel = (totalXP) => {
  let level = 1;
  let xp = Math.max(Number(totalXP) || 0, 0);

  while (xp >= getRequiredXP(level)) {
    xp -= getRequiredXP(level);
    level += 1;
  }

  return { level, xp };
};

const getAttributeForCategory = (category) =>
  ATTRIBUTE_MAP[String(category || "").trim().toLowerCase()] ||
  "discipline";

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
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const completedResult = await client.query(
      `SELECT xp, gold, category, completed_at
       FROM tasks
       WHERE user_id = $1 AND completed = TRUE
       ORDER BY completed_at DESC`,
      [req.user.userId]
    );

    const totalXP = completedResult.rows.reduce(
      (sum, task) => sum + Math.max(Number(task.xp) || 0, 0),
      0
    );
    const totalGold = completedResult.rows.reduce(
      (sum, task) => sum + Math.max(Number(task.gold) || 0, 0),
      0
    );
    const purchasedRewardsResult = await client.query(
      `SELECT COALESCE(SUM(cost), 0)::INT AS spent_gold
       FROM rewards
       WHERE user_id = $1`,
      [req.user.userId]
    );
    const spentGold = Number(purchasedRewardsResult.rows[0]?.spent_gold || 0);
    const currentGold = Math.max(totalGold - spentGold, 0);
    const progression = calculateLevel(totalXP);
    const dates = new Set(
      completedResult.rows
        .filter((task) => task.completed_at)
        .map((task) => new Date(task.completed_at).toISOString().slice(0, 10))
    );
    const today = new Date();
    let streak = 0;
    let cursor = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ));

    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const attributes = {
      intelligence: 1,
      strength: 1,
      vitality: 1,
      wisdom: 1,
      discipline: 1,
      creativity: 1,
      endurance: 1,
    };
    completedResult.rows.forEach((task) => {
      const attribute = getAttributeForCategory(task.category);
      attributes[attribute] = Math.min(attributes[attribute] + 1, 100);
    });

    await client.query(
      `INSERT INTO character_stats (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.user.userId]
    );
    const statsResult = await client.query(
      `UPDATE character_stats
       SET intelligence = $1,
           strength = $2,
           vitality = $3,
           wisdom = $4,
           discipline = $5,
           creativity = $6,
           endurance = $7
       WHERE user_id = $8
       RETURNING intelligence, strength, vitality, wisdom, discipline, creativity, endurance`,
      [
        attributes.intelligence,
        attributes.strength,
        attributes.vitality,
        attributes.wisdom,
        attributes.discipline,
        attributes.creativity,
        attributes.endurance,
        req.user.userId,
      ]
    );
    const refreshedUser = await client.query(
      `UPDATE users
       SET xp = $1,
           gold = $2,
           level = $3,
           streak = $4,
           last_completed_at = $5
       WHERE id = $6
       RETURNING level, xp, gold, streak`,
      [
        progression.xp,
        currentGold,
        progression.level,
        streak,
        completedResult.rows[0]?.completed_at || null,
        req.user.userId,
      ]
    );

    await client.query("COMMIT");

    const completedCount = completedResult.rows.length;
    const user = refreshedUser.rows[0];
    res.json({
      success: true,
      progression: {
        level: progression.level,
        xp: progression.xp,
        xpToNextLevel: getRequiredXP(progression.level),
        gold: currentGold,
        streak,
        attributes: statsResult.rows[0],
        achievements: [
          {
            id: "first-quest",
            title: "First Quest",
            unlocked: completedCount >= 1,
          },
          {
            id: "five-quests",
            title: "Quest Hunter",
            unlocked: completedCount >= 5,
          },
          {
            id: "ten-quests",
            title: "Dedicated",
            unlocked: completedCount >= 10,
          },
          {
            id: "level-five",
            title: "Level 5",
            unlocked: user.level >= 5,
          },
          {
            id: "seven-day-streak",
            title: "Seven Day Streak",
            unlocked: streak >= 7,
          },
        ],
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Progression rollback error:", rollbackError);
    }

    console.error("Progression error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load progression",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
