# FINANCIAL REPORTING & DASHBOARD (Phase 7)

> **DOCUMENT CLASSIFICATION: TIER 3 — HISTORICAL PLANNING & METRIC SNAPSHOT (PHASE 7)**  
> **Historical Context:** This document records early financial metric definitions and proposed dashboard improvements designed during Phase 7.  
> **VERIFIED IMPLEMENTATION STATUS:** Items marked below as *"To be added"* (such as Net Cash Movement / Cash Flow) and *"Planned Improvements"* (such as drill-down navigation and cash flow charts) have been **fully implemented in v1.2.1/v1.3.0**.  
> **Authoritative Current Documentation:**  
> - For current authoritative database tables, triggers, and accounting formulas: see [`docs/DATABASE_AND_ACCOUNTING.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DATABASE_AND_ACCOUNTING.md).  
> - For specialized dashboard metric derivations and double-counting prevention: see [`docs/DASHBOARD_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DASHBOARD_AUDIT.md).  

---

## 1. Audit of Existing Dashboard (Phase 7 Baseline)

### Layout and Components
- The dashboard is built primarily in `src/pages/dashboard/index.tsx`.
- It uses standard layout patterns from `src/components/ui/card.tsx`.
- Charts are implemented with `recharts` for wholesale revenue/cost/profit tracking.
- The dashboard has a responsive grid for KPI cards, detailed component cards, and a Recent Activity table.
- Date filters are already wired (`TODAY`, `THIS_WEEK`, `THIS_MONTH`, `LAST_MONTH`, `THIS_YEAR`, `ALL`) via the `DateRange` type.

### Available Business Data
- **Purchases:** Quantities, wholesale values, payments made at the time of purchase (`amount_paid`).
- **Wholesale Sales:** Customer details, total sales, initial received amounts.
- **Separate Ledgers:** `dealer_payments` and `reseller_payments` handle post-transaction cash flows.
- **Inventory:** Dynamic total value and potential revenue derived from current stock levels.
- **General Daily Deliveries:** Daily fuel expenses and nested delivery entries.
- **Naeem Deliveries:** Distinct manual ledger involving manual opening balances, separate allocations, and daily bills.

---

## 2. Metric Dictionary

The metrics displayed on the dashboard are defined as follows based strictly on the existing database schema:

### Total Purchases
- **Definition:** The sum of all `total_amount` values across purchases in the given time period.
- **Source:** `purchases` table.
- **Applicable Date:** `purchase_date`.

### Wholesale Sales
- **Definition:** The sum of all `total_sale` values across wholesale transactions in the given time period.
- **Source:** `wholesale_sales` table.
- **Applicable Date:** `sale_date`.

### Realized Wholesale Profit
- **Definition:** The sum of `profit` (`(wholesale_price - buying_cost) * quantity`) from `wholesale_sales`. Note: Profit is recognized at the time of sale, regardless of when cash is collected.
- **Source:** `wholesale_sales` table.
- **Applicable Date:** `sale_date`.

### Current Inventory Value
- **Definition:** Total value of current stock computed as `sum(buying_cost * stock_quantity)`.
- **Source:** `products` table.
- **Applicable Date:** N/A (Always represents the live, real-time snapshot).

### Net Cash Movement *(Implemented in v1.2.1)*
- **Definition:** Total cash inflows minus total cash outflows for the selected period.
- **Formula:** `(Wholesale Received + Separate Reseller Payments) - (Purchase Initial Payments + Separate Dealer Payments + General Fuel Expenses)`.
- **Status:** *[LIVE & VERIFIED]* Implemented in `src/services/dashboard.ts` and visualized on the Cash Flow & Collections chart.
- **Note:** Excludes Naeem transactions as they operate on an isolated partner ledger.

### We Owe Dealers (Total Payable)
- **Definition:** True, all-time outstanding balance owed to suppliers.
- **Formula:** `sum(purchases.total_amount) - sum(purchases.amount_paid) - sum(dealer_payments.amount)`.
- **Note:** This metric ignores the current date filter because an outstanding payable is a cumulative liability.

### Resellers Owe Us (Total Receivable)
- **Definition:** True, all-time outstanding balance owed by resellers.
- **Formula:** `sum(wholesale_sales.total_sale) - sum(wholesale_sales.amount_received) - sum(reseller_payments.amount)`.
- **Note:** Also ignores the date filter to show true outstanding balance.

### Period-over-Period Change (To be implemented)
- **Definition:** Percentage difference comparing the selected date range to the identically-sized previous period (e.g., This Month vs Last Month).

---

## 3. Planned Improvements Status

1. **Month-to-Month Comparisons:** Visual indicators comparing the selected period with the previous period. *(Status: Evaluated in Executive KPI grid)*.
2. **Net Cash Movement:** High-level summary of cash flow. *(Status: COMPLETED in v1.2.1; see [`docs/DASHBOARD_AUDIT.md`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/docs/DASHBOARD_AUDIT.md))*.
3. **Drill-down Navigation:** Summary cards and tables link directly to respective detail pages. *(Status: COMPLETED)*.
4. **Export Completeness:** Export queries in `ReportsPage` support multi-thousand-row CSV exports. *(Status: COMPLETED)*.
5. **Chart Readability:** Enhanced wholesale chart tooltips with lazy code-splitting. *(Status: COMPLETED)*.
