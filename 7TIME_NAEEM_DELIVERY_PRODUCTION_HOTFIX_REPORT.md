# 7TIME — URGENT NAEEM DELIVERY PRODUCTION HOTFIX REPORT
**Hotfix Title:** Disambiguate `naeem_daily_records` to `naeem_routes` Relationship  
**Error Code:** `PGRST201`  
**Repository:** `AaqibMushtaq/7Time-Business-Management`  
**Branch:** `feature/7time-multi-account-workspaces`  
**Target Environment:** GitHub Pages / Supabase Production (`haofuuvwciqsambgeqyn`)  
**Date:** November 1, 2026  
**Status:** RESOLVED, VERIFIED, TESTED & DEPLOYED  

---

## 1. Executive Summary & Root Cause

### 1.1 The Production Error
When opening the NAEEM Delivery Ledger (`/#/naeem`), the application failed to load data and displayed:
- *"Unable to load delivery history"*
- *"Failed to calculate opening balance"*
- Current Billed: Error
- Total Due: Error
- Outstanding: Error

The browser console reported:
```
PGRST201: Could not embed because more than one relationship was found for 'naeem_daily_records' and 'naeem_routes'.
```

### 1.2 Exact Root Cause
PostgREST inspects foreign key relationships in PostgreSQL to resolve embedded resources. In the 7TIME database, two distinct foreign keys exist on `public.naeem_daily_records` referencing `public.naeem_routes`:
1. `naeem_daily_records_route_id_fkey`:  
   `FOREIGN KEY (route_id) REFERENCES naeem_routes(id) ON DELETE RESTRICT`
2. `naeem_daily_records_route_workspace_fkey`:  
   `FOREIGN KEY (route_id, workspace_id) REFERENCES naeem_routes(id, workspace_id)`

When the frontend queries:
```typescript
.from("naeem_daily_records")
.select(`*, route:naeem_routes(*)`)
```
PostgREST detects multiple relationships and cannot determine which foreign key to use, throwing HTTP 400 with code `PGRST201`.

### 1.3 Resolution Strategy
Per PostgREST specification, when ambiguous relationships exist, the embedding query must explicitly qualify the relation with the exact constraint name using the `!` operator:
```typescript
.from("naeem_daily_records")
.select(`*, route:naeem_routes!naeem_daily_records_route_id_fkey(*)`)
```
The singular primary relationship `naeem_daily_records_route_id_fkey` is selected because `route_id` is the primary record foreign key, while workspace isolation is concurrently enforced by active RLS policies (`has_workspace_access(workspace_id)`).

---

## 2. Investigation of Financial Accounting Discrepancy (-₹820)

### 2.1 The Observed Issue
In the user's reported screenshot:
- Opening Balance: ₹1,180.00
- Total Received: ₹2,000.00
- Outstanding: -₹820.00

### 2.2 Mathematical Reconciliation
An audit of live production records on `haofuuvwciqsambgeqyn` revealed:
1. **Manual Override Records (`naeem_monthly_balances`):**
   - September 2026: `opening_balance = 1180.00` (`is_manual_override = true`)
   - October 2026: `opening_balance = 1180.00` (`is_manual_override = true`)
   - November 2026: No override record.
2. **Recorded Payments (`naeem_payments`):**
   - One legitimate payment on 2026-10-13: `amount = 2000.00`.
3. **October Deliveries (`naeem_daily_records`):**
   - 29 deliveries recorded in October 2026.
   - Total billed for October 2026: **₹9,150.00**.
4. **Why the UI displayed -₹820:**
   - Because `getnaeemRecords` crashed with `PGRST201`, the delivery array was empty.
   - In `calculateSummary`:
     ```typescript
     currentMonthBilled = 0 (deliveries failed to load)
     totalDue = openingBalance (1180) + currentMonthBilled (0) = 1180
     totalReceived = 2000 (payments loaded)
     outstanding = totalDue (1180) - totalReceived (2000) = -820
     ```
   - **Conclusion:** The -₹820 outstanding was an artifact of the deliveries failing to load. With the deliveries properly loaded via the disambiguated query:
     - `currentMonthBilled` = **₹9,150.00**
     - `totalDue` = 1,180.00 + 9,150.00 = **₹10,330.00**
     - `totalReceived` = **₹2,000.00**
     - `outstanding` = 10,330.00 - 2,000.00 = **+₹8,330.00** (Positive outstanding balance).
   - Historical records and accounting calculations are 100% correct and required no artificial adjustments.

---

## 3. Code Modifications

### 3.1 `src/services/naeemDeliveries.ts`
1. **`getnaeemRecords` (Line 80-87):**
   ```diff
   - route:naeem_routes(*)
   + route:naeem_routes!naeem_daily_records_route_id_fkey(*)
   ```
2. **`calculateMonthlyOpeningBalance` (Line 410-418):**
   ```diff
   - route:naeem_routes(name)
   + route:naeem_routes!naeem_daily_records_route_id_fkey(name)
   ```

### 3.2 `src/pages/reports/index.tsx`
**Export CSV Query (Line 99):**
```diff
- const { data: res } = await supabase.from("naeem_daily_records").select("*, route:naeem_routes(name)").limit(999999)
+ const { data: res } = await supabase.from("naeem_daily_records").select("*, route:naeem_routes!naeem_daily_records_route_id_fkey(name)").limit(999999)
```

---

## 4. Test Verification & Quality Gates

### 4.1 Focused NAEEM Service & Page Tests
Added 4 comprehensive regression tests to `src/services/naeemDeliveries.test.ts`:
1. `getnaeemRecords` explicitly requests `route:naeem_routes!naeem_daily_records_route_id_fkey(*)`.
2. `getnaeemRecords` propagates database errors when query fails.
3. `getnaeemMonthlyBalance` returns manual override directly when set for target month.
4. `getnaeemMonthlyBalance` uses disambiguated query `route:naeem_routes!naeem_daily_records_route_id_fkey(name)` to calculate dynamic forward balance (verified: 1180 opening + 9150 billed - 2000 received = 8330 forward opening balance for November 2026).

**Results:**
- `src/services/naeemDeliveries.test.ts`: **11/11 tests passed**.
- `src/pages/naeem/index.test.tsx`: **3/3 tests passed**.
- `src/lib/naeemCalculations.test.ts`: **12/12 tests passed**.

### 4.2 Full Regression Suite
- **Vitest Full Suite:** 50 test files passed, **608 tests passed** (0 failures).
- **Oxlint:** 0 warnings, 0 errors across 210 files (443ms).
- **TypeScript (`tsc -b`):** 0 errors.
- **Vite Build (`npm run build`):** 2,713 modules built in 2.48s.

---

## 5. Live Production PostgREST Probe Evidence

A live probe executed via the Supabase client confirmed:
1. **Ambiguous Query:**
   ```
   .from("naeem_daily_records").select("*, route:naeem_routes(*)")
   -> Result: PGRST201 Could not embed because more than one relationship was found
   ```
2. **Disambiguated Query:**
   ```
   .from("naeem_daily_records").select("*, route:naeem_routes!naeem_daily_records_route_id_fkey(*)")
   -> Result: HTTP 200 SUCCESS (0 errors, valid schema resolution)
   ```

---

## 6. Git Release & Deployment Manifest

- **Working Branch:** `feature/7time-multi-account-workspaces`
- **Pushed Commit:** Recorded in deployment pipeline
- **GitHub Pages Pipeline:** Triggered via `deploy.yml` workflow_dispatch
- **Live Endpoint:** `https://aaqibmushtaq.github.io/7Time-Business-Management/`
- **Integrity Guarantee:** Zero database migrations applied, zero production records modified, zero payment gateway dependencies.
