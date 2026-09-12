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

const getAttributeForCategory = (category) =>
  ATTRIBUTE_MAP[String(category || "").trim().toLowerCase()] ||
  "discipline";

const calculateLevel = (totalXP) => {
  let level = 1;
  let xp = Math.max(Number(totalXP) || 0, 0);

  while (xp >= getRequiredXP(level)) {
    xp -= getRequiredXP(level);
    level += 1;
  }

  return { level, xp };
};

const rebuildProgression = async (client, userId) => {
  const completedResult = await client.query(
    `SELECT xp, gold, category, completed_at
     FROM tasks
     WHERE user_id = $1 AND completed = TRUE
     ORDER BY completed_at DESC`,
    [userId]
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
    [userId]
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
    [userId]
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
      userId,
    ]
  );
  const userResult = await client.query(
    `UPDATE users
     SET xp = $1,
         gold = $2,
         level = $3,
         streak = $4,
         last_completed_at = $5
     WHERE id = $6
     RETURNING id, name, email, level, xp, gold, streak`,
    [
      progression.xp,
      currentGold,
      progression.level,
      streak,
      completedResult.rows[0]?.completed_at || null,
      userId,
    ]
  );

  return {
    user: userResult.rows[0],
    stats: statsResult.rows[0],
    totalXP,
    level: progression.level,
    xp: progression.xp,
    xpToNextLevel: getRequiredXP(progression.level),
    gold: currentGold,
    streak,
  };
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ============================================
// CREATE TASKS TABLE
// ============================================

const createTasksTable = async () => {
  try {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMP
    `);

    await db.query(`
      ALTER TABLE character_stats
      ADD COLUMN IF NOT EXISTS intelligence INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS wisdom INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS strength INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS vitality INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS discipline INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS creativity INT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS endurance INT NOT NULL DEFAULT 1
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        xp INT DEFAULT 50,
        gold INT DEFAULT 10,
        icon VARCHAR(20) DEFAULT '⚔️',
        color VARCHAR(30) DEFAULT 'purple',
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        reward_xp INT NOT NULL DEFAULT 0,
        reward_gold INT NOT NULL DEFAULT 0,
        reward_attribute VARCHAR(30),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS reward_xp INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reward_gold INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reward_attribute VARCHAR(30)
    `);

    console.log("✅ Tasks table ready");
  } catch (error) {
    console.error("❌ Tasks table error:", error.message);
    throw error;
  }
};

router.ready = createTasksTable();

// ============================================
// GET USER QUESTS
// ============================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      "SELECT id FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const result = await db.query(
      `SELECT
        id,
        title,
        category,
        xp,
        gold,
        icon,
        color,
        completed,
        completed_at,
        created_at
       FROM tasks
       WHERE user_id = $1
       ORDER BY id ASC`,
      [req.user.userId]
    );

    // Create starter quests for a new user
    if (result.rows.length === 0) {
      const starterQuests = [
        [
          "Complete DSA Assignment",
          "Coding",
          120,
          50,
          "💻",
          "purple",
        ],
        [
          "Workout for 30 Minutes",
          "Fitness",
          80,
          30,
          "🏋️",
          "orange",
        ],
        [
          "Read 20 Pages",
          "Reading",
          50,
          20,
          "📚",
          "blue",
        ],
        [
          "Practice JavaScript",
          "Coding",
          100,
          40,
          "⚡",
          "green",
        ],
      ];

      for (const quest of starterQuests) {
        await db.query(
          `INSERT INTO tasks
           (user_id, title, category, xp, gold, icon, color)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.user.userId, ...quest]
        );
      }

      const newResult = await db.query(
        `SELECT
          id,
          title,
          category,
          xp,
          gold,
          icon,
          color,
          completed,
          completed_at,
          created_at
         FROM tasks
         WHERE user_id = $1
         ORDER BY id ASC`,
        [req.user.userId]
      );

      return res.json({
        success: true,
        quests: newResult.rows,
      });
    }

    res.json({
      success: true,
      quests: result.rows,
    });
  } catch (error) {
    console.error("Get quests error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load quests",
    });
  }
});

// ============================================
// CREATE NEW QUEST
// ============================================

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      category,
      xp = 50,
      gold = 10,
      icon = "⚔️",
      color = "purple",
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: "Title and category are required",
      });
    }

    const numericXP = Number(xp);
    const numericGold = Number(gold);
    if (
      !Number.isInteger(numericXP) ||
      numericXP < 1 ||
      numericXP > 100000 ||
      !Number.isInteger(numericGold) ||
      numericGold < 0 ||
      numericGold > 100000
    ) {
      return res.status(400).json({
        success: false,
        message: "XP and gold must be valid non-negative integers",
      });
    }

    const result = await db.query(
      `INSERT INTO tasks
       (user_id, title, category, xp, gold, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.userId,
        title.trim(),
        category,
        numericXP,
        numericGold,
        icon,
        color,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Quest created successfully",
      quest: result.rows[0],
    });
  } catch (error) {
    console.error("Create quest error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create quest",
    });
  }
});

// ============================================
// COMPLETE / UNCOMPLETE QUEST
// ============================================

router.patch("/:id/complete", authenticateToken, async (req, res) => {
  const client = await db.connect();

  try {
    const questId = Number(req.params.id);

    if (!Number.isInteger(questId)) {
      client.release();

      return res.status(400).json({
        success: false,
        message: "Invalid quest ID",
      });
    }

    await client.query("BEGIN");

    // ----------------------------------------
    // Find quest belonging to current user
    // ----------------------------------------

    const existing = await client.query(
      `SELECT *
       FROM tasks
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [questId, req.user.userId]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();

      return res.status(404).json({
        success: false,
        message: "Quest not found",
      });
    }

    const quest = existing.rows[0];
    const priorUserResult = await client.query(
      `SELECT level
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [req.user.userId]
    );
    if (priorUserResult.rows.length === 0) {
      throw new Error("User not found");
    }
    const priorLevel = Number(priorUserResult.rows[0].level || 1);

    // ----------------------------------------
    // If already completed, don't award XP again
    // ----------------------------------------

    if (quest.completed) {
      const incompleteQuest = await client.query(
        `UPDATE tasks
         SET completed = FALSE,
             completed_at = NULL,
             reward_xp = 0,
             reward_gold = 0,
             reward_attribute = NULL
         WHERE id = $1 AND user_id = $2`,
        [questId, req.user.userId]
      );
      const progression = await rebuildProgression(client, req.user.userId);

      await client.query("COMMIT");
      client.release();

      return res.json({
        success: true,
        message: "Quest marked incomplete",
        quest: {
          ...quest,
          completed: incompleteQuest.rowCount > 0 ? false : quest.completed,
          completed_at: null,
        },
        completed: false,
        progression: {
          ...progression,
          attributes: progression.stats,
          levelUp: false,
        },
      });
    }

    // ----------------------------------------
    // Mark quest complete
    // ----------------------------------------

    const completedQuest = await client.query(
      `UPDATE tasks
       SET completed = TRUE,
           completed_at = CURRENT_TIMESTAMP,
           reward_xp = GREATEST(xp, 0),
           reward_gold = GREATEST(gold, 0),
           reward_attribute = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        questId,
        req.user.userId,
        getAttributeForCategory(quest.category),
      ]
    );
    const progression = await rebuildProgression(client, req.user.userId);
    const levelUp = progression.level > priorLevel;
    const levelsGained = Math.max(progression.level - priorLevel, 0);

    // ----------------------------------------
    // COMMIT EVERYTHING
    // ----------------------------------------

    await client.query("COMMIT");
    client.release();

    res.json({
      success: true,
      message: levelUp
        ? `LEVEL UP! You reached Level ${progression.level}! 🚀`
        : "Quest completed! 🎉",

      quest: completedQuest.rows[0],

      rewards: {
        xp: Math.max(Number(quest.xp) || 0, 0),
        gold: Math.max(Number(quest.gold) || 0, 0),
        attribute: getAttributeForCategory(quest.category),
        attributeGain: 1,
      },

      user: progression.user,
      stats: progression.stats,
      progression: {
        ...progression,
        attributes: progression.stats,
        levelUp,
      },

      levelUp,
      levelsGained,
      requiredXP: progression.xpToNextLevel,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    client.release();

    console.error("Complete quest error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to complete quest",
    });
  }
});

// ============================================
// DELETE QUEST
// ============================================

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const questId = Number(req.params.id);

    if (!Number.isInteger(questId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quest ID",
      });
    }

    const result = await db.query(
      `DELETE FROM tasks
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [questId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quest not found",
      });
    }

    res.json({
      success: true,
      message: "Quest deleted successfully",
    });
  } catch (error) {
    console.error("Delete quest error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete quest",
    });
  }
});

module.exports = router;