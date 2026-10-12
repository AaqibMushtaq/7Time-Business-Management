# 7TIME Business Management — Dashboard Data & Accounting Audit

**Document Version:** 1.0  
**Audit Date:** October 2026  
**Audited Target:** Main Dashboard (`src/pages/dashboard/index.tsx`, `src/services/dashboard.ts`)  
**Database Backend:** Supabase (PostgreSQL)  

---

## 1. Executive Summary

This document provides a thorough audit of the main dashboard data sources, metric derivations, accounting rules, and visualization pipelines in **7TIME Business Management**. 

The main dashboard consolidates operations across six functional business modules:
1. **Purchases & Suppliers (Dealers)**
2. **Wholesale Sales & Customers (Resellers)**
3. **Inventory Management & Valuation**
4. **General Daily Deliveries**
5. **Dedicated Delivery Contract (NAEEM)**
6. **Cash Collections & Disbursements**

---

## 2. Metric Inventory & Accounting Audit

| Metric Name | Authoritative Source Table(s) | Scope / Temporal Nature | Calculation / Formula | Consuming UI Elements | Error / Empty Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Purchases** | `purchases` (`total_amount`, `purchase_date`) | Period-filtered (`purchase_date` within selected date range) | `SUM(total_amount)` for purchases in range | Primary Metric Card 1 (`#purchases`) | Returns `₹0.00` if no purchases exist in period |
| **Wholesale Sales** | `wholesale_sales` (`total_sale`, `sale_date`) | Period-filtered (`sale_date` within selected date range) | `SUM(total_sale)` for sales in range | Primary Metric Card 2 (`#sales`), Chart 1 Revenue | Returns `₹0.00` if no sales exist in period |
| **Realized Wholesale Profit** | `wholesale_sales` (`profit`, `buying_cost`, `wholesale_price`, `quantity`, `sale_date`) | Period-filtered (`sale_date` within selected date range) | `SUM(profit)` where `profit = (wholesale_price - buying_cost) * quantity`. Profit recognized at point of sale. | Primary Metric Card 3 (`#profit`), Chart 1 Profit | Returns `₹0.00` if no sales exist in period |
| **Current Inventory Valuation** | `products` (`buying_cost`, `stock_quantity`) | **Live Snapshot (All-time Current)** | `SUM(buying_cost * stock_quantity)`. Represents real-time capital locked in physical stock. | Primary Metric Card 4 (`#inventory`), Inventory Summary | Returns `₹0.00` if product list is empty |
| **We Owe Dealers (Total Payable)** | `purchases` (`total_amount`, `amount_paid`), `dealer_payments` (`amount`) | **Cumulative Liability (All-time)** | For each dealer: `Balance = SUM(total_amount - amount_paid) - SUM(dealer_payments.amount)`. `TotalPayable = SUM(MAX(0, Balance))`. Does not reset across period filters. | Primary Metric Card 5 (`#we-owe`), Top Dealer Payables Table | Returns `₹0.00` with "All dealer accounts are settled." |
| **Resellers Owe Us (Total Receivable)** | `wholesale_sales` (`total_sale`, `amount_received`), `reseller_payments` (`amount`) | **Cumulative Asset (All-time)** | For each reseller: `Balance = SUM(total_sale - amount_received) - SUM(reseller_payments.amount)`. `TotalReceivable = SUM(MAX(0, Balance))`. Does not reset across period filters. | Primary Metric Card 6 (`#they-owe`), Top Reseller Receivables Table | Returns `₹0.00` with "No outstanding reseller receivables." |
| **Net Cash Flow** | `wholesale_sales.amount_received`, `reseller_payments.amount`, `purchases.amount_paid`, `dealer_payments.amount`, `general_daily_records.fuel_expenses` | Period-filtered (Actual cash movements within selected date range) | `Inflows - Outflows`<br>• Inflows: `SUM(wholesale_sales.amount_received) + SUM(reseller_payments.amount)`<br>• Outflows: `SUM(purchases.amount_paid) + SUM(dealer_payments.amount) + SUM(general_daily_records.fuel_expenses)` | Primary Metric Card 7 (`#cash-flow`), Chart 2 (Cash Flow & Collections) | Returns `₹0.00` if no cash movements exist in period |
| **General Daily Delivery (Net)** | `general_daily_records`, `general_delivery_entries` | Period-filtered (`record_date` within selected date range) | `Gross Delivery Total - Fuel Expenses`<br>• Gross: `SUM(entries.amount)`<br>• Fuel: `SUM(fuel_expenses)` | Primary Metric Card 8 (`#delivery-net`), General Delivery Summary | Displays `₹0.00` with 0 active days |
| **NAEEM Dedicated Delivery** | `naeem_daily_records`, `naeem_payments`, `naeem_monthly_balances` | Period-filtered (Month-specific ledger) | • `Total Due = Opening Balance + SUM(final_fare where status != 'No Order')`<br>• `Outstanding = Total Due - SUM(naeem_payments.amount)` | NAEEM Dedicated Summary Card | Displays `₹0.00` if settled or no trips recorded |
| **Recent Business Activity** | `purchases`, `dealer_payments`, `wholesale_sales`, `reseller_payments` | Unified cross-module event log | Normalized events sorted descending by timestamp | Recent Business Activity Table | Displays "No recent activity recorded for this period." |

---

## 3. Zero-Balance Observations & Reconciliation

### Why are some balances zero despite transaction activity?
During the initial audit, it was noted that some dealer or reseller balances showed `₹0.00` even though purchase or sales records existed in the database:
1. **Fully Settled Accounts:** When a purchase is paid in full at the time of invoice (`amount_paid = total_amount`) or settled via a subsequent payment (`dealer_payments`), the remaining liability is mathematically `₹0.00`. This is verified as correct accounting behavior and should not be fabricated into a non-zero figure.
2. **Prior Month Purchases / Settled Liabilities:** Cumulative payables and receivables evaluate the total ledger across all historical transactions. If all historical invoices have matching payments, the current balance is zero.
3. **Separation of Cash vs Credit:** 
   - When a wholesale sale is recorded with `payment_method = 'cash'`, `amount_received` equals `total_sale`. In this case, `total_sale - amount_received = 0`, resulting in no receivable liability.
   - When recorded as `credit` or partial payment, the unpaid remainder becomes a receivable.

---

## 4. Double-Counting Prevention in Cash Flow

To guarantee strict accounting integrity in both the KPI cards and the new **Cash Flow & Collections** chart:
1. **Wholesale Sales vs Reseller Payments:**
   - When a sale occurs, any immediate cash collected is recorded in `wholesale_sales.amount_received`.
   - Any later debt settlement is recorded in `reseller_payments.amount`.
   - These are separate financial events at different timestamps. Summing `wholesale_sales.amount_received + reseller_payments.amount` captures all cash inflows without double-counting.
2. **Supplier Purchases vs Dealer Payments:**
   - Any initial down payment is recorded in `purchases.amount_paid`.
   - Subsequent debt payments to suppliers are recorded in `dealer_payments.amount`.
   - Summing `purchases.amount_paid + dealer_payments.amount` captures all purchase-related cash outflows without double-counting gross purchase invoices.
3. **Delivery Expenses:**
   - General delivery `fuel_expenses` are operational cash outflows paid during the delivery day.

---

## 5. Architectural Improvements Implemented

1. **All-Time Dealer & Reseller Names:** Previously, dealers or resellers who had historical outstanding balances but zero transactions in the currently selected date range had their names default to `'Unknown'`. By joining or querying the master `dealers` and `reseller_customers` directories, all balances display their authentic business partner names.
2. **Dynamic Cash Flow Chart Pipeline:** Implemented daily aggregation of cash inflows and outflows in `getDashboardStats`, populating the new **Cash Flow & Collections** interactive chart.
3. **Code Splitting & Lazy Loading:** Both `SalesTrendChart` (Business Performance Trends) and `CashFlowChart` (Cash Flow & Collections) are dynamically lazy-loaded using `React.lazy()` and `Suspense`, preventing heavy Recharts SVG rendering logic from bloating the critical startup bundle.
4. **7TIME Light Theme Compliance:** Strict styling with `#2D7FF9` (Royal Blue), `#4A39D6` (Indigo), `#33C5F3` (Sky Blue), `#0E2A47` (Navy), and semantic status colors.

---

## 6. Unified Executive Dashboard Architecture

To eliminate dashboard clutter, redundant cards, and competing visual sections, the main dashboard was restructured into four clear executive layers:

### Layer 1: Compact Executive KPI Cards (Top)
- **Total Purchases:** Period-based gross supplier invoices.
- **Sales / Delivery Revenue:** Consolidated commercial revenue (`Wholesale Sales + General Delivery Gross + NAEEM Billed`).
- **Cash In:** Actual period collections (`Wholesale cash received + Reseller debt payments + General delivery cash + NAEEM payments received`).
- **Cash Out:** Actual disbursements (`Purchase down-payments + Dealer debt payments + Delivery fuel expenses`).
- **Receivables:** Genuine customer credit owed to the business (`Reseller receivables + NAEEM pending balance`).
- **Payables:** Genuine supplier liabilities (`Dealer payables`).

### Layer 2: ONE Unified Business Performance Container
- Consolidates all four business areas (**Dealer Operations**, **Wholesale & Resellers**, **General Delivery**, **NAEEM Dedicated**) into one interactive container.
- **Monthly vs All Time toggle:** Allows instant switching between selected monthly performance and all-time cumulative overview.
- **Interactive Metric Selector:**
  - `REVENUE`: Revenue & Billings comparative view.
  - `CASH_FLOW`: Cash In vs Cash Out comparative view.
  - `OUTSTANDING`: Receivables vs Payables comparative view.
  - `PROFIT`: Realized Wholesale Margins and Operational Net contributions.
- **Summary Breakdown Row:** 4 concise status tiles beneath the chart detailing unit-level performance.

### Layer 3: Compact Accounts to Collect / Payments to Make
- Replaced separate oversized 6-row tables with two balanced panels:
  - **Accounts to Collect:** Top 3 customer credit balances + Total Due.
  - **Payments to Make:** Top 3 supplier debt balances + Total Due.
  - Includes positive empty state verification when all accounts are settled.

### Layer 4: Compact Quick Actions
- 6 essential icon-led actions with direct navigation to core business modules (`/purchases`, `/wholesale`, `/dealers`, `/general-deliveries`, `/naeem`, `/reports`).
