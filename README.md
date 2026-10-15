# 7TIME Business Management

A private, high-resilience enterprise ledger and management platform designed specifically for 7TIME wholesale, FMCG distribution, and daily delivery operations in Jammu & Kashmir.

[![CI](https://github.com/AaqibMushtaq/7Time-Business-Management/actions/workflows/ci.yml/badge.svg)](https://github.com/AaqibMushtaq/7Time-Business-Management/actions/workflows/ci.yml)
[![Deploy](https://github.com/AaqibMushtaq/7Time-Business-Management/actions/workflows/deploy.yml/badge.svg)](https://github.com/AaqibMushtaq/7Time-Business-Management/actions/workflows/deploy.yml)

**Live Production System:** [https://aaqibmushtaq.github.io/7Time-Business-Management/](https://aaqibmushtaq.github.io/7Time-Business-Management/)

---

## Capabilities & Operational Domains

- **Executive KPI Dashboard:** Real-time summary of Purchases, Commercial Revenue, Inflows, Outflows, Customer Receivables, and Supplier Liabilities. Includes a Unified Business Performance container with comparative trend views.
- **Supplier Purchasing & Dealer Payables:** Inventory restocking with automatic PostgreSQL stock increment triggers (`trg_increase_stock_on_purchase`) and cumulative payable balance tracking.
- **Warehouse Inventory & Valuation:** Live stock valuation (`buying_cost * quantity`), potential revenue estimation, and low-stock alerts.
- **Wholesale Sales & Local Customer Ledgers:** Multi-entry customer ledger tracking Product Credits, Cash Loans, and Other Credits with inline row editing, FIFO auto-allocation, and safe payment voiding.
- **General Daily Deliveries:** Calendar-based delivery management with fuel expense deductions and custom arithmetic expression evaluation (e.g. `10+350+10 = ₹370.00`).
- **NAEEM Dedicated Route Delivery:** Contractual delivery route tracking with month-to-month carry-forward balances and manual opening balance overrides.
- **AI Financial Assistant:** Authenticated, strictly read-only natural language assistant powered by a Supabase Edge Function (`gemini-assistant`) invoking Google Gemini 2.5 Flash.

---

## Verified Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.2.8` | Component model & concurrent UI |
| **Language** | TypeScript | `^5.6.2` | Static typing & interface contracts |
| **Build Tool & Bundler** | Vite | `^8.3.0` | Ultra-fast HMR and code-splitting |
| **CSS Engine** | Tailwind CSS | `^4.3.3` | `@theme` CSS variables & modern styling |
| **UI Components** | Radix UI + Lucide | Various | Accessible primitives and vector icons |
| **Client Routing** | React Router DOM | `^7.18.4` | `HashRouter` (`/#/`) for static host resilience |
| **Server State** | TanStack Query | `^5.104.1` | Caching, deduplication, and stale-time handling |
| **Backend & Database** | Supabase | PostgreSQL 15+ | PostgREST API, RLS security, and Realtime |
| **AI Backend** | Supabase Edge Functions | Deno / TypeScript | Server-side Google Gemini 2.5 Flash invocation |
| **Quality & Linting** | Oxlint & Vitest | `^1.81.0` / `^5.0.3` | Fast static analysis and unit test suite |

---

## Local Development & Setup

### Prerequisites
- **Node.js:** LTS version (`v20+` or `v22+` recommended).
- **npm:** Package manager (`npm ci` required for deterministic locked dependencies).

### 1. Installation
Clone the repository and install locked dependencies:
```bash
git clone https://github.com/AaqibMushtaq/7Time-Business-Management.git
cd "7Time Business  Management"
npm ci
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your Supabase project credentials:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
*(Never commit `.env` or expose the Supabase `service_role` key).*

### 3. Running Locally
Start the Vite local development server:
```bash
npm run dev
```
Open [http://localhost:5173/7Time-Business-Management/](http://localhost:5173/7Time-Business-Management/) in your browser.

---

## Quality Assurance & Verification Commands

```bash
# 1. Lint the codebase (Oxlint: 0 errors / 0 warnings required)
npm run lint

# 2. Run the automated test suite (Vitest: 21 files / 167 tests)
npm test -- --run

# 3. Compile TypeScript & bundle for production
npm run build
```

---

## Detailed Documentation System

This repository maintains a focused, modular documentation system where each document has a single responsibility:

### Core Memory & AI Guidelines
- **[`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md):** Mandatory first-read project memory, governance index, and reading matrix for AI coding sessions.
- **[`docs/AI_WORKFLOW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/AI_WORKFLOW.md):** Rules for AI coding assistants, evidence categories, and anti-hallucination protocols.

### Specifications & Design
- **[`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md):** Business purpose, target users, module responsibilities, and verified vs planned features.
- **[`docs/ARCHITECTURE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ARCHITECTURE.md):** System topology, runtime specifications, routing lifecycles, and architectural trade-offs.
- **[`docs/DESIGN.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DESIGN.md):** Brand color palette (`#2D7FF9`, `#4A39D6`, `#0E2A47`), typography, spacing, and mobile touch standards.

### Data, Security & Quality
- **[`docs/DATABASE_AND_ACCOUNTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DATABASE_AND_ACCOUNTING.md):** Database tables, triggers, constraints, accounting formulas, and reconciliation rules.
- **[`docs/SECURITY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/SECURITY.md):** Authentication, Row Level Security (RLS), input validation, and secret segregation.
- **[`docs/TESTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/TESTING.md):** Test frameworks, verified execution evidence, financial reconciliation tests, and known limitations.
- **[`docs/PERFORMANCE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE.md):** Bundle chunk architecture, query parallelization, caching, and free-tier optimization.

### Operations & Roadmap
- **[`docs/BUGS_AND_DECISIONS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/BUGS_AND_DECISIONS.md):** Verified historical bugs, root causes, approved decisions, and unresolved questions.
- **[`docs/DEPLOYMENT_AND_RECOVERY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DEPLOYMENT_AND_RECOVERY.md):** GitHub Pages deployment, GitHub Actions workflows, database migrations, and disaster recovery.
- **[`docs/ROADMAP.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ROADMAP.md):** Completed milestones (v1.0.0 through v1.3.0), active phase, and future proposals.

---

## Production Status

- **Build Status:** Verified passing.
- **Automated Tests:** 167 tests passing across 21 test files.
- **Database Migrations:** Applied and synchronized with Supabase PostgreSQL backend.
