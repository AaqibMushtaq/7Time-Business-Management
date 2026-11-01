# 7TIME BUSINESS MANAGEMENT — BUG FIX CHANGELOG

**Document Version:** 1.4.0  
**Last Updated:** 2026-11-01  
**Project:** 7TIME Business Management  
**Branch:** `feature/7time-multi-account-workspaces`  
**Git HEAD:** `0bdd0f70f815e307151c4e2443d1cd2d4895e2e6`  

---

## Release & Remediation History

### Version 1.4.0 (2026-11-01) — Master Completion & Quality Hardening
- **Deliveries (Date Rollover Test Defect):**
  - File: `src/pages/general-deliveries/index.test.tsx`
  - Fixed test suite failure caused by the system calendar advancing to November 1, 2026.
  - Pinned `localStorage.setItem("general_delivery_month", "2026-10")` in `beforeEach` to guarantee deterministic synchronization with the October mock dataset.
  - Restored full test suite to 50/50 files and 604/604 tests passing.
- **Database Restoration & Recovery (Disaster Recovery):**
  - Script: `scratch/verify_backup_restoration.cjs`
  - Report: `7TIME_BACKUP_RESTORE_VERIFICATION_REPORT.md`
  - Conducted end-to-end restoration of production backup into isolated local PostgreSQL 18.
  - Restored all 31 tables, 454 rows, with 0 constraint or foreign key violations.
  - Documented disaster recovery protocols for legacy tables (`daily_deliveries`) and pre-seed truncation.
- **Pending Migrations Validation:**
  - Script: `scratch/test_pending_migrations_on_restored_db.cjs`
  - Successfully applied and verified Migration `20261101041000_naeem_payment_allocation_rpc.sql` and Migration `20261101050000_commercial_workspace_resolution.sql` directly against restored production data in local isolated PostgreSQL.

### Version 1.3.1 (2026-11-01) — NAEEM Atomicity & Commercial Workspace Integrity
- **NAEEM Deliveries (Payment Allocation Atomicity):**
  - Migration: `supabase/migrations/20261101041000_naeem_payment_allocation_rpc.sql`
  - Service: `src/services/naeemDeliveries.ts`
  - Created `record_naeem_payment_with_allocations` PostgreSQL RPC executing inside an atomic transaction.
  - Eliminates data loss risk by ensuring failed allocation updates roll back and preserve original records.
  - Integrated RPC call in `src/services/naeemDeliveries.ts` with backward-compatible REST fallback.
- **Commercial Workspace Resolution:**
  - Migration: `supabase/migrations/20261101050000_commercial_workspace_resolution.sql`
  - Authored zero-hardcode automatic workspace resolution triggers across all 9 commercial tables (`dealers`, `products`, `purchases`, `dealer_payments`, `wholesale_sales`, `reseller_customers`, `customer_credits`, `customer_payment_allocations`, `reseller_payments`).
  - Added immutability triggers strictly preventing workspace reassignment.

### Version 1.3.0 (2026-10-31) — Delivery Workspace Resolution & Multi-Account Foundation
- **General Daily & NAEEM Deliveries (RLS Insertion Fix):**
  - Migration: `supabase/migrations/20261101040000_delivery_workspace_resolution.sql`
  - Applied to remote production `haofuuvwciqsambgeqyn`.
  - Added SECURITY DEFINER triggers resolving business workspace dynamically via `auth.uid()`.
- **Administrative Navigation Security:**
  - Files: `src/App.tsx`, `src/components/auth/ModuleRouteGuard.tsx`
  - Added `adminOnly` protection to `/settings/accounts`, `/backup`, `/audit`. Non-administrators are redirected with an explicit access-denied view.
- **AI Assistant Tenant Isolation:**
  - Service: `src/services/aiAssistant.ts`
  - Edge Function: `supabase/functions/gemini-assistant/index.ts`
  - Injected workspace metadata and tenant-isolation boundaries into Gemini context payloads.

---

## Detailed File Changes Summary

| Area | Files Modified | Change Nature | Quality Validation |
| :--- | :--- | :--- | :--- |
| **Deliveries** | `src/pages/general-deliveries/index.test.tsx` | Pinned test calendar month in `beforeEach` | 10/10 passed in test file |
| **NAEEM Service** | `src/services/naeemDeliveries.ts` | Atomic RPC invocation with fallback | 7/7 unit tests passed |
| **Commercial Security** | `src/services/commercialWorkspaceSecurity.test.ts` | 7 trigger & RLS tests | 7/7 passed |
| **Auth & Routing** | `src/App.tsx`, `ModuleRouteGuard.tsx` | Route protection & admin-only guards | 7/7 passed |
| **Edge Functions** | `gemini-assistant/index.ts`, `admin-manage-users/` | Tenant scoping & user administration | 10/10 security tests passed |
| **Database Migrations** | `20261101041000...`, `20261101050000...` | Forward-only additive SQL migrations | Tested on isolated restored DB |
