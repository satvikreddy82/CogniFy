# CogniFy — AI-Powered Adaptive OBE Assessment Platform

CogniFy is a full-stack, enterprise-grade web application designed for higher education institutions to plan, generate, validate, approve, and analyze examination papers in strict compliance with **Outcome-Based Education (OBE)** and **Bloom's Taxonomy** standards.

---

## 🌟 Key Features

### 1. Multi-Tier Role Governance & Approval Workflows
- **Faculty Workspace:**
  - Course Outcome (CO) mapping & syllabus repository.
  - Question bank with Bloom's taxonomy tagging (L1 to L6) and difficulty rating.
  - Multi-step Question Paper Wizard with real-time marks validation.
  - Marks analysis dashboard with question-wise student cohort scores.
  - Adaptive Planning engine offering AI recommendations for underperforming COs.
- **Dean of Academic Affairs Workspace:**
  - Departmental faculty registration approval & verification queue.
  - Question paper OBE compliance review, comment feedback, and approval/rejection.
  - Departmental OBE analytics (attainment rate, target vs actual, submission throughput).
- **Institutional Administrator Workspace:**
  - Dean appointment approvals and department jurisdiction assignments.
  - Complete user management with account suspension and reactivation.
  - Academic department taxonomy management.
  - Immutable security and audit logging trail with JSON detail inspection.

### 2. OBE Compliance & Deterministic Validation
- Multi-dimensional deterministic paper validator checks:
  - Exact total marks matching across sections and questions.
  - Bloom's taxonomy diversity coverage across cognitive levels.
  - 100% Course Outcome (CO) mapping enforcement.
  - Duplicate question prevention.
- AI Provider integration (Google Gemini adapter with fallback stub) for OBE paper generation and question classification.

### 3. Design System & Theming
- **9 Curated Color Archetypes**:
  - Theme A: Orange + Navy (Default)
  - Theme B: Emerald + Gold
  - Theme C: Violet + Yellow
  - Theme D: Green + Blush
  - Theme E: Plum + Mint
  - Theme F: Navy + Cyan
  - Theme G: Charcoal + Blue
  - Theme H: Black + Lime
  - Theme I: Red + Cream
- **Appearance Modes**: Light Mode, Dark Mode, and System Preference with live CSS variable switching.
- Micro-interactions, accessible contrast ratios, and toast/notification integration.

---

## 🏗️ Repository Architecture

```
CogniFy/
├── backend/
│   ├── src/
│   │   ├── ai/               # AI Provider adapter (Google Gemini + stub)
│   │   ├── middleware/       # Auth JWT verification & role authorization
│   │   ├── routes/           # Auth, Courses, Questions, Papers, Dean, Admin, Notifications
│   │   ├── scripts/          # Admin bootstrap CLI
│   │   ├── services/         # Authentication, paper generation, OBE analytics
│   │   ├── utils/            # Supabase client wrapper & logger
│   │   └── validators/       # Zod schemas for all requests
│   ├── tests/                # Jest + ts-jest unit tests for OBE validation & auth
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # TopBar, Sidebar, RequireAuth, modal components
│   │   ├── context/          # ThemeContext (9 themes + dark/light), AuthContext
│   │   ├── layouts/          # FacultyLayout, DeanLayout, AdminLayout
│   │   ├── pages/            # 14 role-based pages (Auth, Faculty, Dean, Admin, Shared)
│   │   ├── services/         # Axios API client with 401 interceptor
│   │   └── styles/           # Tailwind CSS + custom properties theme engine
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── database/
│   ├── migrations/           # PostgreSQL schema (profiles, courses, papers, audit_logs)
│   └── seeds/                # Initial department taxonomy seeds
├── docker-compose.yml        # Full-stack container orchestration
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- (Optional) Docker & Docker Compose
- (Optional) Supabase Project for PostgreSQL database & auth

### 1. Installation

```bash
# Clone the repository
cd CogniFy

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

Copy the example environment files:
```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

Update `backend/.env` with your credentials:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (generate a random 32-character string)
- `GEMINI_API_KEY` (optional for Google Gemini AI features)

### 3. Bootstrap Initial Administrator

Run the admin bootstrap CLI script to create your initial administrator account:
```bash
cd backend
npm run bootstrap:admin
```
Default credentials:
- **Email:** `admin@cognify.edu`
- **Password:** `Admin@123`

### 4. Running the Development Servers

In terminal 1 (Backend API on http://localhost:4000):
```bash
cd backend
npm run dev
```

In terminal 2 (Frontend Client on http://localhost:5173):
```bash
cd frontend
npm run dev
```

---

## 🧪 Testing & Verification

Run the backend test suite:
```bash
cd backend
npm test
```
Validates:
- Faculty and Dean registration Zod schemas
- Password mismatch detection
- Compliant and non-compliant OBE paper validation rules
- Duplicate question identification

Build the frontend bundle:
```bash
cd frontend
npm run build
```

---

## 🐳 Running with Docker Compose

To run the entire production-ready stack in containers:
```bash
docker-compose up --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:4000/api/v1`
- Health check: `http://localhost:4000/health`

---

## 🌐 Cloud Deployment Guide

### A. Deploy Backend to Render

1. Create a **Web Service** on [Render](https://render.com).
2. Connect your GitHub repository: `https://github.com/satvikreddy82/CogniFy`.
3. Configure the service settings:
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start` (or `node dist/index.js`)
   - **Health Check Path:** `/health`
4. Configure Environment Variables in Render Dashboard:
   - `PORT`: `10000` (Render defaults to 10000 or assigns dynamically)
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: Random 32+ character secret string
   - `CORS_ORIGINS`: Your Vercel frontend URL (e.g. `https://cognify.vercel.app`)
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `GEMINI_FALLBACK_MODEL`: `gemini-3.5-flash-lite`
   - `GEMINI_TIMEOUT_MS`: `120000`
   - `SUPABASE_URL`: (Optional) Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: (Optional) Your Supabase service role key
   - `LOG_LEVEL`: `info`

*(Alternatively, use the provided root `render.yaml` for Blueprint deployment).*

### B. Deploy Frontend to Vercel

1. Import the repository in [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Configure Environment Variables in Vercel:
   - `VITE_BACKEND_URL`: Your deployed Render backend URL (e.g. `https://cognify-backend.onrender.com`)
4. Client-side routing rewrites are pre-configured in [`frontend/vercel.json`](file:///d:/CogniFy/frontend/vercel.json) to handle SPA deep linking cleanly.

---

## 📋 Deferred Authentication Flows

As specified for current deployment priorities, the following two-factor and recovery flows are deferred for a subsequent iteration:
- Email OTP verification on registration
- Forgot-password OTP delivery via SMTP / SendGrid
- Password reset OTP verification and token redemption

The application operates with standard password authentication and administrative/Dean verification queues:
- **Faculty:** Registered accounts enter `pending_approval` until approved by their Department Dean.
- **Dean:** Registered accounts enter `pending_approval` until approved by the Institutional Administrator.
- **Admin:** Seeded via `npm run bootstrap:admin` or default demo profile.

---

## 🛡️ Security Features
- Strict bcrypt password hashing.
- Short-lived JWTs with role-based claim authorization (`faculty`, `dean`, `admin`).
- Rate limiting on sensitive endpoints (authentication and paper generation).
- Immutable audit log ledger recording actor ID, IP, action, and JSON payload.
- Zero secrets committed to version control (`.gitignore` excludes all `.env` files).

