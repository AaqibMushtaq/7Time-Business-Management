# Release Checklist

> **DOCUMENT CLASSIFICATION: TIER 2 — OPERATIONAL CHECKLIST**  
> **Purpose:** Tactical pre-flight release checklist to verify before triggering production deployments.  
> **Policy & Rollback Procedures:** For complete release governance and emergency rollback steps, see [`docs/RELEASE_PROCESS.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/RELEASE_PROCESS.md).  

## 1. Master Release Readiness Verification Gates

The following gates must be verified and checked before any production release:

- [x] **Accounting calculations verified across all relevant screens:**
  - Executive Dashboard: `#payables` KPI verified with $\max(0, \text{Balance})$ advance isolation.
  - Dealer List & Summary Cards: Outstanding balances reflect opening balances, purchases, and payments.
  - Dealer Detail Page & Panel: Comprehensive breakdown reflects $\text{Outstanding} = \text{Opening Balance} + \text{Unpaid Purchases} - \text{Payments}$. Advance states properly handled.
  - Wholesale & Customer Credit Ledger: Realized profit and credit balances verified.
- [x] **Financial regression tests pass:**
  - `src/services/dealers.test.ts`: 21 tests covering 17 financial accounting cases, advance offsets, and CRUD.
  - `src/lib/dealerPayments.test.ts`: 12 tests covering debt settlements, zero down-payments, and deduplication.
  - `src/services/customerCredits.test.ts`: 16 tests covering credit ledger, payment allocations, and over-allocation guards.
  - `src/services/dashboard.test.ts`: 9 tests verifying true outstanding balances, supplier advances, and date filters.
  - Overall suite: 195 passing tests across 22 test files (0 failures).
- [x] **Duplicate-submission safeguards verified:**
  - TanStack Query mutation `isPending` state guards submit buttons across Dealer Payments, Reseller Payments, Customer Credits, General Delivery, and NAEEM.
  - Submit buttons disabled with loading spinners during active network transit.
  - Over-allocation guards reject duplicate or excessive allocations before mutation dispatch.
- [x] **Security checks pass:**
  - Anonymous full-access policies dropped via `20261015020000_restrict_customer_credits_rls.sql`. Direct privileges revoked from `anon`.
  - All database tables enforce Row Level Security (RLS) for authenticated users.
  - Arithmetic expression parser rejects `eval()` / `new Function()` / arbitrary code.
  - Zero `service_role` keys or private secrets in client bundle.
- [x] **TypeScript, lint, tests, and build pass:**
  - Lint: `npx oxlint` reports 0 warnings, 0 errors across 123 files (React Rules of Hooks compliant).
  - TypeScript: `npx tsc -b` passes cleanly with 0 type errors.
  - Tests: `npx vitest run` passes 195/195 tests across 22 test suites.
  - Build: `npm run build` succeeds cleanly in ~3s.
- [x] **Existing financial data remains intact:**
  - Zero database reset, drop, or truncation commands run.
  - Database migrations are strictly forward-only and additive.
  - Unpaid invoices with down payments maintain exact historical integrity.
- [x] **Documentation matches the implementation:**
  - All 10 Tier 1 and Tier 2 documentation files synchronized with active source code, tests, and database triggers.
- [x] **Git changes reviewed before release:**
  - Exact diff of 14 modified files inspected. No extraneous or unintended changes present.
- [ ] **Deployment approved by the user:**
  - Final release gate requires explicit human user sign-off before `git commit`, `git push`, or triggering the GitHub Actions deploy pipeline.

---

## 2. Pre-Deployment Operational Smoke Checks

Verified via Phase 10 live browser session on [https://aaqibmushtaq.github.io/7Time-Business-Management/](https://aaqibmushtaq.github.io/7Time-Business-Management/):

- [x] **Live URL Accessible**: HTTP 200 returned, HTML shell rendered cleanly.
- [x] **Auth Session Maintained**: Authenticated session loads Executive Dashboard with live Realtime indicator connected.
- [x] **Dealer Ledger Smoke Test**: Loaded `AL AQSA PRARAHMA` and `AL INFAQ TRADERS` without errors; dealer detail view displays correct breakdown.
- [x] **NAEEM Route Smoke Test**: Route trips (11 trips, 2 no-orders), ₹1,180.00 carry-forward opening balance, and ₹2,980.00 outstanding verified.
- [x] **Console Inspection**: 0 uncaught React errors, 0 update loops, 0 `PGRST205` or 404s captured in console logs across all page transitions.
- [x] **Network Inspection**: Supabase Realtime WebSocket established connection cleanly without reconnect loops.
