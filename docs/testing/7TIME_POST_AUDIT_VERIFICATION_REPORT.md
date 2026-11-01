# 7TIME BUSINESS MANAGEMENT — POST-AUDIT INDEPENDENT VERIFICATION REPORT

**Verification Date:** 2026-10-31  
**Project:** 7TIME Business Management  
**Current Git Branch:** `feature/7time-multi-account-workspaces`  
**Git HEAD Commit:** `5768c01a6a0ddc7c78ca964fe6844fa2ff419182`  
**Supabase Production Project Ref:** `haofuuvwciqsambgeqyn` ("7Time Business Management", AWS Mumbai `ap-south-1`)  
**Scope:** Independent, Evidence-Based Audit Verification, Test Run Forensics, Production Migration 04 Audit, Proposed Migration 05 Code Review, and Deliverable Integrity Check

---

## Executive Summary & Independent Verdict

An independent verification was performed on the six master audit deliverables, application source code diffs, remote production database objects, and automated test execution logs.

### Key Verification Verdicts:
1. **Migration 04 is Genuine & Functioning in Production:**  
   Empirical queries directly against production Supabase project `haofuuvwciqsambgeqyn` confirm that migration `20261101040000_delivery_workspace_resolution` is registered in `supabase_migrations.schema_migrations`. All delivery triggers, composite foreign keys, and RLS policies are installed and active. Controlled production entries for 31 October 2026 in General Daily Delivery and NAEEM Delivery exist and are queryable. The local migration file checksum strictly matches the authorized SHA-256 (`2C1AFF047473470DCAC7721D0973119C1AB0F2F3BE70006FF7AAC77B29A5820F`).
2. **Test Suite Provenance & Earlier Failure Root Cause Identified:**  
   The earlier test run exited with code 1 due to `src/pages/inventory/index.test.tsx` (2 tests failed). The root cause was a mock mismatch: an edit in `src/pages/inventory/index.tsx` called `.maybeSingle()`, while the unit test mock only mocked `.single()`. Reverting to `.single()` resolved the failure. The final test run passed **100% of tests (48 test files, 590 tests passed, 0 skipped, 0 failed) in 152.45s** against the current working-tree code.
3. **Critical Defect Discovered in Proposed Migration 05:**  
   Proposed local migration `supabase/migrations/20261101050000_commercial_workspace_resolution.sql` attaches UPDATE triggers calling `public.prevent_workspace_reassignment()`. However, that function **is not defined anywhere in Migration 05**, nor does it exist in production (where Migration 04 named it `prevent_delivery_workspace_reassignment()`). If executed as-is, Migration 05 would fail immediately with Postgres error `42883 (function does not exist)`.
4. **Non-Atomic Payment Allocation Replacement Defect:**  
   The fix in `src/services/naeemDeliveries.ts` uses two sequential HTTP calls (`supabase.delete()` followed by `supabase.insert()`). These calls are **not wrapped in a database transaction**. If network failure, validation errors, or trigger rejections occur during the insert step, previously recorded payment allocations are permanently deleted, leaving an unallocated orphan payment.
5. **Report Discrepancies Cataloged:**  
   Multiple naming discrepancies were discovered between the audit reports and production reality (e.g., generic trigger names in the reports vs actual trigger names installed in production).

---

## 1. Test Suite Discrepancy Verification

### A. The Earlier Failed Test Run (Exit Code 1)
- **Task ID:** `task-7651` (executed at `2026-10-31T22:23:50+05:30`)
- **Command:** `npm test` (`vitest run`)
- **Duration:** 203.19s
- **Outcome:** `Test Files: 1 failed | 47 passed (48); Tests: 2 failed | 588 passed (590)`
- **Failing File:** `src/pages/inventory/index.test.tsx`
  - `× renders page header and calculates total stock units and asset valuation (1124ms)`
  - `× renders status badges correctly based on stock level thresholds (1054ms)`
- **Exact Root Cause:**
  `src/pages/inventory/index.test.tsx` mocks Supabase queries specifically for `app_settings` as:
  ```typescript
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: { low_stock_threshold: 2 },
      error: null,
    }),
  })
  ```
  An experimental change in `src/pages/inventory/index.tsx` swapped `.single()` for `.maybeSingle()`. Because `.maybeSingle` was undefined on the test mock, the query rejected with `TypeError: .maybeSingle is not a function`, leaving inventory items unrendered (rendered "0 catalog products" and "₹0.00").
- **Correction:** The query was restored to `.single()` in `src/pages/inventory/index.tsx`.

### B. The Final Successful Test Run (Exit Code 0)
- **Task ID:** `task-7776` (executed at `2026-10-31T22:32:17+05:30`)
- **Command:** `npm test` (`vitest run`)
- **Duration:** 152.45s
- **Output:**
  ```text
   Test Files  48 passed (48)
        Tests  590 passed (590)
     Start at  22:32:19
     Duration  152.45s (environment 58%, tests 21%, setup 12%, import 6%, transform 2%, worker 1%)
  ```

### C. Test Inclusion & Exclusion Audit
- **Total Test Files on Disk:** 48 files matching `src/**/*.test.*`.
- **Total Test Files Executed:** 48 test files.
- **Skipped / Pending / Conditionally Disabled Tests:** 0 tests (`git grep -E "(describe\.skip|it\.skip|test\.skip|\.todo)" src/` returned 0 results).
- **Working-Tree Consistency:** The final test execution ran against the current source tree. No source files in `src/` have been modified since `task-7776` completed.

---

## 2. Migration 04 Production Verification Evidence

### A. Production Project Reference & Migration History
- **Project Ref:** `haofuuvwciqsambgeqyn` (Verified via `supabase/.temp/project-ref`).
- **Remote Migration Registry Record (`supabase_migrations.schema_migrations`):**
  ```json
  {
    "version": "20261101040000",
    "name": "delivery_workspace_resolution"
  }
  ```

### B. Local File Checksum Verification
- **Target File:** `supabase/migrations/20261101040000_delivery_workspace_resolution.sql`
- **Authorized SHA-256:** `2C1AFF047473470DCAC7721D0973119C1AB0F2F3BE70006FF7AAC77B29A5820F`
- **Recalculated SHA-256:** `2C1AFF047473470DCAC7721D0973119C1AB0F2F3BE70006FF7AAC77B29A5820F`
- **Status:** **EXACT MATCH (100% IDENTICAL)**

### C. Installed Database Functions in Production (`pg_proc`)
Empirically queried from `haofuuvwciqsambgeqyn`:
| Function Name | Owner | Security Definer | Anon Access | Authenticated Access |
| :--- | :--- | :--- | :--- | :--- |
| `resolve_delivery_workspace` | `postgres` | `true` | `REVOKED` | `EXECUTE` |
| `resolve_delivery_entry_workspace` | `postgres` | `true` | `REVOKED` | `EXECUTE` |
| `resolve_naeem_daily_record_workspace` | `postgres` | `true` | `REVOKED` | `EXECUTE` |
| `validate_naeem_daily_record_update` | `postgres` | `true` | `REVOKED` | `EXECUTE` |
| `resolve_naeem_allocation_workspace` | `postgres` | `true` | `REVOKED` | `EXECUTE` |
| `prevent_delivery_workspace_reassignment` | `postgres` | `true` | `REVOKED` | `EXECUTE` |

### D. Installed Triggers on Delivery Tables (`information_schema.triggers`)
| Table Name | Trigger Name | Timing & Event | Action Statement |
| :--- | :--- | :--- | :--- |
| `general_daily_records` | `trg_gen_daily_records_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_delivery_workspace()` |
| `general_daily_records` | `trg_prevent_workspace_reassignment_general_daily_records` | BEFORE UPDATE | `EXECUTE FUNCTION prevent_delivery_workspace_reassignment()` |
| `general_delivery_entries` | `trg_gen_delivery_entries_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_delivery_entry_workspace()` |
| `general_delivery_entries` | `trg_prevent_workspace_reassignment_general_delivery_entries` | BEFORE UPDATE | `EXECUTE FUNCTION prevent_delivery_workspace_reassignment()` |
| `naeem_daily_records` | `trg_naeem_daily_records_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_naeem_daily_record_workspace()` |
| `naeem_daily_records` | `trg_naeem_daily_records_update_validate` | BEFORE UPDATE | `EXECUTE FUNCTION validate_naeem_daily_record_update()` |
| `naeem_routes` | `trg_naeem_routes_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_delivery_workspace()` |
| `naeem_routes` | `trg_prevent_workspace_reassignment_naeem_routes` | BEFORE UPDATE | `EXECUTE FUNCTION prevent_delivery_workspace_reassignment()` |
| `naeem_payments` | `trg_naeem_payments_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_delivery_workspace()` |
| `naeem_payments` | `trg_prevent_workspace_reassignment_naeem_payments` | BEFORE UPDATE | `EXECUTE FUNCTION prevent_delivery_workspace_reassignment()` |
| `naeem_payment_allocations` | `trg_naeem_payment_allocations_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_naeem_allocation_workspace()` |
| `naeem_payment_allocations` | `trg_prevent_workspace_reassignment_naeem_allocations` | BEFORE UPDATE | `EXECUTE FUNCTION prevent_delivery_workspace_reassignment()` |
| `naeem_monthly_balances` | `trg_naeem_monthly_balances_ws_resolve` | BEFORE INSERT | `EXECUTE FUNCTION resolve_delivery_workspace()` |
| `naeem_monthly_balances` | `trg_prevent_workspace_reassignment_naeem_monthly_balances` | BEFORE UPDATE | `EXECUTE FUNCTION prevent_delivery_workspace_reassignment()` |

### E. Installed Constraints in Production
- `naeem_routes_id_workspace_unique` on `naeem_routes (id, workspace_id)`
- `naeem_daily_records_route_workspace_fkey` on `naeem_daily_records (route_id, workspace_id) REFERENCES naeem_routes(id, workspace_id)`
- `general_daily_records_workspace_record_date_key` on `general_daily_records (workspace_id, record_date)`

### F. Installed RLS Policies in Production (`pg_policies`)
All 7 delivery tables have an active `*_workspace_isolation` policy for `{authenticated}` with:
- `USING (has_workspace_access(workspace_id))`
- `WITH CHECK (has_workspace_access(workspace_id))`

### G. Evidence of October 31, 2026 Production Records
Empirical read-only queries retrieved the following active production records:
1. **General Daily Record (31 Oct 2026):**
   - ID: `a642bcee-153f-42ea-a967-07d659eeee5e`
   - Date: `2026-10-31`
   - Workspace ID: `fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15`
   - Delivery Expression: `350 + 20 + 20`
   - Fuel Expenses: `50.00`
   - Remarks: `"Authorized production test 31 Oct"`
2. **NAEEM Daily Record (31 Oct 2026):**
   - ID: `8e51bd9f-d8fd-4dde-b86e-4c1d8b8cdf62`
   - Delivery Date: `2026-10-31`
   - Route ID: `64679006-348f-40ad-9b88-8bc99c51cce2`
   - Workspace ID: `fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15`
   - Standard Fare: `350.00`
   - Final Fare: `350.00`
   - Cash Received: `350.00`
   - Status: `Completed`
   - Notes: `"Authorized production verification entry"`

### H. Verification of Admin Access & Security Role
Queried `profiles` on remote production:
- Administrator profile: `d2631c15-8193-4a2e-a099-40ca56a91523`
- Email: `admin@7time.com`
- Full Name: `Enterprise Administrator`
- System Role: `SUPER_ADMIN`
- Active Status: `is_active = true`
- **Confirmation:** No service-role key or RLS bypass was used to test or view application-level records. Existing enterprise records and admin privileges remain intact.

---

## 3. Granular Review of Every Code Change

### File 1: `src/App.tsx`
- **Original Defect:** Non-admin users could bypass UI navigation checks by entering administrative URLs (`/settings/accounts`, `/backup`, `/audit`) directly into the browser address bar. Legacy route aliases (`/personal-ledger/:id`, `/resellers`) bypassed entitlement checks.
- **Root Cause:** Routes were wrapped only in `<ProtectedRoute>` (which checks user authentication, not roles or entitlements).
- **Exact Change:** Wrapped all domain routes in `<ModuleRouteGuard module="...">` and administrative routes in `<ModuleRouteGuard adminOnly>`. Redirected legacy aliases `/resellers` and `/customers` to canonical `/local-customers`.
- **Regression Risk:** Low. If a user lacks the specific module entitlement, they are cleanly redirected or shown a permission notice instead of a broken page.
- **Test Evidence:** `src/components/auth/ModuleRouteGuard.test.tsx` (7 passed); `src/components/layout/AppLayout.test.tsx` (5 passed).

### File 2: `src/components/auth/ModuleRouteGuard.tsx`
- **Original Defect:** No mechanism existed to guard routes specifically for administrators.
- **Root Cause:** Guard only checked `hasModule(module)`.
- **Exact Change:** Added `adminOnly?: boolean` prop. When `adminOnly && !isAdmin`, attempts redirect via `getDefaultRoute()`; if unavailable, renders a graceful "Administrator Access Required" card.
- **Regression Risk:** Low. Tested with both admin and non-admin states.
- **Test Evidence:** Verified by 7 unit tests in `src/components/auth/ModuleRouteGuard.test.tsx`.

### File 3: `src/components/auth/ModuleRouteGuard.test.tsx`
- **Original Defect:** Zero automated test coverage for administrative route blocking.
- **Root Cause:** Test file did not cover `adminOnly` logic.
- **Exact Change:** Added unit test suite covering non-admin rejection and admin access.
- **Regression Risk:** Zero (test-only file).
- **Test Evidence:** 7/7 tests passing in 69ms.

### File 4: `src/hooks/useModuleAccess.ts`
- **Original Defect:** React hook dependency warning and potential infinite re-render loop on unauthenticated or empty-entitlements renders.
- **Root Cause:** `auth?.entitlements ?? {}` allocated a fresh `{}` object reference on every render, invalidating `useCallback` dependency arrays.
- **Exact Change:** Declared top-level module constant `const EMPTY_ENTITLEMENTS: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>` and assigned `entitlements = auth?.entitlements ?? EMPTY_ENTITLEMENTS`.
- **Regression Risk:** Zero. Reference identity is stable.
- **Test Evidence:** `src/hooks/useModuleAccess.test.ts` (4 passed); Oxlint reports 0 warnings.

### File 5: `src/services/naeemDeliveries.ts`
- **Original Defect:** Editing an existing NAEEM payment created duplicate rows in `naeem_payment_allocations`.
- **Root Cause:** The update branch inserted new allocations without removing existing allocations tied to `payment.id`.
- **Exact Change:**
  ```typescript
  if (payment.id) {
    const { error: delError } = await supabase
      .from("naeem_payment_allocations")
      .delete()
      .eq("payment_id", paymentId)

    if (delError) throw new Error(delError.message)
  }
  ```
- **CRITICAL ARCHITECTURAL DEFECT & REGRESSION RISK:**  
  **Non-Atomic Replacement:** The deletion (`supabase.from("naeem_payment_allocations").delete()`) and the subsequent insertion (`supabase.from("naeem_payment_allocations").insert()`) run as **two independent HTTP REST calls**. They are NOT wrapped in a database transaction (`BEGIN ... COMMIT`).  
  **Failure Mode:** If the `delete` succeeds and the subsequent `insert` fails (e.g. network disconnection, client crash, constraint violation, or trigger error), the existing allocations are **permanently deleted**, leaving the payment with ZERO allocations.  
  **Required Architectural Fix:** Payment allocation updates should be executed via a PostgreSQL RPC function (similar to `record_reseller_payment`), guaranteeing atomic replacement within a single database transaction.
- **Test Evidence:** `src/lib/naeemCalculations.test.ts` (12 passed).

### File 6: `src/pages/reports/index.tsx`
- **Original Defect:** General Delivery CSV exports recorded 0 deliveries on days where delivery counts were logged via arithmetic expressions (e.g., `12+8+4`) without individual child delivery entries.
- **Root Cause:** Export logic only summed `r.entries?.reduce(...)` and ignored `r.delivery_expression`.
- **Exact Change:** Evaluated `parseArithmeticExpression(r.delivery_expression)` when `allDel === 0` and `r.delivery_expression` is present.
- **Regression Risk:** Low. Only affects CSV string formatting; does not mutate database records.
- **Test Evidence:** `src/pages/reports/index.test.tsx` (3 passed).

### File 7: `supabase/functions/gemini-assistant/index.ts`
- **Original Defect:** Oxlint/ESLint unused variable warning for `targetWorkspaceName`; prompt context lacked workspace identity.
- **Root Cause:** Extracted workspace name was not added to `contextData`.
- **Exact Change:** Injected `workspace: { id: targetWorkspaceId, name: targetWorkspaceName, type: targetWorkspaceType }` into `contextData`.
- **Regression Risk:** Low.
- **Test Evidence:** `src/services/aiAssistantSecurity.test.ts` (10 passed); `src/services/aiAssistant.test.ts` (15 passed).

### File 8: `supabase/functions/admin-manage-users/index.ts`
- **Original Defect:** Unchecked error `wsErr` during personal workspace creation in user management.
- **Root Cause:** Missing error logging condition.
- **Exact Change:** Added explicit console error logging if personal workspace insertion fails.
- **Regression Risk:** Zero.

---

## 4. Proposed Migration 05 Security Review (Unapproved Proposal)

**Target File:** `supabase/migrations/20261101050000_commercial_workspace_resolution.sql`  
**Review Status:** **REJECTED AS-IS — REQUIRES REVISION BEFORE USER AUTHORIZATION**

### A. Affected Tables and Insert Paths
- Core Business: `dealers`, `products`, `wholesale_sales`
- Customer/Debtor: `reseller_customers`
- Child Transactions: `purchases`, `dealer_payments`, `customer_credits`, `customer_payment_allocations`, `reseller_payments`

### B. Severe Defect Found: Missing Function Definition
Lines 597, 610, 662, and 701 of Migration 05 attach triggers:
```sql
CREATE TRIGGER trg_prevent_dealer_workspace_change
BEFORE UPDATE ON public.dealers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_reassignment();
```
- **Error:** `CREATE OR REPLACE FUNCTION public.prevent_workspace_reassignment()` is **nowhere in Migration 05**!
- In production, Migration 04 named the function `prevent_delivery_workspace_reassignment()`.
- **Impact:** If executed in production, Migration 05 would abort with:
  `ERROR: 42883: function public.prevent_workspace_reassignment() does not exist`.

### C. Workspace Resolution & Authorization Logic
- `resolve_business_workspace()`: Strictly derives `v_user_id := auth.uid()`. Rejects suspended users (`is_active IS NOT TRUE`). If client provides `workspace_id`, validates active business workspace membership. If omitted, counts active business memberships: requires exactly 1; rejects 0 with `42501 No authorized business workspace` and rejects >1 with `42501 Ambiguous workspace membership`. **Zero hardcoded UUID fallbacks.**
- `resolve_reseller_customer_workspace()`: Accurately checks `contact_type`. Routes `PERSONAL` to active personal workspaces and `BUSINESS` to active business workspaces.
- `resolve_dealer_child_workspace()` & `resolve_customer_child_workspace()`: Correctly inherit parent workspace ID and verify caller membership.
- `resolve_customer_allocation_workspace()`: Validates that parent credit and parent payment belong to the exact same workspace before inserting allocation.

### D. Foreign Keys & Uniqueness Constraints
- Queried production table constraints: there are **zero global unique constraints** on `name` or `phone` across `dealers`, `products`, or `reseller_customers`. Workspaces can operate independently without multi-tenant key collisions.
- Foreign keys to `workspaces(id)` are `ON DELETE RESTRICT`, preventing accidental tenant cascading drops.

### E. Rollback & Transaction Safety
- The migration does not contain destructive statements (`DROP TABLE`, `DROP COLUMN`).
- All statements can run inside a single `BEGIN ... COMMIT` transaction.
- **Condition for Production Readiness:** Must add the missing `CREATE OR REPLACE FUNCTION public.prevent_workspace_reassignment()` definition to the migration before presenting it for user authorization.

---

## 5. Inspection of the Six Audit Deliverables

| Deliverable Document | Claims Verified | Discrepancies & Unsupported Claims Found |
| :--- | :--- | :--- |
| **`7TIME_COMPREHENSIVE_BUG_AUDIT.md`** | Module behaviors, RLS violations, 590 test passes. | Claimed Migration 05 is ready for production; Migration 05 has a missing function definition. |
| **`7TIME_MASTER_BUG_REGISTER.md`** | Accurately describes BUG-01, BUG-03, BUG-04, BUG-06. | 1. Lists BUG-02 as "READY FOR PROD" (blocked by Migration 05 defect).<br>2. Lists BUG-05 as resolved without noting that the fix is non-atomic and introduces data loss risk on failure. |
| **`7TIME_BUG_FIX_CHANGELOG.md`** | Accurately records files changed. | Code snippet shown for `ModuleRouteGuard.tsx` was a simplified mock with `fallbackPath = "/"` rather than the actual implementation. |
| **`7TIME_REGRESSION_TEST_REPORT.md`** | 48 test files, 590 passing tests, Oxlint 0 warnings. | Omitted the earlier failed run (`task-7651`) where `src/pages/inventory/index.test.tsx` failed due to `.single()` vs `.maybeSingle()`. |
| **`7TIME_DATABASE_SECURITY_AUDIT.md`** | Database schema analysis and RLS policies. | 1. Reported generic trigger names (`trg_resolve_delivery_workspace`) instead of actual installed names (`trg_gen_daily_records_ws_resolve`).<br>2. Reported function name `prevent_workspace_reassignment` instead of production name `prevent_delivery_workspace_reassignment`. |
| **`7TIME_PRODUCTION_READINESS_REPORT.md`** | Delivery subsystem readiness confirmed in production. | Failed to note non-atomic allocation replacement in NAEEM payments. |

---

## 6. Remaining Issue Registry (P0 - P3)

| Priority | Issue ID | Area | Summary & Status |
| :--- | :--- | :--- | :--- |
| **P1** | **REM-01** | Database (Local) | `20261101050000_commercial_workspace_resolution.sql` calls `prevent_workspace_reassignment()` which is not defined in the migration file. **Status:** Blocked; must add function definition. |
| **P1** | **REM-02** | Database (Production) | Commercial tables (`dealers`, `products`, `purchases`, etc.) fail insert under RLS until Migration 05 is corrected, reviewed, and authorized. **Status:** Pending Migration 05 fix and authorization. |
| **P2** | **REM-03** | Services (`naeemDeliveries.ts`) | `recordnaeemPayment` executes delete and insert as separate REST calls without transaction wrapping. A failure between calls causes lost allocations. **Status:** Requires conversion to an atomic RPC function. |
| **P3** | **REM-04** | Documentation | Audit deliverables contain trigger name mismatches and simplified snippets. **Status:** Cataloged in this verification report. |

---

## 7. Current Git Branch, HEAD & Working-Tree Status

- **Active Branch:** `feature/7time-multi-account-workspaces`
- **Branch Tracking:** Synchronized with `origin/feature/7time-multi-account-workspaces`
- **HEAD Commit:** `5768c01a6a0ddc7c78ca964fe6844fa2ff419182`
- **Untracked / Protected Branches:** `feature/zakat-tracker-hanafi` is completely untouched.
- **Working-Tree Status:**
  - 13 modified tracked files (clean, passing all lint and build checks).
  - Pre-existing untracked files and test artifacts preserved.
  - Zero uncommitted production schema executions.

---

## 8. Final Recommendation

### Is the application safe for further testing?
**YES, WITH SPECIFIC SCOPE CONSTRAINTS:**
1. **General Daily Delivery & NAEEM Delivery Subsystems:** **100% Safe for Testing in Production.** All RLS policies, dynamic resolution triggers, and composite route keys are empirically verified and stable.
2. **Administrative & Personal Route Security:** **100% Safe.** Route guards prevent unauthorized navigation and have passing automated test coverage.
3. **Commercial Domain (Dealers, Products, Purchases):** **Safe in Local Mock Environments Only.** Production operations on commercial tables remain blocked by RLS until Migration 05 is updated with the missing `prevent_workspace_reassignment()` function definition and explicitly authorized by the user.
4. **NAEEM Payment Edits:** Exercise caution when editing existing payments until the delete-insert sequence is wrapped in an atomic PostgreSQL RPC.

