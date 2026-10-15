# 7TIME Business Management — Project Overview

**Document Status:** Verified against codebase and migrations  
**Last Updated:** October 2026  
**System Version:** v1.3.0  

---

## 1. Business Purpose & Target Users

### Business Context
**7TIME Business Management** is a private, specialized enterprise ledger and operational management platform built for **7TIME**, an FMCG distribution, wholesale, and daily delivery business operating in Jammu & Kashmir (India).

The platform tracks end-to-end commercial operations:
- Direct supplier purchasing from manufacturing dealers.
- Central warehouse inventory valuation and stock movements.
- B2B wholesale sales and customer credit ledgers (Local Customers / Resellers).
- General daily van deliveries with arithmetic expense/fuel logging.
- Dedicated contractual route delivery (NAEEM route) with carry-forward balance management.
- Multi-entry debt settlements, cash flow monitoring, and executive performance metrics.
- AI-assisted business inquiry synthesis via an authenticated, read-only Edge Function.

### Target Users & Roles
- **Business Owner / Managing Director:** Accesses executive dashboards, cash flow indicators, realized wholesale margins, supplier liabilities, and customer debt summaries.
- **Operations & Warehouse Manager:** Manages inventory stock, records purchases, logs customer deliveries, and inspects stock valuations.
- **Field Delivery Operators & Cash Handlers:** Logs daily delivery entries, fuel expenses, and records partial debt repayments from local shopkeepers.
- **Current Authentication Model:** Single-tenant administrative authentication via Supabase Auth (`supabase.auth.signInWithPassword`). While all active users currently authenticate as administrative staff, data access is secured at the database layer via PostgreSQL Row Level Security (RLS).

---

## 2. Existing Modules & Responsibilities

The application is organized into six functional operational domains:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        7TIME BUSINESS MANAGEMENT                       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
     ┌───────────────┬───────────────┼───────────────┬───────────────────┐
     ▼               ▼               ▼               ▼                   ▼
┌──────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐       ┌───────────┐
│Executive │   │ Purchases │   │ Wholesale │   │Deliveries │       │AI & System│
│Dashboard │   │& Suppliers│   │& Resellers│   │Operations │       │Utilities  │
└──────────┘   └───────────┘   └───────────┘   └───────────┘       └───────────┘
```

### Module 1: Executive Dashboard (`/`)
- **Location:** [`src/pages/dashboard/index.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/index.tsx), [`src/services/dashboard.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/dashboard.ts)
- **Responsibilities:**
  - Executive KPI summary cards (Total Purchases, Commercial Revenue, Cash In, Cash Out, Receivables, Payables).
  - Unified Business Performance container with comparative views: `REVENUE`, `CASH_FLOW`, `OUTSTANDING`, and `PROFIT`.
  - Accounts to Collect (Top debtor customers) and Payments to Make (Top creditor dealers).
  - Quick action shortcuts to primary workflows.
  - Live Supabase Realtime synchronization indicator (`LiveSyncBadge`).

### Module 2: Dealers & Supplier Purchasing (`/dealers`, `/purchases`, `/dealer-payments`)
- **Location:** [`src/pages/dealers/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dealers/), [`src/pages/purchases/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/purchases/)
- **Responsibilities:**
  - Master supplier directory with contact details (Phone, Address, WhatsApp link).
  - Purchase order entry linked to product inventory with automatic stock increment triggers (`trg_increase_stock_on_purchase`).
  - Supplier debt tracking with opening balance support.
  - Payment records (`dealer_payments`) reducing outstanding payables.

### Module 3: Products & Inventory Valuation (`/products`, `/inventory`)
- **Location:** [`src/pages/products/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/products/), [`src/pages/inventory/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/inventory/)
- **Responsibilities:**
  - Product catalog (`buying_cost`, `wholesale_price`, `stock_quantity`, `category`).
  - Real-time stock valuation (`SUM(buying_cost * stock_quantity)`).
  - Potential revenue calculation (`SUM(wholesale_price * stock_quantity)`).
  - Low stock alerts and stock transaction histories.

### Module 4: Wholesale Sales & Local Customer Ledgers (`/wholesale`, `/resellers`)
- **Location:** [`src/pages/wholesale/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/wholesale/), [`src/pages/resellers/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/resellers/)
- **Responsibilities:**
  - Commercial wholesale invoicing with automatic stock decrement triggers (`trg_wholesale_sales_stock`).
  - Comprehensive Local Customer Profiles (`reseller_customers`) with editable contact details, address, opening balance, and customer notes.
  - Multi-type credit ledger tracking:
    - **Product Credit:** Goods issued on credit (`quantity * rate`).
    - **Cash Loans:** Direct financial advances given without requiring product entries.
    - **Other Credit:** Miscellaneous services or adjustments.
  - Multi-entry payment allocations (`customer_payment_allocations`), FIFO auto-allocation, and safe payment voiding.

### Module 5: Delivery Operations (`/general-deliveries`, `/naeem`)
- **Location:** [`src/pages/general-deliveries/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/general-deliveries/), [`src/pages/naeem/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/naeem/)
- **Responsibilities:**
  - **General Daily Deliveries:** Calendar-based daily delivery log supporting arithmetic string expressions (e.g. `10+350+10 = ₹370.00`), fuel expense deductions, and net route calculations.
  - **NAEEM Dedicated Route:** Fixed contractual route ledger with standard fares, arithmetic extra charges, multi-trip allocations, and month-to-month carry-forward accounting with manual opening balance overrides.

### Module 6: System Utilities & AI Assistant (`/assistant`, `/reports`, `/backup`, `/audit`, `/settings`)
- **Location:** [`src/pages/assistant/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/assistant/), [`src/pages/reports/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/reports/), [`src/pages/backup/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/backup/), [`src/pages/audit/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/audit/)
- **Responsibilities:**
  - **AI Assistant:** Authenticated natural language financial synthesizer powered by an Edge Function invoking Google Gemini (`gemini-2.5-flash`), operating strictly read-only on verified data.
  - **Reports:** Tabular cross-module CSV and data exports.
  - **Backup & Data:** Client-side logical JSON database snapshots.
  - **Audit Log:** Chronological database log of administrative write actions.
  - **Settings & Version Manager:** App version badge, client-side update notification banner, and cache-clearing force reload.

---

## 3. Main User Workflows

### Workflow 1: Receiving Stock from a Supplier (Purchase)
1. User navigates to **Purchases** (`/purchases`).
2. Selects Supplier Dealer from directory, selects Product, enters Quantity, Buying Cost, and initial down payment (`amount_paid`).
3. Submits form. Database trigger `trg_increase_stock_on_purchase` immediately increments `products.stock_quantity`.
4. Remaining balance (`total_amount - amount_paid`) adds to the dealer's outstanding payable balance.

### Workflow 2: Wholesale Sale to Local Customer
1. User navigates to **Wholesale Sales** (`/wholesale`).
2. Selects Customer, Product, Quantity, Wholesale Price, and Amount Received upfront.
3. System validates available stock. Upon submission, database trigger `trg_wholesale_sales_stock` decrements `stock_quantity`.
4. Point-of-sale profit is recognized (`(wholesale_price - buying_cost) * quantity`). Unpaid balance creates a customer receivable.

### Workflow 3: Customer Credit & Payment Reconciliation
1. User opens **Local Customers** (`/resellers`) and selects a customer profile.
2. User can add or inline-edit **Product Credits**, **Cash Loans**, or **Other Credits**.
3. When recording a payment, the user can allocate amounts across pending credit entries, or use **"Auto-Allocate to Oldest Entries"** (FIFO distribution) to link payments directly to debt items.
4. If a payment record needs correction or voiding, the system cascades the deletion to allocations and recalculates line balances safely.

### Workflow 4: Daily Delivery & Fuel Tracking
1. User navigates to **General Daily Delivery** (`/general-deliveries`).
2. Selects the date on the calendar, enters fuel expense, and enters delivery entries directly or via arithmetic expressions (`10+350+10`).
3. System evaluates and saves both the evaluated sum and the original mathematical expression for complete audit transparency.

### Workflow 5: Monthly Carry-Forward (NAEEM Route)
1. User selects the operational month under **naeem Uncle** (`/naeem`).
2. System evaluates historical records up to the latest manual override and computes `Total Due = Opening Balance + Billed`.
3. Payments recorded in `naeem_payments` deduct from `Total Due` to establish the remaining `Outstanding`.

---

## 4. Verified Functionality vs Planned Functionality

| Feature / Area | Status | Evidence / Implementation Reference |
| :--- | :--- | :--- |
| **Executive KPI Summary** | Verified | [`src/pages/dashboard/index.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dashboard/index.tsx), [`src/services/dashboard.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/dashboard.ts) |
| **Dealer Opening Balance & Payables** | Verified | Migration `20261015003500`, [`src/services/dealers.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/dealers.ts), [`src/pages/dealers/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/dealers/) |
| **Duplicate Submission Safeguards** | Verified | Mutation `isPending` guards across all payment, credit, and delivery forms |
| **Customer Credit Security Remediation** | Verified | Migration `20261015020000_restrict_customer_credits_rls.sql`, anon access revoked |
| **Realtime Live Sync** | Verified | [`src/components/realtime/RealtimeSyncProvider.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/realtime/RealtimeSyncProvider.tsx), 450ms debounce |
| **Product Inventory Stock Triggers** | Verified | Migrations `00001_initial_schema.sql`, `00011_enhance_wholesale_stock_trigger.sql` |
| **Customer Credit & Loan Ledger** | Verified | Migration `20261015000000_customer_credits_and_loans.sql`, [`src/services/customerCredits.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/customerCredits.ts) |
| **Customer Profile Notes & Inline Editing** | Verified | Migration `20261015010000_add_customer_notes.sql`, [`src/components/resellers/ResellerDetailPanel.tsx`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/components/resellers/ResellerDetailPanel.tsx) |
| **Arithmetic Expression Parsing** | Verified | [`src/lib/arithmeticParser.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/arithmeticParser.ts), [`src/pages/general-deliveries/`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/pages/general-deliveries/) |
| **NAEEM Route Accounting & Overrides** | Verified | [`src/lib/naeemCalculations.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/lib/naeemCalculations.ts), `naeem_monthly_balances` |
| **AI Assistant (Edge Function)** | Verified | Supabase Edge Function `gemini-assistant`, [`src/services/aiAssistant.ts`](file:///c:/Users/Aaqib/7Time%20Business%20%20Management/src/services/aiAssistant.ts) |
| **Multi-User Role Permissions (RBAC)** | Planned | Schema currently enforces authenticated vs unauthenticated; granular role tables planned for future phase. |
| **Dedicated Staging Database** | Planned | Automated CI currently runs with mocked environment to protect live production database. |
| **Offline PWA Local Storage Sync** | Planned | Service worker deregistered to fix mobile caching; true offline SQLite/IndexedDB sync is a future proposal. |
| **Online Payment Gateway / Webhooks** | Out of Scope | Excluded by approved business rules; all payments are verified cash, bank transfer, or cheque entries. |
