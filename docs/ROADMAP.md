# 7TIME Business Management — Development Roadmap

**Document Status:** Verified milestone tracking and future phase planning  
**Last Updated:** October 2026  
**Current Phase:** v1.3.0 Complete (Local Customer Profile & Editable Ledger)  

---

## 1. Verified Completed Milestones

### Phase 1: Core Foundation & Database Baseline (v1.0.0) — COMPLETED
- [x] Initial database schema baseline (`dealers`, `purchases`, `dealer_payments`, `products`, `reseller_customers`, `wholesale_sales`, `reseller_payments`).
- [x] NAEEM delivery ledger with carry-forward calculations and manual overrides.
- [x] React ErrorBoundary and Supabase client configuration.
- [x] Automated CI/CD deployment to GitHub Pages via GitHub Actions.

### Phase 2: Testing, Governance & Mobile Stability (v1.1.0) — COMPLETED
- [x] Vitest and Playwright regression testing suites established.
- [x] Frontend calculation refactoring into pure mathematical functions (`naeemCalculations.ts`, `dealerPayments.ts`).
- [x] Release governance checklists and safe rollback procedures documented (`RELEASE_PROCESS.md`).

### Phase 3: Unified Receivables & Mobile Cache Auto-Update (v1.2.0) — COMPLETED
- [x] Mobile cache busting headers and service worker deregistration.
- [x] Client version manager (`versionManager.ts`) and update notification banner.
- [x] Unified receivables debt collection across Wholesale, NAEEM, and Deliveries.
- [x] Reusable `UnifiedReceivePaymentModal` on executive dashboard.

### Phase 4: Performance & Live Synchronization (v1.2.1) — COMPLETED
- [x] Instant shell rendering and zero-CLS `DashboardSkeleton`.
- [x] Supabase Realtime live synchronization provider with 450ms debounce (`useRealtimeSync`).
- [x] Concurrent query parallelization in `dashboard.ts`.
- [x] Lighthouse performance optimization (achieved 95/100 score).

### Phase 5: Gemini AI Assistant (v1.3.0) — COMPLETED
- [x] Dedicated route (`/assistant`) with desktop and mobile navigation integration.
- [x] Authenticated Supabase Edge Function `gemini-assistant` calling Google Gemini 2.5 Flash.
- [x] Strictly read-only financial synthesis using deterministic calculations.
- [x] Interactive suggested prompts, safe markdown bubble renderer, error mappings, and conversation reset.

### Phase 6: Local Customer Profile & Complete Editable Ledger — COMPLETED
- [x] Customer Profile editing (name, phone, address, notes, opening balance) with database persistence (`20261015010000_add_customer_notes.sql`).
- [x] Inline row editing of credit ledger (date, entry type, product/desc, quantity, unit, rate, total, notes) with dynamic `quantity * rate` calculation and delete confirmation.
- [x] Multi-entry payment allocations (`customer_payment_allocations`), payment editing, and safe voiding.
- [x] Discrepancy reconciliation banner with 1-click FIFO auto-allocation (`autoAllocateCustomerPayments`).
- [x] 167 automated Vitest unit tests passing across 21 test files with 0 lint errors and clean production build.

### Phase 4.5: Customer Credits Security Remediation — COMPLETED
- [x] Forward-only migration [`supabase/migrations/20261015020000_restrict_customer_credits_rls.sql`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/supabase/migrations/20261015020000_restrict_customer_credits_rls.sql) applied in Supabase.
- [x] Dropped permissive `"Allow anon users full access"` policies on `customer_credits` and `customer_payment_allocations`.
- [x] Revoked all direct table privileges from `anon` role (defense-in-depth).
- [x] Confirmed application operations continue functioning under authenticated session token.

### Phase 5: Dealer Opening Balance Accounting — COMPLETED
- [x] Incorporated `dealers.opening_balance` into `src/services/dealers.ts` (`getDealersWithBalances`).
- [x] Included dealer opening balances in `src/services/dashboard.ts` queries and `#payables` total calculation (with $\max(0, \text{Balance})$ advance isolation).
- [x] Updated `DealerDetailPage.tsx` and `DealerDetailPanel.tsx` to include opening balance in `outstandingBalance` with breakdown display and fixed React Hook ordering.
- [x] Added `Opening Balance (₹)` input field to Add/Edit Dealer modal in `src/pages/dealers/index.tsx`.
- [x] Created 21 accounting regression and CRUD tests in `src/services/dealers.test.ts`.

### Phase 6: Idempotency & Duplicate Submission Safety — COMPLETED
- [x] Audited entire codebase for `idempotencyKey` and duplicate request patterns; removed unused client-side `idempotencyKey` state from `purchases` and `wholesale`.
- [x] Verified duplicate submission protection across Dealer Payments, Reseller Payments, Customer Credits, General Delivery, and NAEEM via TanStack Query `isPending` state, button disabling, interactive loading spinners, and over-allocation guards.
- [x] Added 12 duplicate submission and deduplication regression tests in `src/lib/dealerPayments.test.ts`.
- [x] Added 16 duplicate allocation and guard tests in `src/services/customerCredits.test.ts`.

---

## 2. Current Active Development Phase

**Phase Focus:** Release Readiness & Deployment Preparation (v1.3.1)  
- Full quality checks verified: 22 Vitest test suites (195 tests) passing (0 failures), Oxlint 0 warnings/0 errors across 123 files, `tsc -b` clean, Vite production build clean.
- All living documentation updated (`brain.md`, `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE_AND_ACCOUNTING.md`, `SECURITY.md`, `TESTING.md`, `BUGS_AND_DECISIONS.md`, `DEPLOYMENT_AND_RECOVERY.md`, `AI_WORKFLOW.md`, `ROADMAP.md`, `release-checklist.md`).
- Awaiting user approval for production deployment.

---

## 3. Proposed Future Phases (Pending User Approval)

The following items are technical suggestions and future proposals. None of these have been started or authorized without explicit user direction:

### Proposal A: Granular Role-Based Access Control (RBAC)
- **Problem:** Currently, all authenticated users share administrative permissions.
- **Scope:** Introduce `user_roles` (`admin`, `manager`, `driver`). Field delivery staff will be restricted to delivery logging and cash collection, without access to profit margins or supplier costs.
- **Dependencies:** Supabase RLS policy revisions and JWT custom claims.

### Proposal B: Dedicated Staging Database Environment
- **Problem:** Automated end-to-end (Playwright) tests cannot execute destructive scenarios against live production.
- **Scope:** Provision a separate disposable Supabase staging project or CI test database to execute automated authenticated browser tests in CI before merging to `main`.

### Proposal C: Product Catalog Name & Category Editing UI
- **Problem:** `updateProduct` service exists, but product name and category editing are not exposed in the UI.
- **Scope:** Add an Edit Product modal to `src/pages/products/`.

### Proposal D: Multi-Year Ledger Virtualization & PostgreSQL Summary RPCs
- **Problem:** Long-term ledger growth (10,000+ entries) could increase initial payload size.
- **Scope:** Add `@tanstack/react-virtual` to reports tables and migrate all-time summary calculations to PostgreSQL stored procedures (`rpc/get_dashboard_aggregates`).
