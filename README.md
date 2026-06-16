# Multi-Channel Media Analytics & Marketing SaaS

A powerful, full-featured SaaS platform designed for content creators, agencies, and marketing teams to schedule, publish, automate, and analyze social media campaigns across **YouTube**, **Twitter**, **LinkedIn**, and **Instagram**.

---

## 🚀 Key Modules & Features

### 📅 Unified Publishing & Scheduling
*   **Visual Content Calendar:** A drag-and-drop style calendar showing drafts, scheduled posts, and publishing history across all channels.
*   **Multi-Platform Queue:** Centralized queue tracking active posts for Twitter (Tweets & Threads), LinkedIn (Thought Leadership, Company pages, personal branding), and Instagram (Reels & Carousels).
*   **Fail-safe Worker System:** Dual-mode queue runner utilizing **BullMQ + Redis** when available, with a resilient automatic fallback to **MongoDB Polling Workers** if Redis is offline.

### 🧠 AI Growth Engine
*   **Structured Generation:** Advanced generator helpers for drafting viral tweets, content calendars, educational threads, long-form LinkedIn posts, and content ideas.
*   **Omnichannel Repurposing:** Automatically convert blog posts or video transcripts into platform-optimized text formats.
*   **Intelligent Cache Layer:** Customized query-parameter caching utilizing Redis/MongoDB to minimize OpenAI API token expenses.
*   **Telemetry Logs:** Comprehensive logging tracking token counts (prompt, completion), API latency, estimated costs, and cache-hit metrics.

### 🤖 Automation Suite
*   **Trigger Rules:** Set up rules to automatically post content on recurrent schedules, recycle high-performing top-of-funnel content, or trigger posts from external webhooks.
*   **Optimized Scheduling:** Algorithms analyzing analytics snap-shots to recommend the best posting times for maximum engagement.

### 📊 Deep Analytics & Telemetry
*   **Interactive Dashboards:** Visual charts showing impressions, follower counts, and engagement rate trends.
*   **Workspace Isolation:** Advanced team-based workspace accounts separating credentials, scheduling pipelines, and analytics databases per client.

---

## 🛠️ Technology Stack

### Backend (`/backend`)
*   **Runtime:** Node.js (ES Modules)
*   **Framework:** Express.js
*   **Database:** MongoDB via Mongoose ODM
*   **In-Memory Store / Queue:** Redis via IoRedis & BullMQ
*   **AI Provider:** OpenAI API (with a local `StubAIProvider` fallback proxy for offline development)

### Frontend (`/youtube-analytics`)
*   **Framework:** React 19 + Vite 8
*   **Styling:** Tailwind CSS v4
*   **Routing:** React Router v7
*   **State & Queries:** TanStack React Query v5
*   **Data Visualization:** Recharts
*   **Animations:** Framer Motion
*   **Icons:** Lucide React

---

## 📂 Project Structure

```text
├── backend/                   # Node.js Express REST API backend
│   ├── config/                # Database (Mongoose) and Redis client setups
│   ├── controllers/           # HTTP Request handlers
│   ├── jobs/                  # BullMQ processor loops & fallback MongoDB workers
│   ├── middlewares/           # Authentication guards, error handlers
│   ├── models/                # Mongoose Database Schemas
│   ├── routes/                # API router endpoints
│   ├── services/              # OAuth, AI integrations, and publishing engines
│   └── server.js              # Entrypoint server script
│
├── youtube-analytics/         # React Main dashboard client
│   ├── src/
│   │   ├── components/        # Layout and reusable UI components
│   │   ├── context/           # React Context state (Auth, Workspace)
│   │   ├── pages/             # App views (Dashboard, Calendar, Automation)
│   │   ├── services/          # API connection functions
│   │   └── App.jsx            # Main route definition
│
├── frontend/                  # Boilerplate Starter React App (Vite)
└── README.md                  # This documentation file
```

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [MongoDB Community Server](https://www.mongodb.com/try/download/community)
*   [Redis Server](https://redis.io/download) (Optional, falls back to MongoDB queue worker if unavailable)

---

### 2. Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment variables. Create a `.env` file (copied from `.env.example`):
    ```env
    PORT=5000
    MONGODB_URI=mongodb://127.0.0.1:27017/multi-channel
    REDIS_URL=redis://127.0.0.1:6379
    JWT_SECRET=your_jwt_secret_key
    OPENAI_API_KEY=your_openai_api_key
    AI_PROVIDER=openai # Set to 'stub' for offline development fallback
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```

---

### 3. Frontend Setup
1.  Navigate to the frontend application directory:
    ```bash
    cd youtube-analytics
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your local environment variables in a `.env` file:
    ```env
    VITE_API_URL=http://localhost:5000/api
    ```
4.  Start the Vite development server:
    ```bash
    npm run dev
    ```

Open your browser and navigate to `http://localhost:5173` (or the port specified by Vite) to launch the dashboard.

---

## 🧪 Diagnostics & System Stability Audit

The backend includes a built-in diagnostics suite that performs integration health checks across MongoDB, Redis, OAuth encryptors, OpenAI proxy wrappers, and queue runners.

To execute the system health check audit, run:
```bash
cd backend
npm run test:audit
```
