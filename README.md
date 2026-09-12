# LIFE//QUEST — REAL LIFE RPG

> Turn meaningful real-world goals into quests, build character attributes, and level up through consistent action.

LIFE//QUEST is a full-stack real-life role-playing application built for the hackathon experience. It combines a focused RPG-style interface with authenticated, PostgreSQL-backed progression so everyday goals become visible, measurable momentum.

## Why LIFE//QUEST?

Many productivity tools track tasks without making progress feel rewarding, while many games provide progression without improving the player’s real life. LIFE//QUEST connects the two:

- Goals become concrete quests.
- Completion produces immediate, understandable rewards.
- Quest categories shape character attributes.
- A non-linear level curve makes continued progress meaningful.
- Persistent data keeps a player’s journey intact across sessions and refreshes.

## Solution Overview

LIFE//QUEST provides a secure player account, a personalized progression dashboard, a quest management workflow, character attributes, achievements, daily streaks, and a gold-based reward shop.

The application uses:

- React and Vite for the responsive client experience.
- Node.js and Express for authenticated APIs.
- PostgreSQL as the source of truth for users, quests, progression projections, and purchases.
- JWT and bcrypt-based authentication.

## Key Features

- Secure signup and login
- JWT-authenticated user sessions
- Password hashing with bcrypt
- Personalized player profile
- Real-life quests/tasks
- Configurable XP and gold rewards
- Non-linear leveling system
- Character attributes
- Quest-category-based attribute progression
- Gold economy and reward purchases
- Daily streak tracking
- Daily Challenge progress indicator
- Achievement unlock states
- Reward Shop with PostgreSQL purchase history
- Authenticated, user-specific data isolation
- Responsive desktop, tablet, and mobile layouts
- Accessible labels, semantic controls, keyboard focus states, and screen-reader-friendly actions

## Gameplay Loop

```text
PLAN → QUEST → COMPLETE → XP → ATTRIBUTE → LEVEL UP → REWARD
```

1. **Plan** a real-world objective.
2. **Create a quest** with a category, XP value, gold value, and icon.
3. **Complete** the quest when the real-world action is done.
4. **Earn XP** exactly once for the completed quest.
5. **Improve an attribute** based on the quest category.
6. **Level up** through the non-linear XP curve, including multiple levels when enough XP is earned.
7. **Spend gold** in the Reward Shop or continue building momentum.

Completing a quest is persisted in PostgreSQL. Marking it incomplete rebuilds progression from the remaining completed quests, preventing duplicate rewards.

## Attribute System

Quest categories map to character attributes:

| Quest category examples | Attribute |
| --- | --- |
| Coding, Study, Programming | Intelligence |
| Gym, Fitness, Workout | Strength |
| Meditation, Health, Wellness | Vitality |
| Reading, Books | Wisdom |
| Art, Design | Creativity |
| Work, Productivity, Habits | Discipline |
| Running, Cardio | Endurance |

Categories that do not have a specific mapping use Discipline as the safe default.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Authentication | JWT + bcryptjs |
| Icons/UI | Lucide React |
| Validation/tooling | Oxlint, Vite production build |

## Project Architecture

```text
LIFE-QUEST/
├─ backend/
│  ├─ db.js
│  ├─ server.js
│  └─ routes/
│     ├─ auth.js
│     ├─ quests.js
│     ├─ progression.js
│     └─ rewards.js
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx
│  │  ├─ App.css
│  │  ├─ Login.jsx
│  │  └─ main.jsx
│  ├─ public/
│  └─ package.json
└─ README.md
```

### Frontend responsibilities

- Renders the dashboard and authenticated application pages.
- Sends authenticated requests to the backend.
- Presents quest, progression, achievement, attribute, settings, and reward views.
- Uses browser storage only for the JWT/profile session convenience; quests, progression, and reward history are not persisted in localStorage.

### Backend responsibilities

- Authenticates requests and enforces user ownership.
- Reads and writes PostgreSQL data.
- Rebuilds progression from completed quests.
- Calculates XP, levels, streaks, attributes, achievements, and spendable gold.
- Handles transactional reward purchases.

## Database Overview

The current PostgreSQL database includes these relevant tables:

| Table | Purpose |
| --- | --- |
| `users` | Account identity, password hash, level, XP, gold, streak, and completion metadata |
| `character_stats` | Per-user Intelligence, Strength, Vitality, Wisdom, Creativity, Discipline, and Endurance |
| `tasks` | PostgreSQL-backed quests, rewards, completion state, timestamps, and completion metadata |
| `rewards` | Per-user reward purchases and purchase timestamps |
| `achievements` | Existing achievement storage table available in the database |
| `quests` | Existing legacy quest table in the database; the active application quest flow uses `tasks` |

The active application flow uses `tasks` for quests and `rewards` for purchases. The backend can initialize or update the task/progression support columns required by the current implementation without creating duplicate tables.

## XP and Progression

The level curve is intentionally non-linear:

```text
XP required for a level = floor(100 × level^1.5)
```

Examples:

| Transition | XP required |
| --- | ---: |
| Level 1 → 2 | 100 |
| Level 2 → 3 | 282 |
| Level 3 → 4 | 519 |
| Level 4 → 5 | 800 |

The backend calculates total XP from completed PostgreSQL tasks, subtracts thresholds across multiple levels, and stores the resulting current-level XP and level projection on the user record. Gold is derived from completed quest gold minus persisted reward purchases.

## API Overview

All protected endpoints require:

```http
Authorization: Bearer <JWT>
```

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/auth/me` | Load the authenticated profile and attributes |
| `POST` | `/api/auth/logout` | Complete an authenticated logout request |

### Quests

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/quests` | Load the authenticated user’s quests |
| `POST` | `/api/quests` | Create a PostgreSQL-backed quest |
| `PATCH` | `/api/quests/:id/complete` | Complete or uncomplete a quest |
| `DELETE` | `/api/quests/:id` | Delete an owned quest |

### Progression

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/progression` | Recalculate and return level, XP, gold, streaks, attributes, and achievements |

### Rewards

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/rewards` | Load the reward catalog and the user’s purchase history |
| `POST` | `/api/rewards/purchase` | Purchase a reward with a transactional gold deduction |

## Windows Installation

### Prerequisites

- Windows 10 or later
- Node.js 18+ recommended
- npm
- PostgreSQL 14+ recommended
- A PostgreSQL database named `lifequest`

### Clone and install

From PowerShell:

```powershell
git clone <your-repository-url>
Set-Location LIFE-QUEST

Set-Location backend
npm install

Set-Location ..\frontend
npm install
```

Create the database before starting the backend:

```powershell
createdb -U postgres lifequest
```

If `createdb` is not on PATH, create a database named `lifequest` using pgAdmin or the PostgreSQL SQL Shell.

## Environment Variables

Create `backend\.env` locally. Never commit this file.

```dotenv
DB_PASSWORD=<your-postgresql-password>
JWT_SECRET=<long-random-secret>
PORT=5000
```

The backend uses the local PostgreSQL connection settings configured in `backend/db.js`:

```text
host: localhost
database: lifequest
user: postgres
port: 5432
```

Use placeholders only in documentation and keep real credentials, secrets, and `.env` contents out of Git.

## Running the Application

Open two PowerShell windows from the project root.

### Start the backend

```powershell
Set-Location backend
npm start
```

The backend listens on:

```text
http://localhost:5000
```

The backend package currently does not define an `npm start` script. If needed, run the server directly:

```powershell
node server.js
```

### Start the frontend

```powershell
Set-Location frontend
npm run dev
```

Vite serves the frontend at its reported local URL, normally:

```text
http://localhost:5173
```

If that port is occupied, Vite selects the next available port.

The current frontend API base URL is defined in the React source for local development. For deployment, update the API base URL to the deployed backend origin through the project’s normal configuration process.

## Testing and Validation

From `frontend\`:

```powershell
npm run lint
npm run build
```

From `backend\`:

```powershell
node --check server.js
node --check routes/auth.js
node --check routes/quests.js
node --check routes/progression.js
node --check routes/rewards.js
node --check db.js
```

Recommended smoke-test coverage:

- Register and log in.
- Load `/api/quests` and `/api/progression`.
- Create, complete, uncomplete, and delete an owned quest.
- Confirm XP, level, gold, streak, and attribute changes.
- Reload the browser and confirm PostgreSQL-backed persistence.
- Purchase a reward, verify one-time gold deduction, and reload purchase history.
- Confirm invalid JWTs and cross-user quest access are rejected.

## Accessibility and Responsive Design

LIFE//QUEST includes:

- Semantic buttons for navigation and quest actions.
- Visible `:focus-visible` states for keyboard users.
- Labels and required fields for authentication and quest forms.
- Descriptive `aria-label` values for completion, deletion, and modal controls.
- Responsive layouts for desktop, tablet, and mobile widths.
- Responsive quest, dashboard, navigation, and modal layouts without replacing the visual direction.

## Hackathon Demo Journey

For a concise demo:

1. Register a new player account.
2. Show the personalized dashboard and current progression.
3. Create a quest such as “Study JavaScript” with XP and gold rewards.
4. Complete the quest and show the reward toast, XP, gold, and Intelligence update.
5. Open Attributes to show category-driven progression.
6. Open Achievements to show the first-quest milestone.
7. Open Reward Shop and purchase an affordable reward.
8. Refresh the browser and demonstrate that quests, progression, and purchase history remain backed by PostgreSQL.
9. Log out and demonstrate that the protected application is no longer accessible.

## Deployment Notes

For a production deployment:

1. Provision a managed PostgreSQL instance and create the `lifequest` database/schema.
2. Configure backend environment variables through the host’s secret manager.
3. Deploy the Node.js backend and expose its HTTPS API origin.
4. Update the frontend API base URL from the local development origin to the deployed backend origin.
5. Build the frontend with `npm run build`.
6. Serve the generated `frontend\dist` directory through a static host or CDN.
7. Configure CORS for the production frontend origin rather than using an unrestricted policy.
8. Use HTTPS, rotate JWT secrets securely, and never expose database credentials to the frontend.

The current repository is structured for local development. Production hosting should add environment-specific API configuration and infrastructure-level secret management.

## Future Improvements

Potential next steps:

- Add automated integration tests for the API and database transactions.
- Add a production environment configuration for the frontend API origin.
- Add richer reward metadata and redemption workflows.
- Add additional quest scheduling and due-date views.
- Add configurable achievement definitions stored and managed consistently in PostgreSQL.
- Add observability, rate limiting, and structured backend logging.
- Add a CI pipeline that runs lint, build, syntax checks, and API smoke tests on every pull request.

## License

This repository does not currently include a `LICENSE` file. Licensing terms should be added explicitly before distributing the project under an open-source license.
