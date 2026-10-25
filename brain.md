# 7TIME Business Management — Project Brain & Persistent Memory

> **MANDATORY FIRST-READ FOR ALL AI CODING SESSIONS**  
> This file is the primary memory, governance index, and operational entry point for 7TIME Business Management.  
> *Note on missing documents:* `PROJECT_GOVERNANCE_REVIEW.md` was requested during initial audit but was **not found** in the repository. Its governance principles and business rules have been verified and codified directly herein.

---

## 1. Project Purpose & Core Context

**7TIME Business Management** is an active, production-grade enterprise ledger, wholesale distribution, and delivery tracking application built specifically for 7TIME FMCG operations in Jammu & Kashmir (India).

- **Production URL:** [https://aaqibmushtaq.github.io/7Time-Business-Management/](https://aaqibmushtaq.github.io/7Time-Business-Management/)
- **Repository:** `AaqibMushtaq/7Time-Business-Management`
- **Hosting:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)
- **Backend & Database:** Supabase (`haofuuvwciqsambgeqyn.supabase.co`) with PostgreSQL 15+, RLS, and Deno Edge Functions
- **Current Version:** v1.3.1 (Deployed)

---

## 2. Existing Architecture Summary

- **Frontend Framework:** React 19 (`^19.2.8`), TypeScript (`^5.6.2`), Vite 8 (`^8.3.0`).
- **Styling & Design System:** Tailwind CSS v4 (`^4.3.3`) with `@theme` brand tokens (`#2D7FF9` Royal Blue, `#4A39D6` Indigo, `#33C5F3` Sky Blue, `#0E2A47` Dark Navy).
- **Client Routing:** `HashRouter` (`/#/`) — guarantees zero 404s on static GitHub Pages hosting.
- **Server State & Realtime:** TanStack Query (`staleTime: 3m`) + Supabase Realtime WebSocket with 450ms debounced cache invalidation (`useRealtimeSync`).
- **Edge Computing:** Supabase Deno Edge Function `gemini-assistant` invoking Google Gemini 2.5 Flash for strictly read-only financial synthesis. Server secrets never leak to the client.

---

## 3. Critical Business Rules & Constraints (Non-Negotiable)

1. **Aesthetics Never Compromise Business Logic:** Visual or layout refactoring must never alter or bypass financial calculations.
2. **Authoritative Numbers Only:** All balances, debts, and margins must derive from database records and pure mathematical functions. Never hardcode financial numbers.
3. **No Silent Data Mutation:** Never reset, truncate, or fabricate financial records. Production migrations must be strictly additive and idempotent.
4. **Ledger-Only Bookkeeping Model (No Payment Gateways or Money Movement):** This application is a private business management and bookkeeping ledger, NOT a payment processor. Transactions (goods sold, purchases, settlements received, payments made) occur outside the application in the real world. The system never moves funds, processes cards, executes bank transfers, or interfaces with payment gateways (strictly no Razorpay, Stripe, PayPal, UPI checkout, or webhooks). All payment and settlement entries are manual bookkeeping records. The UI strictly distinguishes recording from processing: "Record Payment" creates a ledger entry, "Outstanding Balance" is the ledger-calculated debt, and "Unallocated Advance" represents recorded funds not yet matched to debit items.
5. **No Service Role Keys in Frontend:** The Supabase `service_role` key must never be used in client code or committed to git.
6. **Double-Counting Prevention:** Inflows from point-of-sale cash (`amount_received`) are tracked separately from post-sale debt settlements (`reseller_payments`). Down payments (`amount_paid`) are separate from subsequent dealer payments.

---

## 4. Documentation Hierarchy & Directory Structure

To ensure accuracy and prevent AI agents from confusing historical proposals with current rules, the documentation is strictly tiered into three categories:

```text
                                  ┌────────────┐
                                  │  brain.md  │ (Mandatory First-Read)
                                  └─────┬──────┘
                                        │
     ┌──────────────────────────────────┼──────────────────────────────────┐
     ▼                                  ▼                                  ▼
[ TIER 1: LIVING SPECS ]      [ TIER 2: RUNBOOKS ]          [ TIER 3: HISTORICAL AUDITS ]
Current Single Source         Operational Standards         Diagnostic & Historical Context
of Truth                      & Release Procedures          (Do NOT treat as living rules)
├── PROJECT_OVERVIEW.md       ├── RELEASE_PROCESS.md        ├── DASHBOARD_AUDIT.md
├── ARCHITECTURE.md           ├── release-checklist.md      ├── DELIVERY_MODULE_AUDIT.md
├── DESIGN.md                 └── production-backup.md      ├── PERFORMANCE_AUDIT.md
├── DATABASE_AND_ACCOUNTING.md                              ├── FINANCIAL_REPORTING.md [Snapshot]
├── SECURITY.md                                             ├── MODULE_AUDIT.md [Snapshot]
├── TESTING.md                                              └── RESPONSIVE_AUDIT.md [Snapshot]
├── BUGS_AND_DECISIONS.md
├── PERFORMANCE.md
├── DEPLOYMENT_AND_RECOVERY.md
├── AI_WORKFLOW.md
└── ROADMAP.md
```

### Tier 1: Current Authoritative Living Specifications
These documents are the active source of truth. Always refer to these for current business logic, schemas, and UI standards:
- **[`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md):** Business purpose, target users, 6 module boundaries, and verified workflows.
- **[`docs/ARCHITECTURE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ARCHITECTURE.md):** System topology, runtime specifications, routing lifecycles, and trade-offs.
- **[`docs/DESIGN.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DESIGN.md):** Brand colors, typography, touch targets, and responsive breakpoint matrix.
- **[`docs/DATABASE_AND_ACCOUNTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DATABASE_AND_ACCOUNTING.md):** 14 database tables, triggers, constraints, accounting formulas, and reconciliation rules.
- **[`docs/SECURITY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/SECURITY.md):** Auth session flows, RLS policies, arithmetic parser safety, and secret handling.
- **[`docs/TESTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/TESTING.md):** Test frameworks, verified evidence (371 tests across 37 files), financial reconciliation tests, and known limitations.
- **[`docs/BUGS_AND_DECISIONS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/BUGS_AND_DECISIONS.md):** Confirmed historical bugs, verified root causes, approved decisions (ADRs), and open questions.
- **[`docs/PERFORMANCE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE.md):** Production bundle chunk breakdown, query parallelization, and free-tier limits.
- **[`docs/DEPLOYMENT_AND_RECOVERY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DEPLOYMENT_AND_RECOVERY.md):** GitHub Pages hosting, CI/CD workflows, migrations, and frontend rollback.
- **[`docs/AI_WORKFLOW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/AI_WORKFLOW.md):** Mandatory rules for AI coding assistants, evidence tiers, and verification standards.
- **[`docs/ROADMAP.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ROADMAP.md):** Completed milestones, active phase, and proposed future phases.

### Tier 2: Operational Standards & Runbooks
- **[`docs/RELEASE_PROCESS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/RELEASE_PROCESS.md):** Release governance standard, environment rules, and rollback procedures.
- **[`docs/release-checklist.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/release-checklist.md):** Condensed pre-flight checklist with checkboxes.
- **[`docs/production-backup.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/production-backup.md):** Specific database backup, dump, and PITR recovery runbook.

### Tier 3: Specialized Historical Audits & Snapshots
*Important:* These files preserve historical context, specialized subsystem derivations, and empirical diagnostics. **Do not treat "planned" or "to be added" items in these files as missing features**—always verify against Tier 1 specifications:
- **[`docs/DASHBOARD_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DASHBOARD_AUDIT.md):** Detailed accounting derivations for the executive dashboard.
- **[`docs/DELIVERY_MODULE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DELIVERY_MODULE_AUDIT.md):** Production delivery audit for General Delivery and NAEEM contractual route.
- **[`docs/PERFORMANCE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE_AUDIT.md):** Empirical diagnostics showing how Lighthouse scores rose from 27 to 95/100.
- **[`docs/FINANCIAL_REPORTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/FINANCIAL_REPORTING.md):** *[Historical Phase 7 Snapshot]* Early financial planning notes; superseded by `DATABASE_AND_ACCOUNTING.md`.
- **[`docs/MODULE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/MODULE_AUDIT.md):** *[Historical Phase 6 Snapshot]* Module checklist; superseded by `PROJECT_OVERVIEW.md`.
- **[`docs/RESPONSIVE_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/RESPONSIVE_AUDIT.md):** *[Historical Pre-Implementation Snapshot]* Responsive notes; planned fixes now live in `DESIGN.md`.

---

## 5. Task-Specific Reading Matrix

AI coding agents must load only the documents required for their assigned task:

| Task Being Performed | Required Files to Read |
| :--- | :--- |
| **UI, Styling, or Layout** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/DESIGN.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DESIGN.md) + Target component |
| **Architecture or Refactoring** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/ARCHITECTURE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ARCHITECTURE.md) + [`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md) |
| **Accounting or Database Bug** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/DATABASE_AND_ACCOUNTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DATABASE_AND_ACCOUNTING.md) + [`docs/BUGS_AND_DECISIONS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/BUGS_AND_DECISIONS.md) + Migrations |
| **Security or Secrets** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/SECURITY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/SECURITY.md) + `src/lib/supabase.ts` |
| **Test Failures or New Tests** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/TESTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/TESTING.md) + Target `.test.ts(x)` files |
| **Performance & Bundling** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/PERFORMANCE.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PERFORMANCE.md) + `vite.config.ts` |
| **Deployment or CI/CD** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/DEPLOYMENT_AND_RECOVERY.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DEPLOYMENT_AND_RECOVERY.md) + `.github/workflows/` |
| **New Roadmap Feature** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/PROJECT_OVERVIEW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/PROJECT_OVERVIEW.md) + [`docs/ROADMAP.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/ROADMAP.md) |
| **AI Agent Operating Protocol** | [`brain.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/brain.md) + [`docs/AI_WORKFLOW.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/AI_WORKFLOW.md) |

---

## 6. Verification Checklist Before Concluding Any Task

Every AI session must verify these three gates before finishing:
1. `npm run lint` — Must report 0 errors and 0 warnings (Oxlint: 0 warnings, 0 errors across 124 files).
2. `npm run build` — `tsc -b && vite build` must compile cleanly (0 errors, production bundle built cleanly).
3. `npm test` (`vitest run`) — All 24 Vitest test suites (213 tests) must pass (0 failures).
4. **Approval Gate:** STOP and wait for the user's manual review. Do not proceed to unapproved refactoring, feature additions, or deployments.

---

## 7. Current Project Status & Recent Milestones

- **Latest Completed Milestone: Executive Dashboard Charts, Trends & Business Insights (Phase 4)**:
  - **Responsive Monthly Financial Trends Chart (`MonthlyFinancialTrendsChart.tsx`)**:
    - Chronological 6M & 12M trend lines covering 5 distinct series: Total Purchases, Wholesale Sales, Wholesale Gross Profit, Cash Received, and Cash Paid.
    - Category series filtering: `All Series`, `Commercial (Sales vs Purchases)`, `Cash Flow (Received vs Paid)`, and `Profitability (Gross Profit vs COGS)`.
    - Handles empty months and missing data gracefully with honest empty states, ₹ currency tooltips, and responsive layout.
  - **Outstanding Balances Breakdown Card (`OutstandingBalancesBreakdownCard.tsx`)**:
    - Macro cumulative balance sheet visualization strictly segregated by source: Wholesale Customer Receivables, Personal Ledger (with 7TIME Funds vs Personal Funds vs Unallocated attribution pills), and NAEEM Contract Receivables.
    - Top supplier payables breakdown with percentage share of total liabilities and direct dealer ledger access.
    - Net Working Position ($\text{Total Receivables} - \text{Total Payables}$) and strict non-netting enforcement badge.
    - 100% reconciled against Executive KPI Card totals.
  - **Business Performance Insights Card (`BusinessPerformanceInsightsCard.tsx`)**:
    - Month-over-Month wholesale sales velocity and gross profit trajectory with comparison period labels and safe zero-denominator handling.
    - Realized wholesale gross profit margin % with health status indicators.
    - Cash collection efficiency ratio (cash collected vs sales).
    - Supplier payables net activity (purchases vs disbursements in period and cumulative debt).
    - General Delivery fleet activity strictly designated as *net contribution after fuel* (never net profit).
    - Follow-up Priority Debtors ranked strictly by cumulative balance without speculative overdue claims.
  - **Quality Gates Verified**:
    - `oxlint`: 0 warnings, 0 errors across 129 files.
    - `tsc -b`: 0 type errors.
    - `vitest run`: 24 test suites, 220 tests passing (100% pass rate).
    - `npm run build`: Production bundle compiled cleanly in 2.68s.

- **Previous Milestone: Executive Financial Control Center & Phase 3 Release Review**:
  - **8 Key Financial Control Center Metrics Reconciled**:
    - **Total Purchases**: Gross purchases from suppliers in selected period (`purchases.total_amount`).
    - **Wholesale Sales**: B2B wholesale revenue recognized upon dispatch (`wholesale_sales.total_sale`).
    - **Wholesale Gross Profit**: Realized gross profit with profit margin percentage (`wholesale_sales.profit = total_sale - (buying_cost * quantity)`), with COGS tracking.
    - **General Delivery**: Net fleet delivery contribution after fuel (`general_delivery_entries.amount - general_daily_records.fuel_expenses`). Explicitly distinguished from full net profit.
    - **Cash In**: Actual liquid collections received (`sales.amount_received + reseller_payments + general_delivery_entries.received_amount + naeem_payments`). Excludes invoice accruals.
    - **Cash Out**: Actual liquid cash disbursements (`purchases.amount_paid + dealer_payments + fuel_expenses`).
    - **Total Receivables (Who owes us and how much)**: Full debtor visibility with segregated breakdowns for Wholesale Customers, Personal Ledger (Qard Hasan/Expense on Behalf), NAEEM Contract, and Other Receivables.
    - **Total Payables (Whom we owe and how much)**: Cumulative supplier debt ($\sum \max(0, \text{Balance})$) with direct dealer ledger links.
  - **Dedicated Operational Sections**:
    - **Wholesale Distribution Performance Card**: Gross sales, Cost of Goods Sold (COGS), Gross Profit & Margin %, Point-of-sale cash vs trade credit, and dispatch volume.
    - **Delivery & Fleet Operations Card**: Side-by-side general delivery fleet metrics (gross, fuel, net contribution after fuel, active days) and NAEEM dedicated route metrics (billed, collected, pending, trips), responsive across mobile and desktop.
  - **Accounting Safeguards Enforced**:
    - Decoupling of Accrual Invoicing from Cash In, and Purchase Orders from Cash Out.
    - Single-source truth for Personal Ledger balances (`customer_credits`) segregated from wholesale trade accounts.
    - FIFO auto-allocation on Personal Ledger settlements via `UnifiedReceivePaymentModal` triggers database-level balance recalculations.
    - Non-netting principles preserved: positive receivables and payables never offset across entities.
    - All-time balance persistence verified: period filtering updates flows without masking cumulative debts.
  - **Quality Gates Verified**:
    - `oxlint`: 0 warnings, 0 errors across 126 files.
    - `tsc -b`: 0 type errors.
    - `vitest run`: 24 test suites, 215 tests passing (100% pass rate).
    - `npm run build`: Production bundle compiled cleanly in 2.37s.

- **Previous Milestone: Final Personal Ledger Audit & Production Readiness Verification**:
  - **Comprehensive 11-Point Verification**:
    - **Separate Concepts & Workflows**: Personal Ledger completely segregated under `PERSONAL LEDGER` navigation category with `/local-customers` and `/personal-ledger` alias routes. Entities strictly designated as **People** and **Person Details**; Wholesale Customers & Sales (`/wholesale`) completely separated and preserved natively.
    - **Consistent Professional Terminology**: Confirmed across every screen, dialog, empty state, filter, notification, and report. Replaced legacy strings in error/validation messages (`Person not found`, `Failed to add person`, `Name is required`, `Failed to record personal ledger entry`, `Failed to void settlement`). Added native Personal Ledger CSV export to Reports (`src/pages/reports/index.tsx`).
    - **Islamic Finance Compliance**: Absolutely zero interest, riba, time penalties, or borrower/lender terminology. All direct financial assistance accurately designated as **Qard Hasan (قرض حسن)** (Interest-Free Assistance) repayable at principal value only. Purchases on behalf designated as **Expense on Behalf**.
    - **Directional Separation**: Receivables (They Owe Me: $\sum \max(0, \text{Debt})$) and Payables (I Owe Them: $\sum \text{Advances}$) strictly decoupled and independently calculated without deceptive netting.
    - **Capital Origin Attribution**: Explicit segregation of **7TIME Business Funds** vs **Personal Funds** vs Unallocated legacy records with dynamic reconciliation banner and inline origin re-assignment.
    - **Zero Double-Counting**: Explicit and FIFO allocations (`customer_payment_allocations`) maintain mathematical reconciliation with total payments. Down payments and point-of-sale wholesale cash tracked separately from post-sale settlements.
    - **Dynamic Supabase Live Data**: All metrics, cards, tables, and balances dynamically derive from real Supabase queries via TanStack Query without mock fallbacks.
    - **Security & RLS Integrity**: Confirmed PostgreSQL Row Level Security actively revokes anonymous access to `customer_credits` and `customer_payment_allocations`, enforcing authenticated-only access.
  - **Quality Gates Verified**:
    - `oxlint`: 0 warnings, 0 errors across 126 files.
    - `tsc -b`: 0 type errors.
- **Latest Milestone: Critical Dynamic Data Only Audit & Production Verification**:
  - **Full Codebase Audit for Fabricated Data**:
    - Conducted comprehensive regex and ast audit across all production modules, services, hooks, utilities, charts, and pages.
    - Confirmed **zero** hardcoded rupee amounts, fabricated customer/dealer/supplier records, static chart datasets, or fake receivables/payables exist in production client code.
    - All synthetic data fixtures (e.g. "Al Infaq", "Kashmir Traders", ₹23,300) are strictly isolated to `*.test.ts` and `*.test.tsx` test files. Production bundle scan (`dist/assets/`) confirmed zero leakage of test entities or synthetic figures.
  - **Database Verification & Empty-State Integrity**:
    - Verified remote Supabase project (`haofuuvwciqsambgeqyn.supabase.co`) operational tables contain 0 operational records.
    - Zero dummy seed transactions inserted into production database; production credentials safely preserved.
    - Dashboard strictly displays genuine empty states ("All customer accounts are settled", "All supplier accounts are settled", "No Historical Financial Activity Recorded", "No active receivables") when tables contain zero records.
  - **Error State Resilience**:
    - Expanded `criticalQueries` error checking in `src/services/dashboard.ts` to cover all 16 parallel database queries (including customer credits, fleet records, and inventory).
    - Guaranteed that database failures immediately throw and surface an explicit error banner with "Try Again" action rather than silently defaulting to fabricated numbers or misleading zeros.
  - **Automated Verification**:
    - Added dedicated automated tests in `src/pages/dashboard/index.test.tsx` and `src/services/dashboard.test.ts` asserting that empty database results render true zero/empty states with zero fabricated numbers, and database errors throw immediately.
    - `oxlint`: 0 warnings, 0 errors across 129 files.
    - `tsc -b`: 0 type errors.
    - `vitest run`: 24 test suites, 224 tests passing (100% pass rate).
    - `npm run build`: Production bundle compiled cleanly in 3.95s.
  - **Governance**: Working tree unstaged; no git commits, pushes, or deployments performed; awaiting explicit user approval.

- **Previous Milestone: Executive Dashboard Enhancements (Phases 1-5)**:
  - **8 Consolidated KPI Cards & Balance Sheet Claims**:
    - Total Purchases, Wholesale Sales, Wholesale Gross Profit, General Delivery, Cash In, Cash Out, Total Receivables, Total Payables.
    - Reconciled non-netting rule: Customer advances and supplier prepayments never offset against independent debts.
    - Historical trends & business insights dynamically computed from Supabase operational records.
  - **Quality Gates**:
    - `vitest run`: 24 test suites, 221 tests passing (100% pass rate).
    - `npm run build`: Production bundle built cleanly in 3.23s.
    - Release readiness: Fully ready for deployment upon owner review.

- **Previous Milestone: Personal Ledger — Final Naming & Terminology Correction**:
  - **Module Separation & Terminology**:
    - Sidebar menu item and section strictly titled **Personal Ledger** under navigation category `PERSONAL LEDGER`.
    - Directory and records labeled as **People** and **Person Details** (never "wholesale customers" or "resellers").
    - Wholesale Customers and Sales module (`/wholesale`) left completely untouched with its native business-to-business terminology.
    - Page Header: Title `Personal Ledger`, supporting description: *"Track purchases made on behalf of people, money lent or owed, expenses paid personally or by 7TIME, and settlements received or paid."* Primary actions: `+ Add Person`, `+ Record Expense on Behalf`, `+ Give Qard Hasan`, `+ Record Settlement`.
  - **Mandatory Islamic Finance Compliance**:
    - Eliminated terms like "Loan", "Cash Loan", "Lending", "Borrower", "Lender", and "Interest" from the personal ledger UI.
    - Replaced with **Qard Hasan (قرض حسن)** (Interest-Free Assistance) representing genuine interest-free loans repayable according to agreed terms.
    - Zero interest calculations, time-based penalties, or automatic charges anywhere in the application.
    - Replaced "Customer Credit" / "Product Credit" with **Expense on Behalf** (or Amount Spent on Behalf).
    - Replaced "Record Payment" with **Record Settlement** / **Settlement Received**.
    - Replaced "Customer Owes" / "I Owe" with **Receivable (They Owe Me)** and **Payable (I Owe Them)**.
    - Replaced "Customer Ledger" with **Personal Account Ledger**.
  - **Capital Origin & Direction Segregation**:
    - Distinct origin funding source maintained: **7TIME Business Funds** vs **Personal Funds** vs Unallocated legacy records.
    - Clear transaction direction: Receivable (They Owe Me) vs Payable (I Owe Them) vs Settled.
  - **Zero Data Loss & Safe Underlying Persistence**:
    - PostgreSQL tables (`reseller_customers`, `customer_credits`, `reseller_payments`, `customer_payment_allocations`) and enum values (`PRODUCT_CREDIT`, `CASH_LOAN`, `OTHER_CREDIT`, `7TIME_FUNDS`, `PERSONAL_FUNDS`) remain 100% untouched.
    - Zero destructive migrations, zero changes to accounting formulas, foreign keys, or RLS policies.
  - **Quality Gates & Automated Verification**:
    - `oxlint`: 0 warnings, 0 errors across 126 files.
    - `tsc -b`: 0 type errors.
    - `vitest run`: 24 test suites, 213 tests passing (100% pass rate).
    - `npm run build`: Production bundle compiles cleanly in 3.31s.

- **Previous Milestone: Local Customer Ledger Refactor (Personal Debtors/Creditors Separation)**:
  - **Dedicated Route & Navigation:** Primary route `/local-customers` (and `/local-customers/:id`) introduced; sidebar link updated to `/local-customers` under `PERSONAL LEDGER`. Legacy URLs (`/resellers`, `/customers`, `/reseller-payments`) preserved as backward-compatible aliases/redirects with zero 404s.
  - **Accounting Precision (Receivables vs Payables):** Dual-direction accounting implemented without deceptive netting:
    - Amount They Owe Me (Total Receivables): $\sum \max(0, \text{Debt})$.
    - Amount I Owe Them (Total Payables / Customer Advances): $\sum \text{Customer Advances (payments exceeding debt)}$.
  - **UI Modernization:** Top metric summary cards, separate columns in directory table, and conditional rendering of "Historical Wholesale Orders" tab inside customer drawer (only shown if historical orders exist).
- **Post-Deployment Live Verification (Phase 10):**
  - Live deployment at `https://aaqibmushtaq.github.io/7Time-Business-Management/` verified via browser subagent.
  - All core operational modules (Dashboard, Dealers, Resellers, Deliveries, Naeem) render real data with 0 console errors and 0 network failures.
  - Database records preserved intact; RLS verified active.
  - Disaster recovery runbook verified in `docs/production-backup.md`. Cloud backup status is marked unverified without Supabase Dashboard credentials.

