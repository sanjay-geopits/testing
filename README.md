# 🌍 GeoMon — Enterprise Database Observability Platform

> **GeoMon** is a production-grade, enterprise observability and incident management platform built by **GeoPITS** for monitoring database health, server utilization, log analytics, and client support operations — all from a single unified dashboard.

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 📊 **Real-Time Log Analytics** | Ingest, classify, and visualize database logs from email-based telemetry feeds |
| 🚨 **Automated Alert Thresholds** | Configurable CPU/Memory/Disk/IO thresholds with auto-email dispatch |
| 🎫 **Ticket Management** | Full incident lifecycle — create, triage, comment, resolve with email threading |
| 📈 **Telemetry Dashboards** | Server utilization history, DB sizes, table growth, uptime tracking |
| 📧 **Email Integration** | Microsoft Graph API + SMTP fallback for bidirectional email-to-ticket workflows |
| 🤖 **AI Chatbot** | OpenAI-powered assistant embedded in the dashboard |
| 👤 **SSO / OAuth2** | Microsoft Entra ID (Azure AD) + username/password authentication |
| 📁 **Reports Hub** | Upload, review, and share monthly client reports |
| 🔐 **Role-Based Access** | Admin / Lead / User / Client access tiers with IP network restriction |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      CLIENT BROWSER                              │
│              React 18 + Vite SPA (HashRouter)                    │
│   Login → Home → Tickets / Reports / Telemetry / Admin Setup     │
└─────────────────────────┬────────────────────────────────────────┘
                          │  HTTPS  (JWT Bearer)
┌─────────────────────────▼────────────────────────────────────────┐
│                   FastAPI Application                            │
│         backend/app.py  (entry-point + middleware stack)         │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐  │
│  │  routes.py  │  │         api/  (modular routers)          │  │
│  │ (legacy API)│  │ auth · logs · tickets · telemetry ·      │  │
│  └─────────────┘  │ users · clients · reports                │  │
│                   └──────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               core/  (shared infrastructure)             │   │
│  │  config.py · database.py · dao.py · security.py · deps   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               services/  (background daemons)            │   │
│  │  email_extracter · email_fetcher · alert_threshold ·     │   │
│  │  email_service · sync_service · utilization_sync         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               parsers/  (data transformation)            │   │
│  │      json_parser · severity_classifier · subject_parser  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬────────────────────────────────────────┘
                          │  psycopg2 connection pool
┌─────────────────────────▼────────────────────────────────────────┐
│             PostgreSQL 17  (geomon database)                     │
│         30+ tables  |  views  |  materialized views              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
GeoVexSight-App-main 2/
├── backend/
│   ├── app.py                    # FastAPI entry point + middleware + startup daemons
│   ├── routes.py                 # Legacy monolithic router (gradual migration)
│   ├── migrations.py             # Canonical DB schema — idempotent, runs at startup
│   ├── api/                      # Modular FastAPI routers
│   │   ├── __init__.py           # Aggregates all sub-routers onto /api prefix
│   │   ├── auth.py               # /api/auth/*
│   │   ├── logs.py               # /api/logs/*
│   │   ├── tickets.py            # /api/tickets/*
│   │   ├── telemetry.py          # /api/telemetry/*
│   │   ├── users.py              # /api/users/*
│   │   ├── clients.py            # /api/clients/*
│   │   └── reports.py            # /api/reports/*
│   ├── core/
│   │   ├── config.py             # Single env-var source of truth
│   │   ├── database.py           # ThreadedConnectionPool + context manager
│   │   ├── dao.py                # Centralized Data Access Object layer
│   │   ├── security.py           # JWT + bcrypt password utilities
│   │   └── deps.py               # FastAPI dependency injectors
│   ├── services/
│   │   ├── email_extracter.py    # MS Exchange email ingestion daemon
│   │   ├── email_fetcher.py      # Graph API email fetcher
│   │   ├── email_service.py      # Outbound email dispatch (Graph → SMTP → Simulated)
│   │   ├── alert_threshold_service.py  # CPU/Mem/Disk/IO alert checker loop
│   │   ├── sync_service.py       # Log sync utility
│   │   ├── utilization_sync.py   # Server utilization data sync
│   │   └── cleanup_processed_emails.py
│   ├── parsers/
│   │   ├── json_parser.py        # JSON telemetry parser
│   │   ├── severity_classifier.py # Log severity ML/rule classifier
│   │   └── subject_parser.py     # Email subject line parser → client/server mapping
│   ├── telemetry_parser.py       # Full telemetry parsing pipeline
│   ├── log_extractor.py          # Log extraction utilities
│   ├── log_utils.py              # Audit logger and log helpers
│   └── cache_utils.py            # In-memory cache manager
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Root router (HashRouter, lazy-loaded pages)
│   │   ├── AuthContext.jsx       # Global auth state (JWT + /api/me polling)
│   │   ├── ThemeContext.jsx      # Light/dark theme context
│   │   ├── Login.jsx             # Login page (password + Microsoft SSO)
│   │   ├── Dashboard.jsx         # Classic monitoring dashboard
│   │   ├── ObservabilityDashboard.jsx
│   │   ├── LogStatusPage.jsx
│   │   ├── LeadDashboard.jsx
│   │   └── new_features/
│   │       ├── Home.jsx          # Primary landing page post-login
│   │       ├── TicketsHub.jsx    # Full-featured ticket management UI
│   │       ├── ReportsHub.jsx    # Reports upload / download / review
│   │       ├── AdminSetup.jsx    # Admin panel (users, clients, alerts, agents)
│   │       ├── TelemetryClients.jsx
│   │       ├── TelemetryClientDetails.jsx
│   │       ├── TelemetryClientDatabases.jsx
│   │       ├── TelemetryClientTables.jsx
│   │       ├── TelemetryClientUptime.jsx
│   │       ├── ServerGridPage.jsx
│   │       ├── OverallSummaryHub.jsx
│   │       ├── Chatbot.jsx       # OpenAI-powered embedded chatbot
│   │       └── PageTracker.jsx   # Activity/session duration tracker
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml            # PostgreSQL 17 container definition
├── requirements.txt              # Python dependencies
├── geomon.sh                     # Linux production start/stop/restart script
├── start_GeoMon.sh               # macOS/local dev start script
├── start_server.bat              # Windows start script
├── restart_server.bat            # Windows restart script
├── .env                          # Environment variables (not committed)
└── migrations.py                 # (root proxy, delegates to backend/migrations.py)
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router v6 (HashRouter), Vanilla CSS |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Database** | PostgreSQL 17 |
| **ORM / DB Layer** | psycopg2 (raw SQL via centralized DAO) |
| **Auth** | JWT (HS256, 7-day expiry), bcrypt, Microsoft Entra ID OAuth2 |
| **Email** | Microsoft Graph API (primary), SMTP (fallback) |
| **AI** | OpenAI API (GPT chatbot) |
| **Deployment** | Linux systemd service / Docker Compose / Windows batch scripts |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 17 (or Docker)
- A `.env` file (see `.env.example` below)

### 1. Clone & Install

```bash
git clone https://github.com/sanjay-geopits/testing.git
cd testing

# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install && npm run build && cd ..
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geomon
DB_USER=postgres
DB_PASSWORD=yourpassword

# Security
JWT_SECRET=your-jwt-secret-key

# Microsoft Entra ID (for SSO & Graph API email)
APP_CLIENT=your-azure-client-id
APP_SECRET=your-azure-client-secret
APP_TENANT=your-azure-tenant-id
APP_REDIRECT_URI=https://api.geomon.geopits.com/api/auth/callback/microsoft

# Email
USER_EMAIL=dccagent@geopits.com
MAIL_PASSWORD=your-mail-password

# OpenAI
OPENAI_API_KEY=sk-...

# Network Access (comma-separated CIDRs)
ALLOWED_IP_NETWORKS=127.0.0.1,192.168.1.0/24
```

### 3. Start with Docker (Database only)

```bash
docker compose up -d
```

### 4. Run the Application

**Linux/macOS:**
```bash
chmod +x geomon.sh
./geomon.sh start
```

**Windows:**
```bat
start_server.bat
```

**Manual (development):**
```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The app will be available at `http://localhost:8000`

---

## 🔐 User Roles

| Role | Access |
|---|---|
| **admin** | Full system access, all clients/technologies |
| **lead** | Scoped to assigned technology stacks |
| **user** | Scoped to explicitly assigned clients |
| **client** | Read-only view of their own data |

---

## 📡 API Endpoints

| Prefix | Module | Purpose |
|---|---|---|
| `POST /api/login` | app.py | Password-based JWT login |
| `GET /api/auth/login/microsoft` | app.py | Microsoft SSO redirect |
| `GET /api/me` | app.py | Current user profile + role |
| `GET/POST /api/logs/*` | api/logs.py | Log ingestion & retrieval |
| `GET/POST /api/tickets/*` | api/tickets.py | Ticket CRUD + comments |
| `GET/POST /api/telemetry/*` | api/telemetry.py | Server metrics & utilization |
| `GET/POST /api/users/*` | api/users.py | User management |
| `GET/POST /api/clients/*` | api/clients.py | Client configuration |
| `GET/POST /api/reports/*` | api/reports.py | Report upload/download |

---

## 📊 ER Diagram

See [`GeoMon_ER_Diagram.png`](./GeoMon_ER_Diagram.png), the full schema in [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md), and the live Admin interface specification in [`ADMIN_PANEL_WIREFRAMES.md`](./ADMIN_PANEL_WIREFRAMES.md).

---

## 📄 License

© 2026 GeoPITS. All rights reserved. Internal use only.
