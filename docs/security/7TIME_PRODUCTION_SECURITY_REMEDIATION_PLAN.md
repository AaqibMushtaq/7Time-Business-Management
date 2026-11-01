# 7TIME — PRODUCTION SECURITY REMEDIATION PLAN

**Date:** 2026-10-31  
**Target Supabase Project:** `haofuuvwciqsambgeqyn` (Production Database)  
**Active Git Branch:** `feature/7time-multi-account-workspaces`  
**Base Commit:** `a985d72979400297dc65c637f6291476bd92a53d` (0 commits ahead, working tree preserved)  
**Execution Posture:** STRICTLY OFFLINE & LOCAL ONLY — No production mutations executed.  

---

## 1. Executive Summary

Following the forensic findings of `7TIME_EMERGENCY_PRODUCTION_STATE_REPORT.md`, this remediation plan provides:
1. Hardened, offline-prepared SQL definitions for `has_workspace_access` and `is_super_admin` closing the `SECURITY DEFINER` search-path vulnerability.
2. Repaired source code for Edge Function `gemini-assistant` with active account verification, module entitlement enforcement, and cross-workspace access rejection.
3. A comprehensive, table-by-table investigation demonstrating why hardcoded enterprise defaults on Personal Ledger tables violate personal privacy, proposing a dynamic parent-inheritance trigger instead.
4. An offline-repaired emergency rollback script covering all 19 operational tables and 20 RLS policies.
5. Local test evidence: **48 / 48 test files passed (581 / 581 tests)**, clean TypeScript check (0 errors), and production build succeeding in 2.78s.

---

## 2. Security-Definer Function Design Correction

### The Identified Flaw
In migration `20261101010000_harden_rls_policies.sql`, `has_workspace_access` and `is_super_admin` were declared as `SECURITY DEFINER` without setting an explicit `search_path`. Remote database query of `pg_proc.proconfig` confirmed `config_settings = null`. This creates a vulnerability where functions inherit the caller's search path, potentially exposing them to temporary object or schema hijacking.

### The Corrected Implementation
Prepared in [`7TIME_SECURITY_FUNCTIONS_CORRECTION.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_SECURITY_FUNCTIONS_CORRECTION.sql):

```sql
CREATE OR REPLACE FUNCTION public.has_workspace_access(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_active BOOLEAN;
    v_role TEXT;
BEGIN
    IF p_workspace_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT is_active, system_role INTO v_is_active, v_role
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_active IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    IF v_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.workspace_members wm
        JOIN public.workspaces w ON w.id = wm.workspace_id
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = v_user_id
          AND wm.is_active = true
          AND w.is_active = true
    );
END;
$$;

ALTER FUNCTION public.has_workspace_access(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_workspace_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_workspace_access(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID) TO service_role;
```

### Safety & Privilege Analysis:
- **`SET search_path = public, pg_temp`**: Schema resolution is explicitly bound to `public`. Table references (`public.profiles`, `public.workspace_members`, `public.workspaces`) are schema-qualified. Placing `pg_temp` last prevents temporary table shadowing attacks.
- **Ownership**: Explicitly assigned to `postgres`.
- **Privilege Revocation**: Stripped from `PUBLIC` and `anon`. Only authenticated sessions and `service_role` can execute.
- **Suspended Account Enforcement**: `v_is_active IS NOT TRUE` immediately returns `FALSE`. Suspended accounts cannot read or write data even if they possess an unexpired JWT.
- **No Parameter Privilege Escalation**: The function queries `workspace_members` strictly filtered by `auth.uid() = v_user_id`. Callers cannot spoof other users' memberships.

---

## 3. AI Assistant Entitlement Enforcement (`gemini-assistant`)

### The Identified Flaw
In the deployed version of `gemini-assistant`, the `ai_assistant` entitlement check was inadvertently placed **inside a string error message template literal**, rendering it dead code.

### The Corrected Implementation
In [`supabase/functions/gemini-assistant/index.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/functions/gemini-assistant/index.ts):

1. **Authentication Verification**:
   ```typescript
   const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(jwt)
   if (authError || !user) {
     return createErrorResponse(401, "INVALID_SESSION", "Authentication failed...", false, geminiModel)
   }
   ```
2. **Account Active Status Verification**:
   ```typescript
   const { data: callerProfile, error: profileErr } = await supabaseUserClient
     .from("profiles")
     .select("id, system_role, is_active")
     .eq("id", user.id)
     .maybeSingle()

   if (callerProfile?.is_active === false) {
     return createErrorResponse(403, "ACCOUNT_SUSPENDED", "Your account has been deactivated...", false, geminiModel)
   }
   ```
3. **Module Entitlement Validation**:
   ```typescript
   const isSuperAdmin = callerProfile?.system_role === "SUPER_ADMIN"
   if (!isSuperAdmin) {
     const { data: aiEnt } = await supabaseUserClient
       .from("user_module_entitlements")
       .select("is_enabled")
       .eq("user_id", user.id)
       .eq("module_id", "ai_assistant")
       .maybeSingle()

     if (!aiEnt || aiEnt.is_enabled !== true) {
       return createErrorResponse(403, "MODULE_DISABLED", "The AI Assistant module is not enabled for your account...", false, geminiModel)
     }
   }
   ```
4. **Workspace Membership Authorization**:
   ```typescript
   const { data: userMemberships } = await supabaseUserClient
     .from("workspace_members")
     .select("workspace_id, role, is_active")
     .eq("user_id", user.id)
     .eq("is_active", true)

   if (!isSuperAdmin && (!userMemberships || userMemberships.length === 0)) {
     return createErrorResponse(403, "NO_ACTIVE_WORKSPACE", "No active workspace membership found...", false, geminiModel)
   }
   ```
5. **No Key Exposure**: `GEMINI_API_KEY` is loaded from server environment (`Deno.env.get("GEMINI_API_KEY")`) and is never sent to or received from the client.
6. **RLS Respect**: All database queries are executed via `supabaseUserClient` with the caller's bearer JWT, ensuring Postgres RLS (`has_workspace_access`) filters all data automatically.

---

## 4. Workspace ID Defaults & Tenancy Isolation

A dedicated review document was compiled at [`7TIME_WORKSPACE_DEFAULTS_REVIEW.md`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_WORKSPACE_DEFAULTS_REVIEW.md).

### Key Architectural Discovery:
- **Commercial Business Tables** (`products`, `dealers`, `purchases`, `wholesale_sales`, `general_deliveries`, `naeem_routes`): Safe for Enterprise Workspace Default (`fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15`).
- **Personal Ledger Tables** (`reseller_customers`, `customer_credits`, `reseller_payments`, `customer_payment_allocations`): **UNSAFE FOR FIXED ENTERPRISE DEFAULT**.
  - A fixed default would assign private lending contacts created by secondary users to the enterprise workspace, exposing private personal debts to all enterprise members!
- **Zero-Leakage Solution**: Parent-Derived Workspace Inheritance Triggers:
  - `customer_credits` inherits `workspace_id` from parent `reseller_customers`.
  - `reseller_payments` inherits `workspace_id` from parent `reseller_customers`.
  - `customer_payment_allocations` inherits `workspace_id` from parent `customer_credits`.
  - RPC function `record_customer_payment_with_allocations` receives `v_workspace_id := (SELECT workspace_id FROM reseller_customers WHERE id = p_customer_id)`.

---

## 5. Existing Production Application Compatibility

| Write Operation | Table | Current Production Status | Failure Root Cause | Remediation Path |
| :--- | :--- | :---: | :--- | :--- |
| Create Product | `products` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on `products` |
| Create Dealer | `dealers` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on `dealers` |
| Record Purchase | `purchases` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on `purchases` |
| Dealer Payment | `dealer_payments` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on `dealer_payments` |
| Wholesale Sale | `wholesale_sales` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on `wholesale_sales` |
| Add Personal Contact | `reseller_customers` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Context-aware fallback trigger |
| Record Debt / Loan | `customer_credits` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Inherit from `reseller_customers` |
| Customer Settlement | `reseller_payments` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Inherit from `reseller_customers` |
| Payment RPC | `record_customer_payment_with_allocations` | **FAILS** | Internal RPC insert omits `workspace_id` | Patch RPC to inherit `customer_id` workspace |
| General Delivery Daily | `general_daily_records` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on delivery tables |
| NAEEM Daily Record | `naeem_daily_records` | **FAILS** | Omitted `workspace_id` with `NOT NULL DEFAULT NULL` | Enterprise Default on NAEEM tables |
| **Record Zakat Wealth** | `zakat_wealth_entries` | **SAFE** | No `workspace_id` column; strictly user-scoped | Fully operational |
| **Update Zakat Settings** | `zakat_user_settings` | **SAFE** | No `workspace_id` column; strictly user-scoped | Fully operational |

---

## 6. Rollback Readiness & Dependency Plan

A dedicated review document was compiled at [`7TIME_ROLLBACK_COMPLETENESS_REVIEW.md`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_ROLLBACK_COMPLETENESS_REVIEW.md).

- **Data Snapshot:** [`supabase/migrations/rollback/pre_multi_account_data_backup.json`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/migrations/rollback/pre_multi_account_data_backup.json) contains **261 rows across 21 tables**, verified 100% complete.
- **Rollback Script Repaired:** [`supabase/migrations/rollback/rollback_multi_account.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/migrations/rollback/rollback_multi_account.sql) was offline-repaired to include all 19 tables, recreate open policies for delivery and NAEEM tables, remove functions/triggers, and clean up `schema_migrations`.

---

## 7. Local Test & Build Verification

The remediation source code and security tests were validated offline:

```
> 7time-business-management@1.3.0 test
> vitest run --run

Test Files  48 passed (48)
     Tests  581 passed (581)
  Duration  255.55s
```

### New Security Test Suite:
`src/services/aiAssistantSecurity.test.ts` (6 tests, all passed):
1. Blocks unauthenticated callers before Edge Function invocation (`PASSED`).
2. Handles suspended account (`HTTP 403 ACCOUNT_SUSPENDED`) (`PASSED`).
3. Handles user lacking AI module entitlement (`HTTP 403 MODULE_DISABLED`) (`PASSED`).
4. Handles personal-only user with zero workspace access (`HTTP 403 NO_ACTIVE_WORKSPACE`) (`PASSED`).
5. Rejects unauthorized cross-workspace access attempts (`HTTP 403 WORKSPACE_ACCESS_DENIED`) (`PASSED`).
6. Successfully returns verified insights when caller has legitimate AI access (`PASSED`).

### TypeScript Compilation:
```
$ npx tsc --noEmit
(exited with code 0, 0 errors)
```

### Production Build:
```
$ npm run build
> tsc -b && vite build
✓ 2713 modules transformed.
✓ built in 2.78s (exited with code 0)
```

---

## 8. Remediation Deliverables Summary

| Deliverable | File Path | Status |
| :--- | :--- | :--- |
| **Remediation Plan** | [`7TIME_PRODUCTION_SECURITY_REMEDIATION_PLAN.md`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_PRODUCTION_SECURITY_REMEDIATION_PLAN.md) | Prepared |
| **Security Functions SQL** | [`7TIME_SECURITY_FUNCTIONS_CORRECTION.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_SECURITY_FUNCTIONS_CORRECTION.sql) | Prepared Offline |
| **Corrected Edge Function** | [`supabase/functions/gemini-assistant/index.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/functions/gemini-assistant/index.ts) | Corrected Locally |
| **AI Security Tests** | [`src/services/aiAssistantSecurity.test.ts`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/src/services/aiAssistantSecurity.test.ts) | 6/6 Passing |
| **Workspace Defaults Review** | [`7TIME_WORKSPACE_DEFAULTS_REVIEW.md`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_WORKSPACE_DEFAULTS_REVIEW.md) | Prepared |
| **Rollback Completeness Review** | [`7TIME_ROLLBACK_COMPLETENESS_REVIEW.md`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_ROLLBACK_COMPLETENESS_REVIEW.md) | Prepared |
| **Repaired Rollback Script** | [`supabase/migrations/rollback/rollback_multi_account.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/migrations/rollback/rollback_multi_account.sql) | Repaired Offline |

---

## 9. Final Restrictions & Next Actions Awaiting Authorization

No production commands, database migrations, Edge Function deployments, or Git commits were executed. All changes exist solely in local workspace files.

### Specific Actions Awaiting Your Explicit Approval:

1. **APPR-01 (Database Security Function Patch)**: Apply [`7TIME_SECURITY_FUNCTIONS_CORRECTION.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/7TIME_SECURITY_FUNCTIONS_CORRECTION.sql) to set `search_path = public, pg_temp;` on `has_workspace_access` and `is_super_admin`.
2. **APPR-02 (Application Write Compatibility Patch)**: Apply enterprise defaults on commercial tables and parent-inheritance triggers on personal ledger tables to unblock older frontend write operations.
3. **APPR-03 (Edge Function Redeploy)**: Deploy corrected `gemini-assistant` to re-enable AI module entitlement verification.
4. **APPR-04 (Frontend Deployment Authorization)**: Authorize staging, committing, and pushing `feature/7time-multi-account-workspaces` to make the frontend fully workspace-aware.
5. **APPR-05 (Revert to Single-Tenant)**: Execute [`rollback_multi_account.sql`](file:///C:/Users/Aaqib/7Time%20Business%20%20Management/supabase/migrations/rollback/rollback_multi_account.sql) to return to single-tenant architecture.

---

**AUDIT AND PREPARATION COMPLETE. Execution stopped. Awaiting your explicit instructions.**

