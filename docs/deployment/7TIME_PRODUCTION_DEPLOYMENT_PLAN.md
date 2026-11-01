# 7TIME BUSINESS MANAGEMENT — CONTROLLED PRODUCTION DEPLOYMENT PLAN
## Multi-Account, Delivery RPC & Commercial Workspace Resolution

**Project:** 7TIME Business Management  
**Supabase Production Project Ref:** `haofuuvwciqsambgeqyn`  
**Region:** `ap-south-1` (Mumbai)  
**Database Host:** `db.haofuuvwciqsambgeqyn.supabase.co`  
**Git HEAD:** `0bdd0f70f815e307151c4e2443d1cd2d4895e2e6`  
**Branch:** `feature/7time-multi-account-workspaces`  

---

## 1. DEPLOYMENT GOVERNANCE & GATING

To prevent partial states or service disruptions, production rollout must be executed as **independent, sequential gates**. Authorization for one step does NOT grant authorization for subsequent steps.

```
┌────────────────────────────────────────────────────────┐
│  GATE 1: PRE-FLIGHT VERIFICATION & BACKUP READINESS    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  GATE 2: APPLY MIGRATION 41000 (NAEEM ALLOCATION RPC)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  GATE 3: DEPLOY COMPATIBLE FRONTEND (COMMIT 0bdd0f70)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  GATE 4: APPLY MIGRATION 05 (COMMERCIAL RESOLUTION)    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  GATE 5: DEPLOY EDGE FUNCTIONS (ADMIN & GEMINI)        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  GATE 6: CONTROLLED PRODUCTION SMOKE TESTING           │
└────────────────────────────────────────────────────────┘
```

---

## 2. GATE 1 — PRE-FLIGHT VERIFICATION & BACKUP READINESS

Prior to executing any production SQL, verify:
1. **Target Project Identity:** `npx supabase status` confirms linked ref is strictly `haofuuvwciqsambgeqyn`.
2. **Backup Recoverability:** Verified that `production_pre_migration_backup_20261101_2026-11-01T09-52-32-682Z.sql` (SHA-256: `DCE3833FCDA052BA1260D282A655B94139B541B8C4B8483D75BA7A738670AE60`) was proven restorable in local isolated PostgreSQL.
3. **Migration Checksums:**
   - Migration 41000: `7C7A5BB6C503A538E34FDCFC712E5DB09782BCFAAE6BE0BFABC79725F2950BDF`
   - Migration 05: `361B02CA664406E2D034398DFFB007EAF1C29AC3504BCCA2B88646A198D4F86A`
4. **Remote History:** Confirm `20261101040000` is the latest applied migration in `supabase_migrations.schema_migrations`.

---

## 3. GATE 2 — DEPLOYMENT PROCEDURE: MIGRATION 41000

**File:** `supabase/migrations/20261101041000_naeem_payment_allocation_rpc.sql`  
**Objective:** Add `record_naeem_payment_with_allocations` RPC for atomic payment recording and allocation replacement.

### Pre-Deployment Checks:
- Confirm caller is linked to production Supabase via Supabase CLI.
- Verify that `naeem_payments` and `naeem_payment_allocations` tables exist in `public`.

### Application Command:
```powershell
npx supabase db query --linked --file "supabase/migrations/20261101041000_naeem_payment_allocation_rpc.sql"
```

### Post-Deployment Verification Queries:
```sql
-- 1. Check RPC function signature, security definer, and volatility
SELECT p.proname, p.prosecdef, p.provolatile, pg_get_userbyid(p.proowner) as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'record_naeem_payment_with_allocations';

-- 2. Verify grants
SELECT grantee, privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' AND routine_name = 'record_naeem_payment_with_allocations';
-- Expected: authenticated and service_role have EXECUTE; anon has NO privilege.

-- 3. Verify migration record registered
SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '20261101041000';
```

### Rollback Procedure (If Required):
```sql
BEGIN;
DROP FUNCTION IF EXISTS public.record_naeem_payment_with_allocations(
    UUID, DATE, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, UUID, JSONB
);
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261101041000';
COMMIT;
```

---

## 4. GATE 3 — FRONTEND DEPLOYMENT: COMMIT `0bdd0f70f815e307151c4e2443d1cd2d4895e2e6`

**Objective:** Deploy updated frontend code consuming `record_naeem_payment_with_allocations` with backward-compatible REST fallback.

### Compatibility Analysis:
- `src/services/naeemDeliveries.ts` contains an automatic fallback check (`isMissingRpc` detector). If the RPC is present, it executes atomically; if the RPC returns code `42883` or `PGRST202`, it falls back to the legacy sequence.
- Therefore, deploying the frontend after Gate 2 ensures 100% zero-downtime compatibility.

### Deployment Command:
Deploy through standard hosting pipeline (e.g., Vercel, Netlify, or static build):
```powershell
npm run build
# Publish dist/ output
```

---

## 5. GATE 4 — DEPLOYMENT PROCEDURE: MIGRATION 05

**File:** `supabase/migrations/20261101050000_commercial_workspace_resolution.sql`  
**Objective:** Add automatic enterprise workspace resolution and immutability triggers to all commercial tables (`dealers`, `products`, `purchases`, `dealer_payments`, `wholesale_sales`, `reseller_customers`, `customer_credits`, `customer_payment_allocations`, `reseller_payments`).

### Pre-Deployment Checks:
- Confirm that 100% of existing rows across all 9 commercial tables currently have valid, non-null `workspace_id`.
- Confirm that Primary Workspace `fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15` is active.

### Application Command:
```powershell
npx supabase db query --linked --file "supabase/migrations/20261101050000_commercial_workspace_resolution.sql"
```

### Post-Deployment Verification Queries:
```sql
-- 1. Verify triggers attached to all 9 commercial tables
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE 'trg_%_workspace_%'
ORDER BY event_object_table, trigger_name;
-- Expected: 9 insert triggers (resolve) and 9 update triggers (immutability).

-- 2. Verify migration record registered
SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '20261101050000';
```

### Rollback Procedure (If Required):
Execute rollback script `supabase/migrations/rollback/rollback_multi_account.sql` or targeted trigger drops:
```sql
BEGIN;
-- Drop commercial resolution triggers
DROP TRIGGER IF EXISTS trg_products_workspace_default ON public.products;
DROP TRIGGER IF EXISTS trg_immutable_ws_products ON public.products;
DROP TRIGGER IF EXISTS trg_purchases_workspace_default ON public.purchases;
DROP TRIGGER IF EXISTS trg_immutable_ws_purchases ON public.purchases;
DROP TRIGGER IF EXISTS trg_dealers_workspace_default ON public.dealers;
DROP TRIGGER IF EXISTS trg_immutable_ws_dealers ON public.dealers;
DROP TRIGGER IF EXISTS trg_dealer_payments_workspace_default ON public.dealer_payments;
DROP TRIGGER IF EXISTS trg_immutable_ws_dealer_payments ON public.dealer_payments;
DROP TRIGGER IF EXISTS trg_wholesale_sales_workspace_default ON public.wholesale_sales;
DROP TRIGGER IF EXISTS trg_immutable_ws_wholesale_sales ON public.wholesale_sales;
DROP TRIGGER IF EXISTS trg_reseller_customers_workspace_default ON public.reseller_customers;
DROP TRIGGER IF EXISTS trg_immutable_ws_reseller_customers ON public.reseller_customers;
DROP TRIGGER IF EXISTS trg_customer_credits_workspace_default ON public.customer_credits;
DROP TRIGGER IF EXISTS trg_immutable_ws_customer_credits ON public.customer_credits;
DROP TRIGGER IF EXISTS trg_cust_alloc_workspace_default ON public.customer_payment_allocations;
DROP TRIGGER IF EXISTS trg_immutable_ws_customer_allocations ON public.customer_payment_allocations;
DROP TRIGGER IF EXISTS trg_reseller_payments_workspace_default ON public.reseller_payments;
DROP TRIGGER IF EXISTS trg_immutable_ws_reseller_payments ON public.reseller_payments;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261101050000';
COMMIT;
```

---

## 6. GATE 5 — EDGE FUNCTION DEPLOYMENT

**Functions:**
1. `admin-manage-users` (Account management, module entitlements, password resets)
2. `gemini-assistant` (Conversational AI assistant with multi-tenant boundary filters)

### Deployment Commands:
```powershell
npx supabase functions deploy admin-manage-users --project-ref haofuuvwciqsambgeqyn
npx supabase functions deploy gemini-assistant --project-ref haofuuvwciqsambgeqyn
```

---

## 7. GATE 6 — CONTROLLED PRODUCTION SMOKE TESTING

Once all components are deployed, execute non-destructive smoke testing under administrator credentials:
1. **Authentication:** Log in as administrator `d2631c15-8193-4a2e-a099-40ca56a91523`.
2. **Workspace Verification:** Verify active workspace displays `Primary Workspace`.
3. **Product Catalog:** Open Products page; verify catalog loads all 23 items.
4. **General Daily Delivery:** Open General Deliveries; navigate October/November views.
5. **NAEEM Deliveries:** Verify routes (7 routes), monthly balances (2 balances), and driver payments.
6. **Personal Ledger:** Verify local customers and outstanding ledger balances.
7. **Reports:** Verify financial summary metrics match expected ledger calculations.
8. **Settings & Account Management:** Verify module entitlement controls for managed accounts.

---

> [!CAUTION]
> **Production Gate Status: READY FOR AUTHORIZATION**  
> All preparation, validation, and isolated testing are complete. No commands in this plan will be executed against `haofuuvwciqsambgeqyn` without explicit user instruction.

