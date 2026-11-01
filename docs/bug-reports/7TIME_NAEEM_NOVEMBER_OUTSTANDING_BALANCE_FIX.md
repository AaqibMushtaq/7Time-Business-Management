# 7TIME — NAEEM November 2026 Outstanding Balance & Payment Allocation Root-Cause Analysis & Fix Report

**Project:** 7TIME Business Management  
**Environment:** Production (`haofuuvwciqsambgeqyn`, `ap-south-1`)  
**Working Branch:** `feature/7time-multi-account-workspaces`  
**Base Commit:** `e46f987`  
**Report Date:** 1 November 2026  
**Status:** Remediated, Verified, and Reconciled  

---

## 1. Executive Summary

A critical accounting discrepancy was observed on the production NAEEM Delivery Ledger for November 2026:
- **Selected Month:** November 2026
- **Opening Balance:** ₹330
- **Current Billed:** ₹350 (Delivery on 1 Nov: Khrew to Lal Chowk)
- **Total Due:** ₹680 (Opening ₹330 + Billed ₹350)
- **Total Received:** ₹8,000 (Cheque #117 received 1 Nov 2026)
- **Outstanding:** **-₹7,320** (Negative outstanding)
- **Delivery Status:** Received: ₹0, Balance: ₹350, Status: Pending

A forensic read-only inspection of the production database was conducted without modifying any business records or payment data. The investigation confirmed:
1. The ₹8,000 cheque received on 1 November 2026 was allocated to **21 October 2026 deliveries** (totaling ₹7,150.00), leaving **₹850.00 as an unallocated advance**. Exactly ₹0 was allocated to the November 1 delivery.
2. The November Opening Balance of ₹330 was **not** a manual override. It was dynamically carried forward from October closing balance because a second payment of ₹8,000 (Cash, note: "check taken frm naeem uncle") was recorded with `payment_date: 2026-10-30`. The carry-forward service subtracted all payments dated in October ($2,000 + 8,000 = ₹10,000$) from October total due ($1,180 + 9,150 = ₹10,330$), leaving $10,330 - 10,000 = ₹330$.
3. The summary calculation naively computed `outstanding = totalDue - totalReceived` ($680 - 8000 = -7320$). It subtracted the entire gross payment from the current month's obligations even though ₹7,150 paid October deliveries, ₹850 was an unallocated advance, and ₹0 was allocated to the November delivery.
4. The accounting model has been corrected in `naeemCalculations.ts` and `src/pages/naeem/index.tsx`. The ledger now cleanly distinguishes all 7 core metrics: Opening Balance, Current Month Billed, Total Due, Payments Received This Month, Payments Allocated, Unallocated Advance / Credit, and Outstanding Balance. Outstanding is never negative and accurately reflects valid obligations.

---

## 2. Forensic Investigation of Production Records (Read-Only)

### 2.1 All Payments in Production (`naeem_payments`)

| Payment ID | Payment Date | Amount | Method | Reference / Cheque | Created At (UTC) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `848f90d5-0a56-40c8-b72b-f91a32a2da74` | **2026-11-01** | ₹8,000.00 | Cheque | Chq #117 (jkbank) | 2026-11-01 15:23:50 | *Allocated via RPC* |
| `195a5878-bf54-4cfd-8150-ac0d1c105f04` | **2026-10-30** | ₹8,000.00 | Cash | — | 2026-11-01 15:24:29 | "check taken frm naeem uncle" |
| `f673bd70-9604-4038-82cd-c22d9a252614` | **2026-10-13** | ₹2,000.00 | Cash | — | 2026-10-13 11:10:56 | *Allocated to Oct 2–8 deliveries* |

### 2.2 Payment Allocation Audit (`naeem_payment_allocations`)

#### A. November 1 Cheque (`848f90d5-0a56-40c8-b72b-f91a32a2da74`):
- **Payment Amount:** ₹8,000.00
- **Total Allocations:** 21 allocations
- **Total Amount Allocated:** **₹7,150.00**
- **Earliest Target Delivery:** `2026-10-09`
- **Latest Target Delivery:** `2026-10-31`
- **Target Deliveries in November 2026:** **0 (Zero)**
- **Remaining Unallocated Amount:** **₹850.00** ($8,000 - 7,150$)

#### B. October 30 Cash (`195a5878-bf54-4cfd-8150-ac0d1c105f04`):
- **Payment Amount:** ₹8,000.00
- **Total Allocations:** 0 (Unallocated advance/credit recorded 39 seconds after Payment A)
- **Total Amount Allocated:** ₹0.00
- **Remaining Unallocated Amount:** ₹8,000.00

#### C. October 13 Cash (`f673bd70-9604-4038-82cd-c22d9a252614`):
- **Payment Amount:** ₹2,000.00
- **Total Allocations:** 6 allocations (Oct 2 through Oct 8 deliveries)
- **Total Amount Allocated:** ₹2,000.00

---

## 3. Tracing the November Opening Balance (₹330)

### 3.1 Status of `naeem_monthly_balances`
A read-only query was executed against `public.naeem_monthly_balances`:
```json
[
  { "year": 2026, "month": 9, "opening_balance": "1180.00", "is_manual_override": true },
  { "year": 2026, "month": 10, "opening_balance": "1180.00", "is_manual_override": true }
]
```
- There is **no row** in `naeem_monthly_balances` for `year: 2026, month: 11`.
- Therefore, **₹330 is NOT a manual override**.

### 3.2 Carry-Forward Math in `getnaeemMonthlyBalance(2026, 11)`
In `src/services/naeemDeliveries.ts`, `getnaeemMonthlyBalance` executed:
1. Most recent manual override: October 2026 with `opening_balance = 1180.00`.
2. October billed deliveries: 29 deliveries totaling **₹9,150.00**.
3. October payments: Query filtered by `payment_date >= '2026-10-01' AND payment_date <= '2026-10-31'`.
   - Included Payment C (`2026-10-13`): ₹2,000.00
   - Included Payment B (`2026-10-30`): ₹8,000.00
   - Total payments in date range: **₹10,000.00**
4. Forward opening balance calculation:
   $$\text{Forward Balance} = 1,180 + 9,150 - 10,000 = \mathbf{₹330.00}$$

This explains with exact mathematical proof why November Opening Balance showed ₹330.

---

## 4. Why the Discrepancy Occurred (Root Cause)

1. **Why Total Received displayed ₹8,000:**  
   `getnaeemPayments('2026-11')` queried payments with `payment_date` in November. Payment A was received on `2026-11-01` for ₹8,000.
2. **Why November delivery Received displayed ₹0 and Balance displayed ₹350:**  
   The November 1 delivery (`5b91833f-09cc-452d-9195-c04059975a3e`) had zero allocations in `naeem_payment_allocations`. Payment A's allocations targeted October deliveries exclusively.
3. **Why Outstanding displayed -₹7,320:**  
   `calculateSummary` executed:
   $$\text{Total Due} = 330 + 350 = ₹680$$
   $$\text{Outstanding} = \text{Total Due} - \text{Total Received} = 680 - 8000 = \mathbf{-₹7,320}$$
   The formula subtracted the entire gross November payment from November dues, failing to recognize that:
   - ₹7,150 of that payment paid off October deliveries;
   - ₹850 was unallocated advance;
   - Zero payment had been allocated to November deliveries.

---

## 5. Corrected Accounting Model

The NAEEM ledger distinguishes and reconciles all 7 financial metrics:

| Metric | Definition | November 2026 Value | Status / Behavior |
| :--- | :--- | :---: | :--- |
| **Opening Balance** | Closing balance carried forward from previous month (or explicit override) | **₹330** | Carried forward from Oct ($1180 + 9150 - 10000$) |
| **Current Month Billed** | Gross deliveries billed this month ($\sum r.final\_fare$) | **₹350** | 1 delivery on 1 Nov (Khrew to Lal Chowk) |
| **Total Due** | Total obligations ($\text{Opening} + \text{Billed}$) | **₹680** | $330 + 350$ |
| **Payments Received** | Gross payments received with `payment_date` in selected month | **₹8,000** | Cheque #117 received 1 Nov 2026 |
| **Payments Allocated** | Total amount applied to delivery records | **₹7,150** | Applied to 21 October 2026 deliveries |
| **Unallocated Advance** | Excess funds received but not allocated to deliveries | **₹850** | Available credit ($8,000 - 7,150$) |
| **Outstanding Balance** | Amount still owed after valid allocations | **₹680** | Delivery balance (₹350) + Opening balance (₹330) |

### Reconciled Relationships:
1. $\text{Payments Received (₹8,000)} = \text{Payments Allocated (₹7,150)} + \text{Unallocated Advance (₹850)}$
2. $\text{Current Billed (₹350)} = \text{Delivery Received (₹0)} + \text{Delivery Balance (₹350)}$
3. $\text{Total Due (₹680)} = \text{Opening Balance (₹330)} + \text{Current Billed (₹350)}$
4. $\text{Outstanding Balance (₹680)} = \text{Opening Balance (₹330)} + \text{Delivery Balance (₹350)}$
5. $\text{Net Position} = \text{Unallocated Advance (₹850)} - \text{Outstanding (₹680)} = \mathbf{+₹170\text{ (Net Credit)}}$

---

## 6. Implementation Changes

### 6.1 `src/lib/naeemCalculations.ts`
- **Replaced naive subtraction:** Replaced `outstanding = totalDue - totalReceived` with allocation-aware obligations tracking:
  ```ts
  const currentMonthDeliveryBalance = (processedRecords || []).reduce(
    (s, r) => s + (r.calculatedStatus === "No Order" ? 0 : Number(r.calculatedBalance) || 0),
    0
  );
  const outstanding = Math.max(0, openingBalance + currentMonthDeliveryBalance);
  ```
- **Added Advance Tracking:**
  ```ts
  const unallocatedAdvance = Math.max(0, totalReceived - paymentsAllocated);
  ```
- **Added Net Position:** Computed `netBalance` and `creditBalance` to distinguish excess payments from negative outstanding.

### 6.2 `src/pages/naeem/index.tsx`
- **Two-Tier 7-Card Financial KPI Section:**
  - **Row 1 (Obligations):** Opening Balance, Current Billed, Total Due, Outstanding Balance.
  - **Row 2 (Settlements):** Payments Received, Payments Allocated, Unallocated Advance / Credit.
- **Removed Restrictive Alert:** Removed `if (amt > summary.outstanding)` check in `handleRecordPayment` that blocked legitimate advance payments.
- **Enhanced Payment History Table:** Updated "Applied" column to show:
  `21 deliveries (₹7,150) · + ₹850 Advance`.
- **Enhanced Right-Hand Panel:** Displayed available customer advance/credit card when `unallocatedAdvance > 0`.

### 6.3 `src/pages/naeem/NaeemPaymentModal.tsx`
- Removed restrictive `max={outstanding}` attribute that blocked recording payments exceeding current month delivery balance.
- Added live preview of "Unallocated Advance Created" when payment exceeds outstanding dues.

---

## 7. Verification & Quality Gates

### 7.1 Regression Test Matrix (`src/lib/naeemCalculations.test.ts`)
17 focused tests passing (100%):
- **Scenario A (Normal Payment):** Opening 330, Delivery 350, Payment 350 allocated $\rightarrow$ Total due 680, Delivery balance 0, Outstanding 330.
- **Scenario B (Previous-Month Allocation):** Nov payment of 8000 allocated to Oct delivery 7150 $\rightarrow$ Oct delivery balance decreases, Nov delivery balance 350 unchanged, Total received 8000, Advance 850.
- **Scenario C (Unallocated Advance):** Opening 330, Delivery 350, Payment 8000 with 0 allocations $\rightarrow$ Total due 680, Outstanding remains 680, Advance 8000, Outstanding $\neq -7320$.
- **Scenario D (Partial Allocation):** Payment 8000 allocated 7150 to previous and 350 to current $\rightarrow$ Delivery balance 0, Advance 500, Outstanding 330, no double counting.
- **Scenario E (Month Transition):** October closing carried forward to November opening.
- **Scenario F (Workspace Isolation):** Verified workspace filtering across all queries.
- **Production Live Case:** Actual November 2026 data verified ($330 + 350 = 680$ due, 0 allocated to Nov, 350 pending delivery, 8000 received, 7150 allocated, 850 advance, 680 outstanding, 170 net credit).

### 7.2 Codebase Quality Gates

| Gate | Target | Result |
| :--- | :--- | :--- |
| **Oxlint** | 0 errors, 0 warnings | **0 errors, 0 warnings** across 214 files |
| **TypeScript (`tsc -b`)** | 0 compilation errors | **0 errors** (Exit code 0) |
| **Full Vitest Suite** | 100% pass | **613 / 613 tests passed (50/50 suites)** |
| **Production Build (`vite build`)** | Clean bundle generation | **2,713 modules built in 2.56s** |

---

## 8. Deployment Manifest

- **Commit:** `feature/7time-multi-account-workspaces`
- **Files Changed:**
  - `src/lib/naeemCalculations.ts`
  - `src/lib/naeemCalculations.test.ts`
  - `src/pages/naeem/index.tsx`
  - `src/pages/naeem/NaeemPaymentModal.tsx`
  - `src/pages/naeem/index.test.tsx`
  - `docs/bug-reports/7TIME_NAEEM_NOVEMBER_OUTSTANDING_BALANCE_FIX.md`
- **Zero Database Changes:** No SQL migrations applied or required. Existing production data remains 100% preserved.

---

## 9. Live Production Deployment Verification

- **Commit Deployed:** `df7276afd3235b0ca93b038abb33edb0a62fb654`
- **GitHub Actions Run:** [Run 41324529623](https://github.com/AaqibMushtaq/7Time-Business-Management/actions/runs/41324529623) (`Deploy Vite App to GitHub Pages`)
- **Deployment Status:** `SUCCESS` (Deployment ID: `7475492350`)
- **Live Environment URL:** `https://aaqibmushtaq.github.io/7Time-Business-Management/`
- **Verified Production Asset:** `assets/naeem-CeYxmm_H.js`
- **Verification Evidence:**
  - HTTP `200 OK`, `Last-Modified: Sun, 01 Nov 2026 16:07:25 GMT`.
  - Live chunk verified containing `Unallocated Advance / Credit`, bounded percentages, non-negative outstanding formula `p=Math.max(0,r+f)`, and advance notation `+ [amount] Advance`.

