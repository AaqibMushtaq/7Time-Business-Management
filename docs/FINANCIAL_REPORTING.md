# FINANCIAL REPORTING & DASHBOARD (Phase 7)

## 1. Audit of Existing Dashboard

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

### Net Cash Movement (To be added)
- **Definition:** Total cash inflows minus total cash outflows for the selected period.
- **Formula:** `(Wholesale Received + Separate Reseller Payments) - (Purchase Initial Payments + Separate Dealer Payments + General Fuel Expenses)`.
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

## 3. Planned Improvements

1. **Month-to-Month Comparisons:** 
   - Add visual indicators (e.g., green up arrow or red down arrow) on primary KPIs comparing the selected period with the previous period.
2. **Net Cash Movement:** 
   - Add a high-level summary of cash flow.
3. **Drill-down Navigation:** 
   - Update summary cards and dealer/reseller tables to link directly to their respective detail pages (e.g., clicking a dealer jumps to `/dealers/:id`).
4. **Export Completeness:** 
   - Update the export queries in `ReportsPage` to disable row limits so multi-thousand-row CSVs aren't truncated by Supabase defaults.
5. **Chart Readability:** 
   - Enhance the wholesale chart tooltip and add visual cues for missing data.
