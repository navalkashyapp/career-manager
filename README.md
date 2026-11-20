<div align="center">

# 🚀 Career Manager

**AI-Powered Executive Career Strategy, Job Search Automation & Application Management Platform**

[![Node.js Version](https://img.shields.io/badge/Node.js-22%2B-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Admin_&_Client-ffca28.svg)](https://firebase.google.com/)
[![Gemini API](https://img.shields.io/badge/Google_Gemini-3.8_Flash_%2F_3.1_Pro-8e44ad.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-Private-red.svg)](#)

[Software Specification](docs/software-specification.md) • [Features](#key-features) • [Architecture](#architecture-overview) • [Getting Started](#getting-started) • [Deployment](#production-build--deployment)

</div>

---

## 📖 Overview

**Career Manager** is an enterprise-grade career operations platform designed for senior engineering leaders and technical program managers (TPMs). It unifies job discovery, ATS evaluation, custom resume tailoring, executive outreach, interview preparation, and Google Workspace integration into a single synchronized workflow powered by Google Gemini and a native multi-agent architecture.

For complete architectural details, feature inventories, code traversal paths, and remediation plans, refer to the [Software Specification Document](docs/software-specification.md).

---

## ✨ Key Features

### 1. 📊 Kanban Application Tracker
- **7-Stage Pipeline**: Seamlessly drag and drop applications across *Target / Bookmarked*, *Applied*, *Screening*, *Technical Loop*, *Offer*, *Archived*, and *Rejected* using `@dnd-kit`.
- **Modular Job Details Suite**: Decomposed into 5 dedicated sub-views:
  - **Job Description Tab**: Scraped requirements, extracted technical skills, and leadership competencies.
  - **Notes & Activity Tab**: Timestamped recruiter interactions and custom logs.
  - **Resume Studio Tab**: In-context ATS gap analysis and custom resume markdown generation.
  - **Interview Prep Tab**: System design and behavioral drills tailored specifically to the target company.
  - **Outreach Drafter Tab**: Personalized cold emails and LinkedIn connection notes generated via backend agents.

### 2. 📈 Live Firestore Performance Analytics
- Real-time conversion funnel metrics, stage durations, and velocity statistics computed directly from Cloud Firestore (`useData()`).
- Zero local markdown file dependencies, ensuring multi-device persistence and sub-second metrics recalculation.

### 3. 🎯 AI-Powered Job Evaluator
- Deep evaluation of job descriptions against master career profiles, flagging technical alignment, leadership principles, compensation ranges, and potential organizational red flags.

### 4. 📝 Executive Resume Studio
- Real-time ATS match scoring (0–100) and missing keyword identification.
- One-click PDF generation via client/server renderers and export directly to Google Drive.

### 5. 📬 Google Workspace Deep Integration
- **Gmail Integration**: Scans incoming recruiter threads, extracts action items using Gemini, and drafts contextual replies.
- **Google Tasks Sync**: Bi-directional task creation and deadline synchronization with interview dates.

### 6. 🔔 Web Push & Background Job Scraper Worker
- Background crawler periodically imports, validates, and evaluates job postings from company career portals (Greenhouse, Lever, Microsoft, Google, AWS, Meta, etc.).
- Standards-compliant Web Push (VAPID) and Firebase Cloud Messaging (FCM) notifications notify the candidate when high-match opportunities are detected.

---

## 🏗 Architecture Overview

```mermaid
graph TD
    subgraph Client ["Client Layer (React 19 + Vite)"]
        UI[Tailwind CSS v4 & Radix Primitives]
        Router[React Router 7]
        State[DataContext + React Query]
        Kanban[DnD-Kit Kanban Board]
        PushClient[PushNotificationClient]
    end

    subgraph Backend ["Backend API & Agent Layer (Node.js 22 + Express)"]
        Server[Express Server (server.ts)]
        AuthMid[Firebase Admin Auth Middleware]
        RouterOps[Career Ops Router]
        Orchestrator[OrchestratorAgent]
        subgraph Agents ["Sub-Agents"]
            TailorAgent[ResumeTailorAgent]
            OutreachAgent[OutreachAgent]
            ScraperAgent[JobScraperAgent]
            PrepAgent[InterviewPrepAgent]
        end
        Worker[JobUrlWorkerService]
        Scraper[Playwright Browser Scraper]
        PushService[PushNotificationService]
    end

    subgraph External ["External Infrastructure & Cloud"]
        Gemini[Google Gemini API (3.8 Flash / 3.1 Pro)]
        AgyCLI[Antigravity Pro CLI (agy)]
        Firestore[(Cloud Firestore)]
        GoogleAPIs[Gmail / Google Tasks / Drive APIs]
        WebPushGateway[Web Push Service (FCM / Mozilla)]
    end

    UI --> Router --> State
    State -->|HTTP + Bearer Token| AuthMid
    AuthMid --> Server
    Server --> RouterOps
    RouterOps --> Orchestrator
    Orchestrator --> Agents
    Agents -->|SDK / Fallback Cascades| Gemini
    Agents -.->|Local Fallback| AgyCLI
    Server --> Scraper
    Server --> Worker
    Server --> PushService
    PushService --> WebPushGateway
    State -->|Firebase Client SDK| Firestore
    Server -->|Firebase Admin SDK| Firestore
    State -->|OAuth2 Tokens| GoogleAPIs
```

### Security Highlights
- **Isolated Static Serving**: Production builds bundle server code into `dist-server/server.js`, strictly separating backend logic from `dist/` public web assets.
- **Defense-in-Depth Authentication**: Firebase Admin token verification and authorized email validation protect all AI endpoints and background worker triggers.
- **Safe Process Execution**: Operations runner uses `execFile` with regex argument whitelisting (`/^[a-zA-Z0-9_\-\.\/=]+$/`) to eliminate shell command injection.
- **Path Traversal Containment**: All file read/write services enforce strict directory boundary containment.
- **PII Redaction**: Full candidate profiles and AI prompt payloads are withheld from server output logs unless `DEBUG=true` is explicitly enabled.

---

## 🛠 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, Lucide React, Motion (Framer), Recharts, DnD-Kit |
| **Backend** | Node.js 22, Express 4.21, TypeScript, esbuild, Playwright Chromium, web-push |
| **Database & Auth** | Google Cloud Firestore, Firebase Authentication, Firebase Admin SDK |
| **AI / Multi-Agent** | Google Gemini (`@google/genai`, `@google/generative-ai`), Antigravity Pro CLI, Exponential Backoff |
| **APIs Integrated** | Google Tasks API, Gmail REST API, Google Drive API, Web Push Protocol |
| **Testing** | Vitest, TypeScript compiler verification (`tsc --noEmit`) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v22.x` or higher
- **npm**: `v10.x` or higher
- **Google Gemini API Key**: [Get API Key](https://aistudio.google.com/)
- **Firebase Project**: Service account credentials and client configuration

### 1. Clone & Install
```bash
git clone git@github.com:navalkashyapp/career-manager.git
cd career-manager
npm install
```

### 2. Configure Environment
Create `.env` at the root of the project:
```bash
# Gemini AI Credentials
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_MODEL_PRO=gemini-3.1-pro-preview

# Firebase Admin Service Account (JSON string or place service-account.json in root)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Allowed Users (Comma-separated)
ALLOWED_EMAILS=your.email@gmail.com

# Server & Network Configuration
PORT=3000
NODE_ENV=development
JOB_WORKER_ENABLED=true
DEBUG=false
```

Ensure `firebase-applet-config.json` contains your client Firebase configuration.

### 3. Run Development Server
```bash
npm run dev
```
The application will be live at `http://localhost:3000` (serving both Vite HMR and Express API).

---

## 🧪 Testing & Quality Assurance

```bash
# Run TypeScript compilation check
npm run lint

# Run Vitest test suites (Unit, Security, Integration)
npm test
```

---

## 📦 Production Build & Deployment

### Local Production Build
```bash
# Compile Vite frontend to dist/ and bundle Express backend to dist-server/server.js
npm run build

# Start production server
npm start
```

### Docker Container Deployment
A multi-stage, hardened Dockerfile is provided:
```bash
# Build the container image
docker build -t career-manager:latest .

# Run the container
docker run -d \
  -p 3000:3000 \
  --name career-manager \
  --env-file .env \
  career-manager:latest
```

The container automatically installs Chromium dependencies for Playwright scraping and runs health checks against `/api/health`.

---

## 📂 Project Structure

```
career-manager/
├── docs/                                # Project documentation
│   └── software-specification.md        # Comprehensive Master Software Specification
├── src/
│   ├── agents/                          # Gemini Multi-Agent System (Orchestrator, Tailor, Prep, Outreach)
│   ├── app/                             # Application root and route configuration
│   ├── components/                      # Shared UI primitives, chat modal, layout
│   ├── config/                          # API endpoints, Gemini fallback cascades
│   ├── contexts/                        # Theme and layout contexts
│   ├── features/                        # Feature-sliced application modules
│   │   ├── dashboard/                   # Funnel overview & Firestore performance metrics
│   │   ├── evaluate/                    # Multi-dimensional JD evaluator
│   │   ├── kanban/                      # Drag-and-drop Kanban & 5 decomposed modal tabs
│   │   ├── mail/                        # Gmail thread summarizer & outreach composer
│   │   ├── profile/                     # Executive career profile & LinkedIn parser
│   │   ├── resume-studio/               # ATS resume tailoring & PDF export
│   │   └── tasks/                       # Google Tasks view & auto-poller
│   ├── hooks/                           # Data hooks (useData, useGmail, useTasks, useCareerOps)
│   ├── lib/                             # Core backend services, middleware, utilities
│   │   ├── api/                         # Express sub-routers (careerOpsRouter)
│   │   ├── middleware/                  # Firebase authentication middleware
│   │   ├── services/                    # JobScraper, PushNotification, JobUrlWorker, etc.
│   │   └── utils/                       # Resilient Gemini client with backoff
│   └── store/                           # Firebase client initialization & token management
├── career-ops/                          # CLI automation tools, scrapers, and evaluators
├── scripts/                             # Seed scripts, database migrations, tunnel runners
├── server.ts                            # Production Express server & Vite integration
├── Dockerfile                           # Production multi-stage container specification
└── package.json                         # Dependencies and build scripts
```

---

## 📄 License & Credits

Developed by **Naval Kashyap**. Proprietary & Confidential. Built with Google Gemini, Antigravity, and modern React.
