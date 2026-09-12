import { useState } from "react";

const API_URL = "http://localhost:5000";

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Clean input
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      // Frontend validation
      if (mode === "register" && cleanName.length < 2) {
        throw new Error("Player name must be at least 2 characters");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const body =
        mode === "login"
          ? {
              email: cleanEmail,
              password,
            }
          : {
              name: cleanName,
              email: cleanEmail,
              password,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // Safely read server response
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed");
      }

      // Save JWT token
      localStorage.setItem(
        "lifequest_token",
        data.token
      );

      // Save logged-in user
      const loggedInUser = {
        id: data.user?.id,
        name: data.user?.name || cleanName || "Player",
        email: data.user?.email || cleanEmail,
      };

      localStorage.setItem(
        "lifequest_user",
        JSON.stringify(loggedInUser)
      );

      // Tell App.jsx that login was successful
      onLogin(loggedInUser);

    } catch (err) {
      console.error("Authentication error:", err);

      if (err.name === "TypeError") {
        setError(
          "Cannot connect to LIFE//QUEST server. Make sure the backend is running."
        );
      } else {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setName("");
    setEmail("");
    setPassword("");
    setError("");
    setSuccess("");
  };

  return (
    <div className="auth-page">
      <div className="auth-glow"></div>

      <div className="auth-card">

        {/* LOGO */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            ⚡
          </div>

          <div>
            <h1>
              LIFE<span>//</span>QUEST
            </h1>

            <p>REAL LIFE RPG</p>
          </div>
        </div>

        {/* HEADING */}
        <div className="auth-heading">

          <p className="auth-kicker">
            {mode === "login"
              ? "WELCOME BACK, HERO"
              : "BEGIN YOUR ADVENTURE"}
          </p>

          <h2>
            {mode === "login"
              ? "Continue your quest."
              : "Create your character."}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Log in to continue leveling up your real life."
              : "Turn your real-world goals into an RPG adventure."}
          </p>

        </div>

        {/* ERROR */}
        {error && (
          <div className="auth-error">
            ⚠ {error}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="auth-success">
            ✓ {success}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit}>

          {/* NAME */}
          {mode === "register" && (
            <div className="auth-field">

              <label>PLAYER NAME</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                autoComplete="name"
              />

            </div>
          )}

          {/* EMAIL */}
          <div className="auth-field">

            <label>EMAIL</label>

            <input
              type="email"
              placeholder="hero@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

          </div>

          {/* PASSWORD */}
          <div className="auth-field">

            <label>PASSWORD</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />

          </div>

          {/* SUBMIT */}
          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "ENTERING QUEST..."
              : mode === "login"
              ? "ENTER THE QUEST →"
              : "CREATE CHARACTER →"}
          </button>

        </form>

        {/* SWITCH LOGIN / REGISTER */}
        <div className="auth-switch">

          {mode === "login" ? (
            <>
              New adventurer?

              <button
                type="button"
                onClick={switchMode}
              >
                Create account
              </button>
            </>
          ) : (
            <>
              Already have an account?

              <button
                type="button"
                onClick={switchMode}
              >
                Log in
              </button>
            </>
          )}

        </div>

        {/* FOOTER */}
        <div className="auth-footer">
          <span>⚔</span>

          Your progress is saved securely

          <span>⚔</span>
        </div>

      </div>
    </div>
  );
}

export default Login;