import { useEffect, useState } from "react";
import Login from "./Login";

import {
  Home,
  Sword,
  BarChart3,
  Trophy,
  ShoppingBag,
  Settings,
  Flame,
  Coins,
  ChevronRight,
  Check,
  Lock,
  Brain,
  Dumbbell,
  Heart,
  Target,
  Sparkles,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";

import "./App.css";

const API_URL = "http://localhost:5000/api";

function App() {
  // ============================================
  // AUTHENTICATION
  // ============================================

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("lifequest_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ============================================
  // APP STATE
  // ============================================

  const [activeNav, setActiveNav] = useState("home");

  const [quests, setQuests] = useState([]);

  const [loadingQuests, setLoadingQuests] = useState(false);

  const [error, setError] = useState("");
  const [showQuestForm, setShowQuestForm] = useState(false);
  const [questForm, setQuestForm] = useState({
    title: "",
    category: "",
    xp: "50",
    gold: "10",
    icon: "⚔️",
  });
  const [submittingQuest, setSubmittingQuest] = useState(false);
  const [updatingQuestId, setUpdatingQuestId] = useState(null);
  const [deletingQuestId, setDeletingQuestId] = useState(null);
  const [progression, setProgression] = useState(null);
  const [rewardToast, setRewardToast] = useState(null);
  const [shopData, setShopData] = useState({ catalog: [], purchased: [] });
  const [loadingShop, setLoadingShop] = useState(false);
  const [purchasingReward, setPurchasingReward] = useState(null);

  // ============================================
  // GET TOKEN
  // ============================================

  const getToken = () => {
    return localStorage.getItem("lifequest_token");
  };

  const authHeaders = () => ({
    Authorization: "Bearer " + getToken(),
  });

  const handleLogout = () => {
    localStorage.removeItem("lifequest_token");
    localStorage.removeItem("lifequest_user");
    setUser(null);
    setQuests([]);
  };

  const loadProfile = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load profile");
      }

      setUser(data.user);
      localStorage.setItem("lifequest_user", JSON.stringify(data.user));
    } catch (err) {
      console.error("Load profile error:", err);
      setError("Unable to load your progress.");
    }
  };

  const loadProgression = async () => {
    if (!getToken()) return;

    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        setError("");
        const response = await fetch(`${API_URL}/progression`, {
          headers: authHeaders(),
        });
        const data = await response.json();

        if (response.status === 401) {
          handleLogout();
          return;
        }
        if (
          !response.ok ||
          !data.success ||
          !data.progression ||
          !data.progression.attributes
        ) {
          throw new Error(data.message || "Failed to load progression");
        }

        const nextProgression = {
          level: Number(data.progression.level || 1),
          xp: Number(data.progression.xp || 0),
          xpToNextLevel: Number(data.progression.xpToNextLevel || 100),
          gold: Number(data.progression.gold || 0),
          streak: Number(data.progression.streak || 0),
          attributes: data.progression.attributes,
          achievements: data.progression.achievements || [],
        };

        setProgression(nextProgression);
        setUser((current) => ({
          ...current,
          level: nextProgression.level,
          xp: nextProgression.xp,
          gold: nextProgression.gold,
          streak: nextProgression.streak,
          stats: nextProgression.attributes,
        }));
        return;
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }
      }
    }

    console.error("Load progression error:", lastError);
    setError("Unable to load your progression. Please try refreshing.");
  };

  // ============================================
  // LOAD QUESTS FROM POSTGRESQL
  // ============================================

  const loadQuests = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      setLoadingQuests(true);
      setError("");

      const response = await fetch(`${API_URL}/quests`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load quests");
      }

      setQuests(data.quests || []);
    } catch (err) {
      console.error("Load quests error:", err);
      setError("Unable to load your quests.");
    } finally {
      setLoadingQuests(false);
    }
  };

  const loadShop = async () => {
    if (!getToken()) return;

    try {
      setLoadingShop(true);
      const response = await fetch(`${API_URL}/rewards`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load rewards");
      }

      setShopData({
        catalog: data.catalog || [],
        purchased: data.purchased || [],
      });
    } catch (err) {
      console.error("Load rewards error:", err);
      setError(err.message || "Unable to load rewards.");
    } finally {
      setLoadingShop(false);
    }
  };

  // ============================================
  // LOAD QUESTS AFTER LOGIN
  // ============================================

  useEffect(() => {
    if (!user?.id) return undefined;

    const loadTimer = window.setTimeout(() => {
      loadProfile();
      loadQuests();
      loadProgression();
      if (activeNav === "shop") {
        loadShop();
      }
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [user?.id, activeNav]);

  // ============================================
  // LOGIN
  // ============================================

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);

    localStorage.setItem(
      "lifequest_user",
      JSON.stringify(loggedInUser)
    );
  };

  // ============================================
  // COMPLETE / UNCOMPLETE QUEST
  // ============================================

  const completeQuest = async (id) => {
    const token = getToken();

    if (!token || updatingQuestId !== null) {
      return;
    }

    try {
      setUpdatingQuestId(id);
      setError("");

      const response = await fetch(
        `${API_URL}/quests/${id}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to update quest"
        );
      }

      // Update the quest with the database response
      setQuests((current) =>
        current.map((quest) =>
          quest.id === id ? data.quest || { ...quest, completed: data.completed } : quest
        )
      );

      if (data.user) {
        const updatedUser = {
          ...user,
          ...data.user,
          stats: data.stats || user.stats,
        };
        setUser(updatedUser);
        localStorage.setItem("lifequest_user", JSON.stringify(updatedUser));
      }

      if (data.progression) {
        setProgression(data.progression);
        setUser((current) => ({
          ...current,
          ...data.user,
          stats: data.progression.attributes,
        }));
        setRewardToast({
          xp: data.rewards?.xp || 0,
          gold: data.rewards?.gold || 0,
          levelUp: data.progression.levelUp,
          level: data.progression.level,
        });
        window.setTimeout(() => setRewardToast(null), 3600);
      }

      if (data.levelUp && data.user) {
        setError(`Level up! You reached Level ${data.user.level}.`);
      }
    } catch (err) {
      console.error("Complete quest error:", err);
      setError("Unable to update this quest.");
    } finally {
      setUpdatingQuestId(null);
    }
  };

  // ============================================
  // CREATE NEW QUEST
  // ============================================

  const _createQuest = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    const title = window.prompt(
      "Enter your new quest:"
    );

    if (!title || !title.trim()) {
      return;
    }

    const category = window.prompt(
      "Category? Example: Coding, Fitness, Reading, Work"
    );

    if (!category || !category.trim()) {
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/quests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          xp: 50,
          gold: 10,
          icon: "⚔️",
          color: "purple",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to create quest"
        );
      }

      setQuests((current) => [
        ...current,
        data.quest,
      ]);
    } catch (err) {
      console.error("Create quest error:", err);
      setError("Unable to create your quest.");
    }
  };

  const submitQuest = async (event) => {
    event.preventDefault();
    if (submittingQuest || !getToken()) return;

    try {
      setSubmittingQuest(true);
      setError("");

      const response = await fetch(`${API_URL}/quests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          title: questForm.title.trim(),
          category: questForm.category.trim(),
          xp: Number(questForm.xp),
          gold: Number(questForm.gold),
          icon: questForm.icon.trim() || "⚔️",
          color: "purple",
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create quest");
      }

      await loadQuests();
      setQuestForm({
        title: "",
        category: "",
        xp: "50",
        gold: "10",
        icon: "⚔️",
      });
      setShowQuestForm(false);
    } catch (err) {
      console.error("Create quest error:", err);
      setError(err.message || "Unable to create your quest.");
    } finally {
      setSubmittingQuest(false);
    }
  };

  // ============================================
  // DELETE QUEST
  // ============================================

  const deleteQuest = async (id) => {
    const token = getToken();

    if (!token || deletingQuestId !== null) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this quest?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingQuestId(id);
      setError("");

      const response = await fetch(
        `${API_URL}/quests/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to delete quest"
        );
      }

      setQuests((current) =>
        current.filter((quest) => quest.id !== id)
      );
    } catch (err) {
      console.error("Delete quest error:", err);
      setError("Unable to delete this quest.");
    } finally {
      setDeletingQuestId(null);
    }
  };

  const purchaseReward = async (rewardId) => {
    if (purchasingReward !== null) return;

    try {
      setPurchasingReward(rewardId);
      setError("");
      const response = await fetch(`${API_URL}/rewards/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ rewardId }),
      });
      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to purchase reward");
      }

      setShopData((current) => ({
        ...current,
        purchased: [data.reward, ...current.purchased],
      }));
      setProgression((current) => ({
        ...current,
        gold: data.gold,
      }));
      setUser((current) => ({ ...current, gold: data.gold }));
    } catch (err) {
      console.error("Purchase reward error:", err);
      setError(err.message || "Unable to purchase reward.");
    } finally {
      setPurchasingReward(null);
    }
  };

  // ============================================
  // COMPLETED QUEST COUNT
  // ============================================

  const completedCount = quests.filter(
    (quest) => quest.completed
  ).length;

  // ============================================
  // USER DATA
  // ============================================

  const currentLevel = progression?.level ?? user?.level ?? 1;

  const currentXP = progression?.xp ?? user?.xp ?? 0;

  const currentGold = progression?.gold ?? user?.gold ?? 0;

  const currentStreak = progression?.streak ?? user?.streak ?? 0;
  const stats = progression?.attributes || user?.stats || {};

  const xpRequired =
    progression?.xpToNextLevel ||
    100 * Math.pow(currentLevel, 1.5);

  const xpProgress =
    xpRequired > 0
      ? Math.min((currentXP / xpRequired) * 100, 100)
      : 0;

  // ============================================
  // LOGIN SCREEN
  // ============================================

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // ============================================
  // MAIN APPLICATION
  // ============================================

  return (
    <div className="app">

      {/* ========================================
          SIDEBAR
      ======================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            <Sword size={22} />
          </div>

          <div>
            <h1>
              LIFE<span>//</span>QUEST
            </h1>

            <p>REAL LIFE RPG</p>
          </div>

        </div>

        <nav className="navigation">

          <NavItem
            icon={<Home size={19} />}
            label="Dashboard"
            active={activeNav === "home"}
            onClick={() => setActiveNav("home")}
          />

          <NavItem
            icon={<Sword size={19} />}
            label="Quests"
            active={activeNav === "quests"}
            onClick={() => setActiveNav("quests")}
          />

          <NavItem
            icon={<BarChart3 size={19} />}
            label="Attributes"
            active={activeNav === "stats"}
            onClick={() => setActiveNav("stats")}
          />

          <NavItem
            icon={<Trophy size={19} />}
            label="Achievements"
            active={activeNav === "achievements"}
            onClick={() =>
              setActiveNav("achievements")
            }
          />

          <NavItem
            icon={<ShoppingBag size={19} />}
            label="Reward Shop"
            active={activeNav === "shop"}
            onClick={() => setActiveNav("shop")}
          />

        </nav>

        <div className="sidebar-bottom">

          <div className="daily-mini">

            <div className="daily-icon">
              <Sparkles size={17} />
            </div>

            <div>
              <strong>Daily Challenge</strong>

              <span>
                {Math.min(completedCount, 3)} / 3 quests
              </span>
            </div>

          </div>

          <NavItem
            icon={<Settings size={19} />}
            label="Settings"
            active={activeNav === "settings"}
            onClick={() => setActiveNav("settings")}
          />

          <button
            className="nav-item"
            onClick={handleLogout}
            style={{ marginTop: "8px" }}
          >
            <Lock size={19} />
            <span>Logout</span>
          </button>

        </div>

      </aside>

      {/* ========================================
          MAIN
      ======================================== */}

      <main className="main">

        {rewardToast && (
          <div className={`reward-toast ${rewardToast.levelUp ? "level-up" : ""}`}>
            <strong>{rewardToast.levelUp ? "LEVEL UP!" : "QUEST COMPLETE"}</strong>
            {rewardToast.levelUp && <span>LV {rewardToast.level}</span>}
            <small>+{rewardToast.xp} XP&nbsp;&nbsp; +{rewardToast.gold} GOLD</small>
          </div>
        )}

        {/* TOP BAR */}

        <header className="topbar">

          <div className="mobile-brand">
            LIFE<span>//</span>QUEST
          </div>

          <div className="top-actions">

            <div className="currency">
              <Coins size={18} />

              <span>
                {Number(currentGold).toLocaleString()}
              </span>
            </div>

            <div className="streak">

              <Flame size={19} />

              <span>{currentStreak}</span>

              <small>DAY STREAK</small>

            </div>

            <div className="avatar-small">
              {user?.name
                ? user.name.charAt(0).toUpperCase()
                : "A"}
            </div>

          </div>

        </header>

        {/* CONTENT */}

        <div className="content">

          {/* ERROR */}

          {error && (
            <div
              style={{
                background: "rgba(255, 70, 90, 0.12)",
                border: "1px solid rgba(255, 70, 90, 0.35)",
                color: "#ff7182",
                padding: "12px 16px",
                borderRadius: "12px",
                marginBottom: "18px",
              }}
            >
              {error}
            </div>
          )}

          {activeNav === "home" ? (
            <>
          {/* WELCOME */}

          <div className="welcome">

            <div>

              <p className="eyebrow">
                REAL LIFE • YOUR ADVENTURE
              </p>

              <h2>
                Good morning,
                <span>
                  {" "}
                  {user?.name || "Adventurer"}.
                </span>
              </h2>

              <p className="welcome-text">
                Your next level is waiting. Complete your
                quests and become stronger in real life.
              </p>

            </div>

            <button
              className="create-button"
              onClick={() => setShowQuestForm(true)}
            >
              <Plus size={18} />
              New Quest
            </button>

          </div>

          {/* ======================================
              CHARACTER CARD
          ====================================== */}

          <section className="character-card">

            <div className="character-left">

              <div className="character-avatar">

                <div className="avatar-glow">
                  ⚔️
                </div>

                <div className="level-badge">
                  LV {currentLevel}
                </div>
              </div>

              <div className="character-info">

                <div className="character-title">

                  <div>

                    <span className="label">
                      CURRENT CLASS
                    </span>

                    <h3>THE BUILDER</h3>

                  </div>

                  <div className="rank">
                    <Shield size={15} />
                    <span>RARE</span>
                  </div>

                </div>

                <div className="xp-section">

                  <div className="xp-header">

                    <span>EXPERIENCE</span>

                    <strong>
                      {currentXP} /{" "}
                      {Math.round(xpRequired)} XP
                    </strong>

                  </div>

                  <div className="xp-bar">

                    <div
                      className="xp-fill"
                      style={{
                        width: `${xpProgress}%`,
                      }}
                    />

                  </div>

                  <p>
                    {Math.max(
                      Math.round(xpRequired - currentXP),
                      0
                    )}{" "}
                    XP until Level {currentLevel + 1}
                  </p>

                </div>

              </div>

            </div>

            {/* CHARACTER STATS */}

            <div className="character-stats">

              <Stat
                icon={<Brain size={17} />}
                label="INTELLIGENCE"
                value={stats.intelligence || 1}
                progress={`${stats.intelligence || 1}%`}
              />

              <Stat
                icon={<Dumbbell size={17} />}
                label="STRENGTH"
                value={stats.strength || 1}
                progress={`${stats.strength || 1}%`}
              />

              <Stat
                icon={<Heart size={17} />}
                label="VITALITY"
                value={stats.vitality || 1}
                progress={`${stats.vitality || 1}%`}
              />

              <Stat
                icon={<Target size={17} />}
                label="DISCIPLINE"
                value={stats.discipline || 1}
                progress={`${stats.discipline || 1}%`}
              />

            </div>

          </section>

          {/* ======================================
              DASHBOARD GRID
          ====================================== */}

          <div className="dashboard-grid">

            {/* ====================================
                QUEST PANEL
            ==================================== */}

            <section className="panel quests-panel">

              <div className="panel-header">

                <div>

                  <p className="section-label">
                    YOUR ADVENTURE
                  </p>

                  <h3>Today's Quests</h3>

                </div>

                <button
                  className="view-button"
                  onClick={() =>
                    setActiveNav("quests")
                  }
                >
                  View all
                  <ChevronRight size={16} />
                </button>

              </div>

              {/* LOADING */}

              {loadingQuests ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    opacity: 0.65,
                  }}
                >
                  Loading your quests...
                </div>
              ) : quests.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    opacity: 0.65,
                  }}
                >
                  <Sparkles size={30} />

                  <p>
                    No quests yet. Create your first
                    quest!
                  </p>
                </div>
              ) : (
                <div className="quest-list">

                  {quests.map((quest) => (

                    <Quest
                      key={quest.id}
                      quest={quest}
                      onComplete={() =>
                        completeQuest(quest.id)
                      }
                      onDelete={() =>
                        deleteQuest(quest.id)
                      }
                      updating={updatingQuestId === quest.id}
                      deleting={deletingQuestId === quest.id}
                    />

                  ))}

                </div>
              )}

              {/* PROGRESS */}

              <div className="quest-progress">

                <div>

                  <span>DAILY PROGRESS</span>

                  <strong>
                    {completedCount}/{quests.length}
                  </strong>

                </div>

                <div className="small-progress">

                  <div
                    style={{
                      width: `${
                        quests.length
                          ? (completedCount /
                              quests.length) *
                            100
                          : 0
                      }%`,
                    }}
                  />

                </div>

              </div>

            </section>

            {/* ====================================
                RIGHT COLUMN
            ==================================== */}

            <div className="right-column">

              {/* DAILY CHALLENGE */}

              <section className="challenge-card">

                <div className="challenge-top">

                  <div className="challenge-icon">
                    <Sparkles size={22} />
                  </div>

                  <span>DAILY CHALLENGE</span>

                </div>

                <h3>
                  Rise of the Disciplined
                </h3>

                <p>
                  Complete 3 quests today to earn
                  bonus rewards.
                </p>

                <div className="challenge-progress">

                  <div className="challenge-progress-text">

                    <span>
                      {Math.min(
                        completedCount,
                        3
                      )}{" "}
                      / 3 completed
                    </span>

                    <strong>
                      {Math.min(
                        Math.round(
                          (completedCount / 3) *
                            100
                        ),
                        100
                      )}
                      %
                    </strong>

                  </div>

                  <div className="challenge-bar">

                    <div
                      style={{
                        width: `${Math.min(
                          (completedCount / 3) *
                            100,
                          100
                        )}%`,
                      }}
                    />

                  </div>

                </div>

                <div className="challenge-reward">

                  <span>REWARD</span>

                  <strong>+300 XP</strong>

                  <strong>+150 🪙</strong>

                </div>

              </section>

              {/* ACHIEVEMENTS */}

              <section className="panel achievement-panel">

                <div className="panel-header">

                  <div>

                    <p className="section-label">
                      MILESTONES
                    </p>

                    <h3>Achievements</h3>

                  </div>

                  <Trophy size={21} />

                </div>

                <div className="achievements">

                  <Achievement
                    icon="🔥"
                    title="First Flame"
                    text="Complete your first quest"
                    unlocked={
                      completedCount >= 1
                    }
                  />

                  <Achievement
                    icon="⚔️"
                    title="Quest Hunter"
                    text="Complete 25 quests"
                    unlocked={
                      completedCount >= 25
                    }
                  />

                  <Achievement
                    icon="👑"
                    title="Legendary"
                    text="Reach Level 25"
                    unlocked={
                      currentLevel >= 25
                    }
                  />

                </div>

              </section>

            </div>

          </div>

            </>
          ) : (
            <AppPage
              activeNav={activeNav}
              user={user}
              quests={quests}
              loadingQuests={loadingQuests}
              updatingQuestId={updatingQuestId}
              deletingQuestId={deletingQuestId}
              progression={progression}
              currentGold={currentGold}
              onComplete={completeQuest}
              onDelete={deleteQuest}
              onCreate={() => setShowQuestForm(true)}
              shopData={shopData}
              loadingShop={loadingShop}
              purchasingReward={purchasingReward}
              onPurchaseReward={purchaseReward}
              onLogout={handleLogout}
            />
          )}

        </div>

      </main>

      {showQuestForm && (
        <div className="quest-modal-backdrop" role="presentation">
          <section className="quest-modal" role="dialog" aria-modal="true" aria-labelledby="quest-modal-title">
            <div className="quest-modal-header">
              <div>
                <p className="section-label">NEW ADVENTURE</p>
                <h3 id="quest-modal-title">Create a Quest</h3>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setShowQuestForm(false)}
                aria-label="Close new quest form"
              >
                <X size={18} />
              </button>
            </div>

            <form className="quest-form" onSubmit={submitQuest}>
              <label>
                QUEST TITLE
                <input
                  required
                  maxLength={200}
                  value={questForm.title}
                  onChange={(event) => setQuestForm({ ...questForm, title: event.target.value })}
                  placeholder="What will you accomplish?"
                />
              </label>
              <label>
                CATEGORY
                <input
                  required
                  maxLength={100}
                  value={questForm.category}
                  onChange={(event) => setQuestForm({ ...questForm, category: event.target.value })}
                  placeholder="Coding, Fitness, Reading..."
                />
              </label>
              <div className="quest-form-row">
                <label>
                  XP
                  <input
                    required
                    min="1"
                    type="number"
                    value={questForm.xp}
                    onChange={(event) => setQuestForm({ ...questForm, xp: event.target.value })}
                  />
                </label>
                <label>
                  GOLD
                  <input
                    required
                    min="0"
                    type="number"
                    value={questForm.gold}
                    onChange={(event) => setQuestForm({ ...questForm, gold: event.target.value })}
                  />
                </label>
                <label>
                  ICON
                  <input
                    required
                    maxLength={4}
                    value={questForm.icon}
                    onChange={(event) => setQuestForm({ ...questForm, icon: event.target.value })}
                  />
                </label>
              </div>
              <div className="quest-form-actions">
                <button className="modal-cancel" type="button" onClick={() => setShowQuestForm(false)}>
                  Cancel
                </button>
                <button className="create-button" type="submit" disabled={submittingQuest}>
                  {submittingQuest ? "CREATING..." : "CREATE QUEST"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </div>
  );
}

function AppPage({
  activeNav,
  user,
  quests,
  loadingQuests,
  updatingQuestId,
  deletingQuestId,
  progression,
  currentGold,
  onComplete,
  onDelete,
  onCreate,
  shopData,
  loadingShop,
  purchasingReward,
  onPurchaseReward,
  onLogout,
}) {
  const attributes = progression?.attributes || user?.stats || {};
  const achievementStatus = new Map(
    (progression?.achievements || []).map((achievement) => [
      achievement.id,
      achievement.unlocked,
    ])
  );

  if (activeNav === "quests") {
    return (
      <section className="panel" aria-labelledby="quests-page-title">
        <div className="panel-header">
          <div>
            <p className="section-label">YOUR ADVENTURE</p>
            <h2 id="quests-page-title">All Quests</h2>
          </div>
          <button className="create-button" onClick={onCreate}>New Quest</button>
        </div>
        {loadingQuests ? (
          <p className="empty-state">Loading your quests...</p>
        ) : quests.length === 0 ? (
          <p className="empty-state">No quests yet. Create your first quest.</p>
        ) : (
          <div className="quest-list">
            {quests.map((quest) => (
              <Quest
                key={quest.id}
                quest={quest}
                onComplete={() => onComplete(quest.id)}
                onDelete={() => onDelete(quest.id)}
                updating={updatingQuestId === quest.id}
                deleting={deletingQuestId === quest.id}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (activeNav === "stats") {
    const statNames = [
      ["intelligence", "Intelligence"],
      ["strength", "Strength"],
      ["vitality", "Vitality"],
      ["wisdom", "Wisdom"],
      ["creativity", "Creativity"],
      ["discipline", "Discipline"],
      ["endurance", "Endurance"],
    ];

    return (
      <section className="panel" aria-labelledby="attributes-page-title">
        <p className="section-label">CHARACTER BUILD</p>
        <h2 id="attributes-page-title">Attributes</h2>
        <div className="character-stats" style={{ marginTop: "24px" }}>
          {statNames.map(([key, label]) => (
            <Stat
              key={key}
              icon={<BarChart3 size={17} />}
              label={label.toUpperCase()}
              value={attributes[key] || 1}
              progress={`${Math.min(Number(attributes[key] || 1), 100)}%`}
            />
          ))}
        </div>
      </section>
    );
  }

  if (activeNav === "achievements") {
    const achievements = [
      ["first-quest", "First Quest", "Complete your first quest", "🔥"],
      ["five-quests", "Quest Hunter", "Complete five quests", "⚔️"],
      ["ten-quests", "Dedicated", "Complete ten quests", "🏆"],
      ["level-five", "Level 5", "Reach Level 5", "👑"],
      ["seven-day-streak", "Seven Day Streak", "Maintain a seven-day streak", "🔥"],
    ];

    return (
      <section className="panel" aria-labelledby="achievements-page-title">
        <p className="section-label">MILESTONES</p>
        <h2 id="achievements-page-title">Achievements</h2>
        <div className="achievements" style={{ marginTop: "24px" }}>
          {achievements.map(([id, title, text, icon]) => (
            <Achievement
              key={id}
              icon={icon}
              title={title}
              text={text}
              unlocked={achievementStatus.get(id) === true}
            />
          ))}
        </div>
      </section>
    );
  }

  if (activeNav === "shop") {
    return (
      <section className="panel" aria-labelledby="shop-page-title">
        <p className="section-label">REWARD SHOP</p>
        <h2 id="shop-page-title">Spend Your Gold</h2>
        <p style={{ marginTop: "8px", color: "#aaa5bd" }}>
          Balance: <strong>{Number(currentGold).toLocaleString()} gold</strong>
        </p>
        {loadingShop ? (
          <p className="empty-state">Loading rewards...</p>
        ) : (
          <div className="achievements" style={{ marginTop: "24px" }}>
            {shopData.catalog.map((reward) => (
              <div className="achievement" key={reward.id}>
                <div className="achievement-icon"><ShoppingBag size={17} /></div>
                <div style={{ flex: 1 }}>
                  <strong>{reward.name}</strong>
                  <span>{reward.cost} gold</span>
                </div>
                <button
                  className="create-button"
                  disabled={
                    purchasingReward !== null ||
                    Number(currentGold) < reward.cost
                  }
                  onClick={() => onPurchaseReward(reward.id)}
                >
                  {Number(currentGold) < reward.cost ? "Insufficient gold" : "Purchase"}
                </button>
              </div>
            ))}
          </div>
        )}
        {shopData.purchased.length > 0 && (
          <div style={{ marginTop: "28px" }}>
            <p className="section-label">PURCHASE HISTORY</p>
            <ul>
              {shopData.purchased.map((reward) => (
                <li key={reward.id}>{reward.name} - {reward.cost} gold</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="settings-page-title">
      <p className="section-label">ACCOUNT</p>
      <h2 id="settings-page-title">Settings</h2>
      <div style={{ marginTop: "24px", display: "grid", gap: "12px" }}>
        <p><strong>Name:</strong> {user?.name || "Player"}</p>
        <p><strong>Email:</strong> {user?.email || "Unavailable"}</p>
        <button className="modal-cancel" onClick={onLogout}>Log out</button>
      </div>
    </section>
  );
}

// ============================================
// NAV ITEM
// ============================================

function NavItem({
  icon,
  label,
  active,
  onClick,
}) {
  return (
    <button
      className={`nav-item ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ============================================
// STAT
// ============================================

function Stat({
  icon,
  label,
  value,
  progress,
}) {
  return (
    <div className="stat">

      <div className="stat-top">

        <div className="stat-icon">
          {icon}
        </div>

        <span>{label}</span>

        <strong>{value}</strong>

      </div>

      <div className="stat-bar">

        <div
          style={{
            width: progress,
          }}
        />

      </div>

    </div>
  );
}

// ============================================
// QUEST
// ============================================

function Quest({
  quest,
  onComplete,
  onDelete,
  updating,
  deleting,
}) {
  return (
    <div
      className={`quest ${
        quest.completed
          ? "completed"
          : ""
      }`}
    >

      <button
        className="quest-check"
        onClick={onComplete}
        disabled={updating || deleting}
        aria-label={
          quest.completed
            ? `Mark ${quest.title} incomplete`
            : `Complete ${quest.title}`
        }
      >
        {quest.completed && (
          <Check size={15} />
        )}
      </button>

      <div
        className={`quest-icon ${
          quest.color || "purple"
        }`}
      >
        {quest.icon || "⚔️"}
      </div>

      <div className="quest-info">

        <h4>{quest.title}</h4>

        <span>{quest.category}</span>

      </div>

      <div className="quest-reward">

        <strong>
          +{quest.xp}
        </strong>

        <span>XP</span>

      </div>

      <div className="gold-reward">
        +{quest.gold} 🪙
      </div>

      <button
        onClick={onDelete}
        disabled={updating || deleting}
        aria-label={`Delete ${quest.title}`}
        title="Delete quest"
        style={{
          background: "transparent",
          border: "none",
          color: "#777",
          cursor: "pointer",
          padding: "6px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Trash2 size={15} />
      </button>

    </div>
  );
}

// ============================================
// ACHIEVEMENT
// ============================================

function Achievement({
  icon,
  title,
  text,
  unlocked,
}) {
  return (
    <div
      className={`achievement ${
        !unlocked ? "locked" : ""
      }`}
    >

      <div className="achievement-icon">

        {unlocked ? (
          icon
        ) : (
          <Lock size={17} />
        )}

      </div>

      <div>

        <strong>{title}</strong>

        <span>{text}</span>

      </div>

    </div>
  );
}

export default App;