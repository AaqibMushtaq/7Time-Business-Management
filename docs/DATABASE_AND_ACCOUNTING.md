# 7TIME Business Management — Database Schema & Accounting Engine

**Document Status:** Verified against migrations `00001` through `20261015020000`  
**Last Updated:** October 2026  
**Database Backend:** PostgreSQL 15+ (Supabase)  

---

## 1. Authoritative Database Schema Inventory

The database consists of 14 core business tables organized by domain:

### A. Supplier & Purchasing Domain
1. **`dealers`**
   - **Columns:** `id` (UUID, PK), `name` (TEXT, NOT NULL), `phone` (TEXT), `address` (TEXT), `opening_balance` (NUMERIC(12, 2), DEFAULT 0), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Indexes:** Primary key index on `id`.
2. **`purchases`**
   - **Columns:** `id` (UUID, PK), `dealer_id` (UUID, FK → `dealers.id`), `product_id` (UUID, FK → `products.id`), `quantity` (NUMERIC(10, 2), NOT NULL), `buying_cost` (NUMERIC(10, 2), NOT NULL), `total_amount` (NUMERIC(10, 2), NOT NULL), `amount_paid` (NUMERIC(10, 2), DEFAULT 0), `purchase_date` (DATE, NOT NULL), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Triggers:** `trg_increase_stock_on_purchase` (executes `increase_stock_on_purchase()` to automatically increment `products.stock_quantity`).
3. **`dealer_payments`**
   - **Columns:** `id` (UUID, PK), `dealer_id` (UUID, FK → `dealers.id` ON DELETE CASCADE), `amount` (NUMERIC(10, 2), NOT NULL), `payment_date` (DATE, NOT NULL), `payment_method` (TEXT, DEFAULT 'Cash'), `reference` (TEXT), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).

### B. Products & Inventory Domain
4. **`products`**
   - **Columns:** `id` (UUID, PK), `name` (TEXT, NOT NULL), `category` (TEXT), `buying_cost` (NUMERIC(10, 2), NOT NULL), `wholesale_price` (NUMERIC(10, 2), NOT NULL), `stock_quantity` (NUMERIC(10, 2), NOT NULL DEFAULT 0), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).

### C. Wholesale & Customer Credit Domain
5. **`reseller_customers`**
   - **Columns:** `id` (UUID, PK), `name` (TEXT, NOT NULL), `phone` (TEXT), `address` (TEXT), `opening_balance` (NUMERIC(12, 2), DEFAULT 0), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
6. **`wholesale_sales`**
   - **Columns:** `id` (UUID, PK), `customer_id` (UUID, FK → `reseller_customers.id`), `product_id` (UUID, FK → `products.id`), `quantity` (NUMERIC(10, 2), NOT NULL), `wholesale_price` (NUMERIC(10, 2), NOT NULL), `buying_cost` (NUMERIC(10, 2), NOT NULL), `total_sale` (NUMERIC(10, 2), NOT NULL), `profit` (NUMERIC(10, 2), NOT NULL), `amount_received` (NUMERIC(10, 2), DEFAULT 0), `sale_date` (DATE, NOT NULL), `payment_method` (TEXT, DEFAULT 'cash'), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
   - **Triggers:** `trg_wholesale_sales_stock` (executes `update_stock_on_wholesale_sale()` to decrement `products.stock_quantity` on insert, adjust on update, and restore on delete).
7. **`reseller_payments`**
   - **Columns:** `id` (UUID, PK), `customer_id` (UUID, FK → `reseller_customers.id` ON DELETE CASCADE), `amount` (NUMERIC(10, 2), NOT NULL), `payment_date` (DATE, NOT NULL), `payment_method` (TEXT, DEFAULT 'Cash'), `reference` (TEXT), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
8. **`customer_credits`** (Created in migration `20261015000000`, extended in `20261015030000`)
   - **Columns:** `id` (UUID, PK), `customer_id` (UUID, FK → `reseller_customers.id` ON DELETE CASCADE), `entry_type` (TEXT CHECK IN `'PRODUCT_CREDIT'`, `'CASH_LOAN'`, `'OTHER_CREDIT'`), `funding_source` (TEXT CHECK IN `'7TIME_FUNDS'`, `'PERSONAL_FUNDS'`, nullable for unallocated legacy records), `entry_date` (DATE NOT NULL), `product_id` (UUID, nullable), `product_name` (TEXT, nullable), `category` (TEXT), `quantity` (NUMERIC(12, 2)), `unit` (TEXT), `rate_per_unit` (NUMERIC(12, 2)), `description` (TEXT), `total_amount` (NUMERIC(12, 2) NOT NULL > 0), `amount_paid` (NUMERIC(12, 2) DEFAULT 0), `balance` (NUMERIC(12, 2) DEFAULT 0), `status` (TEXT CHECK IN `'PENDING'`, `'PARTIAL'`, `'PAID'`), `notes` (TEXT), `created_at`, `updated_at`.
   - **Indexes:** Primary key on `id`, index `idx_customer_credits_funding_source` on `customer_credits(funding_source)`.
   - **Triggers:** `trg_customer_credit_defaults` (automatically calculates `balance = total_amount - amount_paid` and status `'PENDING'/'PARTIAL'/'PAID'`).
9. **`customer_payment_allocations`** (Created in migration `20261015000000`)
   - **Columns:** `id` (UUID, PK), `payment_id` (UUID, FK → `reseller_payments.id` ON DELETE CASCADE), `credit_id` (UUID, FK → `customer_credits.id` ON DELETE CASCADE), `amount` (NUMERIC(12, 2) NOT NULL > 0), `notes` (TEXT), `created_at` (TIMESTAMPTZ).
   - **Triggers:** `trg_sync_customer_credit_balance` (executes `sync_customer_credit_balance()` on INSERT, UPDATE, or DELETE to automatically sum allocations, update `customer_credits.amount_paid`, and recalculate balance and status).

### D. General Daily Delivery Domain
10. **`general_daily_records`**
    - **Columns:** `id` (UUID, PK), `record_date` (DATE, NOT NULL, UNIQUE), `fuel_expenses` (NUMERIC(10, 2), DEFAULT 0), `opening_balance` (NUMERIC(10, 2), DEFAULT 0), `remarks` (TEXT), `delivery_expression` (TEXT), `created_at`, `updated_at`.
11. **`general_delivery_entries`**
    - **Columns:** `id` (UUID, PK), `daily_record_id` (UUID, FK → `general_daily_records.id` ON DELETE CASCADE), `customer_name` (TEXT, NOT NULL), `description` (TEXT), `amount` (NUMERIC(10, 2), DEFAULT 0), `received_amount` (NUMERIC(10, 2), DEFAULT 0), `payment_method` (TEXT), `reference` (TEXT), `notes` (TEXT), `created_at`, `updated_at`.

### E. NAEEM Dedicated Delivery Domain
12. **`naeem_routes`**
    - **Columns:** `id` (UUID, PK), `name` (TEXT, NOT NULL), `standard_fare` (NUMERIC(12, 2), NOT NULL), `is_active` (BOOLEAN, DEFAULT TRUE), `created_at`, `updated_at`.
13. **`naeem_daily_records`**
    - **Columns:** `id` (UUID, PK), `route_id` (UUID, FK → `naeem_routes.id`), `delivery_date` (DATE, DEFAULT CURRENT_DATE), `standard_fare` (NUMERIC(12, 2)), `extra_charge` (NUMERIC(12, 2), DEFAULT 0), `final_fare` (NUMERIC(12, 2)), `cash_received` (NUMERIC(12, 2), DEFAULT 0), `payment_method` (TEXT), `balance` (NUMERIC(12, 2), DEFAULT 0), `status` (TEXT), `notes` (TEXT), `created_at`, `updated_at`.
14. **`naeem_payments` & `naeem_payment_allocations`**
    - **Columns:** Separate dedicated payment ledger tracking payments and allocations to daily route trips.
15. **`naeem_monthly_balances`**
    - **Columns:** `id` (UUID, PK), `year` (INT), `month` (INT), `opening_balance` (NUMERIC), `is_manual_override` (BOOLEAN, DEFAULT FALSE), `created_at`, `updated_at`.

---

## 2. Authoritative Accounting Formulas & Rules

> **Bookkeeping Paradigm — Manual Ledger Recording Only:**
> This software is a private management and bookkeeping ledger, NOT a payment processing system. All transactions (goods delivered, stock purchases, settlements received, disbursements made) occur outside the application in real-world commerce. The application never moves funds, processes cards, executes bank transfers, or interfaces with payment gateways (no UPI, Razorpay, Stripe, or webhooks). Payment entries are purely manual bookkeeping records. The UI strictly distinguishes recording from processing: "Record Payment" saves a ledger entry, "Outstanding Balance" is the ledger-calculated balance due, and "Unallocated Advance" represents funds recorded but not yet matched to debit items.

### Rule 1: We Owe Dealers (Cumulative Payable Liability)
- **Formula:**
  $$\text{Balance}_{\text{dealer}} = \text{Opening Balance} + \sum (\text{purchases.total\_amount} - \text{purchases.amount\_paid}) - \sum \text{dealer\_payments.amount}$$
  $$\text{Total Payable} = \sum_{\text{dealers}} \max(0, \text{Balance}_{\text{dealer}})$$
- **Accounting Principles & Implementation Semantics:**
  - Owed debt is cumulative across all time and does not reset with date filters.
  - Invoices paid in full at point of purchase (`amount_paid = total_amount`) generate ₹0 new debt.
  - Subsequent payments recorded in `dealer_payments` settle historical debt and are subtracted exactly once.
  - **Supplier Advances:** If payments exceed debt ($\text{Balance} < 0$), the dealer profile displays `Advance / Dealer Owes Us` with a negative balance. On the executive dashboard (`#payables` KPI in `src/services/dashboard.ts`), $\max(0, \text{Balance})$ is applied per dealer so advance deposits with one supplier do not distort or offset liabilities owed to other creditors.
  - **Opening Balance Persistence:** Stored as `opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0` on `public.dealers`. Supported in `getDealersWithBalances` (`src/services/dealers.ts`), `DealerDetailPage.tsx`, `DealerDetailPanel.tsx`, and editable via the Dealer Modal in `src/pages/dealers/index.tsx`.

### Rule 2: Wholesale Realized Profit
- **Formula:**
  $$\text{Profit} = (\text{wholesale\_price} - \text{buying\_cost}) \times \text{quantity}$$
- **Accounting Principle:** Profit is recognized at point of sale upon stock dispatch, regardless of whether cash was collected upfront or sold on credit.

### Rule 3: Customer Outstanding Receivables (Local Customers / Resellers)
- **Comprehensive Ledger Formula:**
  $$\text{Total Charges} = \text{Opening Balance} + \sum \text{wholesale\_sales.total\_sale} + \sum \text{customer\_credits.total\_amount}$$
  $$\text{Total Credits} = \sum \text{wholesale\_sales.amount\_received} + \sum \text{reseller\_payments.amount}$$
  $$\text{Net Outstanding} = \text{Total Charges} - \text{Total Credits}$$
- **Breakdown Independence:**
  - Product Credit Outstanding: $\sum (\text{total\_amount} - \text{amount\_paid})$ for `entry_type = 'PRODUCT_CREDIT'`.
  - Cash Loan Outstanding: $\sum (\text{total\_amount} - \text{amount\_paid})$ for `entry_type = 'CASH_LOAN'`.
  - Other Credit Outstanding: $\sum (\text{total\_amount} - \text{amount\_paid})$ for `entry_type = 'OTHER_CREDIT'`.

### Rule 3B: Local Customers Funding Source Accounting & Mathematical Reconciliation
- **Module Purpose:** Local Customers is a personal customer ledger for recording credit goods and personal cash loans, tracking whether money was supplied from 7TIME business accounts or proprietor personal funds. It remains strictly segregated from wholesale revenue and dealer accounts.
- **Formulas:**
  $$\text{Total Owed} = \text{Product Credit Outstanding} + \text{Cash Loan Outstanding} + \text{Other Credit Outstanding}$$
  $$\text{Total Owed} = \text{7TIME Funds Outstanding} + \text{Personal Funds Outstanding} + \text{Unallocated Outstanding}$$
  $$\text{7TIME Outstanding} = \sum (\text{total\_amount} - \text{amount\_paid}) \quad \text{for } \text{funding\_source} = \text{'7TIME\_FUNDS'}$$
  $$\text{Personal Outstanding} = \sum (\text{total\_amount} - \text{amount\_paid}) \quad \text{for } \text{funding\_source} = \text{'PERSONAL\_FUNDS'}$$
  $$\text{Unallocated Outstanding} = \sum (\text{total\_amount} - \text{amount\_paid}) \quad \text{for } \text{funding\_source IS NULL}$$
- **Reconciliation Guarantee:** Repayments reduce customer balance and line-item balances via `customer_payment_allocations` triggers. Summing outstanding balances partitioned by `funding_source` strictly reconciles with Total Owed without double-counting or loss. Historical records with `funding_source IS NULL` are explicitly identified as "Unallocated" rather than guessed.

### Rule 4: Payment Allocations & Unallocated Payments
- When a customer makes a lump-sum payment recorded in `reseller_payments`, it may be allocated across multiple credit entries via `customer_payment_allocations`.
- If $\sum \text{reseller\_payments.amount} > \sum \text{allocations.amount}$, the difference is **Unallocated Payment / Customer Advance**.
- The discrepancy detector computes:
  $$\text{Unallocated Payments} = \max(0, \text{Total Payments Received} - \sum \text{customer\_credits.amount\_paid})$$
- When unallocated payments exist, line item balances appear higher than Net Outstanding until allocations are linked via FIFO auto-allocation or manual distribution.

### Rule 5: NAEEM Dedicated Route Accounting & Carry-Forward
- **Formulas:**
  $$\text{Current Month Billed} = \sum \text{final\_fare} \quad (\text{excluding records where status} = \text{'No Order'})$$
  $$\text{Total Due} = \text{Opening Balance} + \text{Current Month Billed}$$
  $$\text{Outstanding} = \text{Total Due} - \sum \text{naeem\_payments.amount}$$
- **Carry-Forward Behavior:** If no manual override exists for month $M$, its opening balance is dynamically carried forward as the closing balance of month $M-1$. A manual override in `naeem_monthly_balances` takes absolute precedence.

### Rule 6: General Daily Delivery Net Contribution After Fuel
- **Formula:**
  $$\text{Net Fleet Contribution} = \sum \text{general\_delivery\_entries.amount} - \sum \text{general\_daily\_records.fuel\_expenses}$$
- **Accounting Principle:** Net fleet contribution represents operational delivery billings minus direct vehicle fuel disbursements. It must not be confused with company-wide net profit (which would require accounting for driver salaries, vehicle depreciation, maintenance, and overhead). Actual liquid cash collections from general delivery derive strictly from collected payments ($\sum \text{general\_delivery\_entries.received\_amount}$).
- Supported by the arithmetic parser: expressions such as `10+350+10` persist alongside the evaluated sum ₹370.00.

### Rule 7: Executive Cash Flow Accounting (Cash In & Cash Out)
- **Cash In Formula (Actual Realized Liquid Inflows Only):**
  $$\text{Cash In} = \sum \text{wholesale\_sales.amount\_received} + \sum \text{reseller\_payments.amount} + \sum \text{general\_delivery\_entries.received\_amount} + \sum \text{naeem\_payments.amount}$$
- **Cash Out Formula (Actual Liquid Disbursements Only):**
  $$\text{Cash Out} = \sum \text{purchases.amount\_paid} + \sum \text{dealer\_payments.amount} + \sum \text{general\_daily\_records.fuel\_expenses}$$
- **Safeguards Against Double-Counting & Accrual Confusion:**
  - Wholesale sales invoices (`total_sale`) and delivery billings (`amount`) represent accrual revenue, NOT cash in hand.
  - Purchase orders (`total_amount`) represent gross liabilities, NOT cash disbursed.
  - Payment allocations (`customer_payment_allocations`, `naeem_payment_allocations`) are internal links and never added to cash flow, completely preventing double-counting.
  - Date filtering applies to period flow metrics (Purchases, Sales, Profit, Delivery, Cash In/Out); cumulative balance sheet accounts (Receivables, Payables) persist across all time.

---

## 3. Data Integrity & Verification Constraints

1. **Foreign Key Integrity:** Deleting a dealer or reseller cascades only to payments and allocations, never leaving orphan records. Deleting a product referenced in a sale is prevented by database foreign key constraints.
2. **Trigger-Based Balances:** Customer credit line item balances and status are maintained via PostgreSQL trigger `sync_customer_credit_balance()`, guaranteeing database-level consistency regardless of client network interruptions.
3. **Double-Counting Prevention:** Down payments recorded at the time of purchase (`purchases.amount_paid`) or sale (`wholesale_sales.amount_received`) are tracked separately from subsequent debt settlement entries (`dealer_payments`, `reseller_payments`).
