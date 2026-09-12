const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

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


// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ------------------------------
    // Validate input
    // ------------------------------

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ------------------------------
    // Check existing account
    // ------------------------------

    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // ------------------------------
    // Hash password
    // ------------------------------

    const hashedPassword = await bcrypt.hash(password, 12);

    // ------------------------------
    // Create user
    // ------------------------------

    const result = await db.query(
      `INSERT INTO users
        (name, email, password)
       VALUES
        ($1, $2, $3)
       RETURNING
        id,
        name,
        email,
        level,
        xp,
        gold,
        streak`,
      [
        name.trim(),
        normalizedEmail,
        hashedPassword,
      ]
    );

    const user = result.rows[0];

    // ------------------------------
    // Create character stats
    // ------------------------------

    await db.query(
      `INSERT INTO character_stats
        (user_id)
       VALUES
        ($1)`,
      [user.id]
    );

    // ------------------------------
    // Create JWT
    // ------------------------------

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // ------------------------------
    // Response
    // ------------------------------

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user,
    });

  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
});


// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ------------------------------
    // Validate input
    // ------------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ------------------------------
    // Find user
    // ------------------------------

    const result = await db.query(
      `SELECT *
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // ------------------------------
    // Compare password
    // ------------------------------

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ------------------------------
    // Create JWT
    // ------------------------------

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Never send password to frontend
    delete user.password;

    // ------------------------------
    // Response
    // ------------------------------

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});


// ======================================================
// GET CURRENT USER PROFILE
// GET /api/auth/me
// ======================================================

router.get("/me", authenticateToken, async (req, res) => {
  try {
    // Get user information
    const userResult = await db.query(
      `SELECT
        id,
        name,
        email,
        level,
        xp,
        gold,
        streak,
        created_at
       FROM users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    // Get character attributes
    const statsResult = await db.query(
      `SELECT
        strength,
        vitality,
        intelligence,
        wisdom,
        creativity,
        discipline,
        endurance
       FROM character_stats
       WHERE user_id = $1`,
      [req.user.userId]
    );

    const stats = statsResult.rows[0] || {
      strength: 1,
      vitality: 1,
      intelligence: 1,
      wisdom: 1,
      creativity: 1,
      discipline: 1,
      endurance: 1,
    };

    // ------------------------------
    // Return complete profile
    // ------------------------------

    return res.json({
      success: true,
      user: {
        ...user,
        stats,
      },
    });

  } catch (error) {
    console.error("Profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while loading profile",
    });
  }
});


// ======================================================
// LOGOUT
// ======================================================

router.post("/logout", authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});


// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;