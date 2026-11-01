# 7TIME BUSINESS MANAGEMENT — MASTER BUG REGISTER

**Registry Date:** 2026-11-01  
**Project:** 7TIME Business Management  
**Branch:** `feature/7time-multi-account-workspaces`  
**Supabase Production Project:** `haofuuvwciqsambgeqyn` (Region: `ap-south-1`)

---

## Severity Classification
- **P0 (Critical Blocker):** Production outage, data loss risk, complete inability to save primary domain records.
- **P1 (High Priority / Structural):** Unauthorized route access, database policy mismatches preventing core CRUD operations, multi-tenant isolation risks.
- **P2 (Medium Priority / Workflow):** Suboptimal calculation logic, duplicate allocation creation, state re-rendering triggers, report export discrepancies.
- **P3 (Low Priority / Code Quality):** Unused variables, unhandled background error logging, deprecated route aliases.

---

## Bug Registry Matrix

| Bug ID | Severity | Module / Area | Title & Description | Status | Affected Files | Resolution Summary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **P0** | Deliveries | General Daily & NAEEM Delivery 31 Oct RLS Failure (`ERROR: 42501`) | **RESOLVED IN PROD** | `supabase/migrations/20261101040000_delivery_workspace_resolution.sql` | Applied migration 04 on production; created SECDEF triggers resolving tenant workspace dynamically via `auth.uid()`. |
| **BUG-02** | **P1** | Commercial DB | Missing Auto-Resolution Triggers on Commercial Tables in Production | **READY FOR PROD** | `supabase/migrations/20261101050000_commercial_workspace_resolution.sql` | Prepared migration 05: zero-hardcode triggers for `dealers`, `products`, `purchases`, `dealer_payments`, `reseller_customers`, `customer_credits`, etc. Tested in isolated DB. |
| **BUG-03** | **P1** | Security / Auth | Unprotected Administrative Route URL Direct Navigation (`/settings/accounts`, `/backup`, `/audit`) | **FIXED & TESTED** | `src/App.tsx`, `src/components/auth/ModuleRouteGuard.tsx` | Added `adminOnly` prop to `ModuleRouteGuard`; redirected non-admins with access-denied notification. |
| **BUG-04** | **P2** | React State | Unstable `entitlements` Object Reference in `useModuleAccess` Causing Re-Renders | **FIXED & TESTED** | `src/hooks/useModuleAccess.ts` | Extracted fallback to constant `EMPTY_ENTITLEMENTS`, preventing new reference allocations on every render cycle. |
| **BUG-05** | **P2** | Deliveries | NAEEM Payment Edit Creating Duplicate `naeem_payment_allocations` | **FIXED & TESTED** | `src/services/naeemDeliveries.ts` | Updated `recordnaeemPayment` to delete pre-existing allocations for the payment ID prior to inserting updated allocations. |
| **BUG-06** | **P2** | Reports | General Delivery CSV Export Missing Arithmetic Expression Totals | **FIXED & TESTED** | `src/pages/reports/index.tsx` | Integrated `parseArithmeticExpression` to evaluate and include expressions from `delivery_expression` when individual entries are absent. |
| **BUG-07** | **P3** | Routing | Deprecated Legacy Route Aliases Missing Guard Wrappers (`/personal-ledger/:id`, `/resellers`) | **FIXED & TESTED** | `src/App.tsx` | Wrapped legacy aliases with `<ModuleRouteGuard module="personal_ledger">` or redirected to modern canonical routes. |
| **BUG-08** | **P3** | Edge Functions | Unused Variable & Missing Workspace Context in `gemini-assistant` | **FIXED & TESTED** | `supabase/functions/gemini-assistant/index.ts` | Injected authenticated workspace metadata `{ id, name, type }` into context payload passed to Gemini model. |
| **BUG-09** | **P3** | Edge Functions | Unhandled Error Logging for `workspaces.insert` in `admin-manage-users` | **FIXED & TESTED** | `supabase/functions/admin-manage-users/index.ts` | Added error condition check and console logging for `wsErr` during personal workspace creation. |
| **BUG-10** | **P0/P1**| Deliveries | Non-Atomic NAEEM Payment Allocation Update (Data Loss Risk) | **READY FOR PROD** | `src/services/naeemDeliveries.ts`, `supabase/migrations/20261101041000_naeem_payment_allocation_rpc.sql` | Replaced client-side delete-then-insert sequence with PostgreSQL RPC `record_naeem_payment_with_allocations` executing inside atomic transaction block. |
| **BUG-11** | **P2** | Deliveries | Calendar Month Rollover Test Drift in General Deliveries | **FIXED & TESTED** | `src/pages/general-deliveries/index.test.tsx` | Pinned `localStorage.setItem("general_delivery_month", "2026-10")` in test `beforeEach` to prevent test failures when clock rolled into November 2026. |
| **BUG-12** | **P1** | Database / DR | Restoration Unique Key Collision on Seed Data & Missing Legacy Tables | **DOCUMENTED & FIXED** | `scratch/verify_backup_restoration.cjs` | Established pre-restore truncate protocol and schema parity for legacy delivery tables (`daily_deliveries`), proving 100% data recovery. |

---

## Detailed Bug Reports (Recent Additions)

### BUG-10: NAEEM Payment Allocation Non-Atomicity (P0/P1)
- **Symptom:** In the payment-edit workflow, client code deleted existing payment allocation records and then attempted to insert replacement allocation records in separate HTTP requests. If the network dropped or insertion failed, the original allocation records were permanently lost.
- **Root Cause:** Relational updates across multiple tables were executed via separate client-side REST calls rather than a database-level transaction.
- **Fix:** Authored PostgreSQL RPC `public.record_naeem_payment_with_allocations` in Migration `20261101041000_naeem_payment_allocation_rpc.sql`. The RPC verifies `auth.uid()`, confirms active profile, validates workspace bounds, replaces allocations atomically, and automatically rolls back if any validation or constraint fails. Updated `src/services/naeemDeliveries.ts` to call this RPC with automatic backward-compatible REST fallback.
- **Verification:** Verified via 7 unit tests in `src/services/naeemDeliveries.test.ts` and executed directly against restored production data in isolated PostgreSQL database.

### BUG-11: Calendar Month Rollover Test Drift (P2)
- **Symptom:** `src/pages/general-deliveries/index.test.tsx` failed 4 tests on November 1, 2026 with Vitest exit code 1.
- **Root Cause:** The page component defaults its month to `new Date().toISOString().substring(0, 7)`. On November 1, 2026, the component defaulted to `"2026-11"`, while the test mock data was constructed for October 2026 (`2026-10-01`), causing a month mismatch during table rendering and row interaction.
- **Fix:** Added `localStorage.setItem("general_delivery_month", "2026-10")` to `beforeEach` in `src/pages/general-deliveries/index.test.tsx`.
- **Verification:** Isolated test passed 10/10; full Vitest suite passed 604/604 across 50 test files.

### BUG-12: Restoration Collision on Pre-Seeded Migration Data (P1)
- **Symptom:** Replaying production backup SQL into a clean migrated database failed with `duplicate key violates unique constraint "uq_user_module"`, aborting the restoration.
- **Root Cause:** Migration `20261101000000_multi_account_core.sql` generated new UUIDs for admin module entitlements. When the backup replayed with `ON CONFLICT ("id") DO UPDATE`, it collided on the natural unique key `(user_id, module_id)`. Additionally, legacy table `daily_deliveries` was dropped by migration `00002` locally, but still exists in production.
- **Fix:** Documented in disaster recovery plan: apply schema parity for legacy tables, followed by a pre-restore table truncation (`TRUNCATE TABLE ... CASCADE` under `SET session_replication_role = 'replica'`) prior to data replay.
- **Verification:** Successfully executed in `scratch/verify_backup_restoration.cjs`, restoring 454/454 rows with 0 violations.
