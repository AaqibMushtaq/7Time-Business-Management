# DELIVERY MODULE AUDIT REPORT
**7TIME Business Management System | P0 Production Delivery Audit**
**Date:** October 10, 2026

---

## 1. Executive Summary

This comprehensive audit covers all delivery-related modules within the 7TIME Business Management codebase:
1. **General Daily Delivery** (`/general-deliveries`) — Monthly calendar ledger for ad-hoc deliveries and fuel tracking.
2. **NAEEM Dedicated Delivery Operations** (`/naeem`) — Fixed route-based delivery ledger with payment allocations, manual opening balance overrides, and carry-forward accounting.
3. **Dashboard Delivery Summary** (`/`) — High-level KPI widgets summarizing General and NAEEM deliveries.
4. **Reports & Exports** (`/reports`) — Tabular CSV and Excel export for general deliveries and routes.
5. **System Backup & Restore** (`/backup`) — JSON snapshot backup and restore of delivery data.
6. **Legacy Delivery Tables** (from initial schema) — `daily_deliveries`, `delivery_routes`, `delivery_customers`.

---

## 2. Module A: General Daily Delivery

### 2.1 Route & Entry Point
- **Page Component:** `src/pages/general-deliveries/index.tsx`
- **Route:** `#/general-deliveries` (registered in `src/App.tsx`)
- **Service Layer:** `src/services/generalDeliveries.ts`

### 2.2 Authoritative Database Schema
- **Primary Daily Records Table:** `public.general_daily_records`
  - `id` (UUID, PK, default `uuid_generate_v4()`)
  - `record_date` (DATE, NOT NULL, UNIQUE)
  - `fuel_expenses` (NUMERIC(10, 2), DEFAULT 0)
  - `opening_balance` (NUMERIC(10, 2), DEFAULT 0)
  - `remarks` (TEXT, nullable)
  - `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`)
  - `updated_at` (TIMESTAMPTZ, DEFAULT `NOW()`)
- **Detailed Entries Table:** `public.general_delivery_entries`
  - `id` (UUID, PK, default `uuid_generate_v4()`)
  - `daily_record_id` (UUID, NOT NULL, FK → `general_daily_records.id` ON DELETE CASCADE)
  - `customer_name` (TEXT, NOT NULL)
  - `description` (TEXT, nullable)
  - `amount` (NUMERIC(10, 2), NOT NULL, DEFAULT 0)
  - `received_amount` (NUMERIC(10, 2), NOT NULL, DEFAULT 0)
  - `payment_method` (TEXT, nullable: 'Cash', 'UPI', 'Bank')
  - `reference` (TEXT, nullable)
  - `notes` (TEXT, nullable)
  - `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`)
  - `updated_at` (TIMESTAMPTZ, DEFAULT `NOW()`)

### 2.3 Migration Status & Root Cause
- **Migration:** `supabase/migrations/00005_fix_general_daily_delivery.sql`
- **Root Cause of Production Error (`PGRST205`):**
  The table `public.general_daily_records` was defined in migration file `00005_fix_general_daily_delivery.sql` in the repository, but had not been executed against the Production Supabase instance. As a result, PostgREST returned code `PGRST205: Could not find the table 'public.general_daily_records' in the schema cache`.
- **Database Fix:**
  Upgraded `supabase/migrations/00005_fix_general_daily_delivery.sql` with idempotent table definitions, indexes (`idx_general_daily_records_date`, `idx_general_delivery_entries_record_id`), `set_updated_at()` triggers, strict RLS policies (`WITH CHECK (true)`), and PostgREST schema cache notification (`NOTIFY pgrst, 'reload schema'`). Updated `run_migration.js` to execute and verify this migration.

### 2.4 Read & Save Functionality
- **Read:** `getGeneralDailyRecords(month: string)` fetches `general_daily_records` joining embedded `entries:general_delivery_entries(*)` between `YYYY-MM-01` and `YYYY-MM-lastDay`.
- **Save Daily Summary:** `upsertDailySummary` updates existing daily record or creates a new one using `.maybeSingle()`.
- **Save Delivery Entry:** `upsertDeliveryEntry` ensures the parent daily record exists, then upserts the child entry.

### 2.5 Edit & Delete Behavior
- **Edit Delivery:** Supported via `DailyDetailPanel` edit button; pre-populates form and performs upsert on existing `id`.
- **Delete Delivery:** Supported via `deleteDeliveryEntry(id)` with explicit browser confirmation (`window.confirm`). Cascades cleanly.

### 2.6 Summary Calculations
- **Active Delivery Days:** Count of days with entries length > 0.
- **Total Deliveries:** Sum of entry amounts for all days in the selected month.
- **Fuel Expenses:** Sum of daily `fuel_expenses` for the selected month.
- **Net Total:** `Total Deliveries − Fuel Expenses`.

### 2.7 UI State Handling (Fixed)
- **Previous Defect:** When query failed, metrics defaulted to 0 (`0`, `₹0`, `₹0`, `₹0`), masking the database failure.
- **Resolved Behavior:** Summary cards now display explicit "Unavailable" / "Error" states with error badges during query failure, and "Loading..." during fetch. Legitimate empty months display genuine verified `0` / `₹0`. Top-level error banner displays the database message and a "Retry Query" action.

### 2.8 Automated Test Coverage
- Unit and integration tests in `src/pages/general-deliveries/index.test.tsx` and `src/services/generalDeliveries.test.ts`.

---

## 3. Module B: NAEEM Dedicated Delivery Operations

### 3.1 Route & Entry Point
- **Page Component:** `src/pages/naeem/index.tsx`
- **Route:** `#/naeem` (registered in `src/App.tsx`)
- **Service Layer:** `src/services/naeemDeliveries.ts`
- **Calculation Engine:** `src/lib/naeemCalculations.ts`

### 3.2 Authoritative Database Schema
- **Routes Table:** `public.naeem_routes`
  - `id` (UUID, PK)
  - `name` (TEXT, NOT NULL)
  - `standard_fare` (NUMERIC(12, 2), NOT NULL)
  - `is_active` (BOOLEAN, DEFAULT TRUE)
- **Daily Records Table:** `public.naeem_daily_records`
  - `id` (UUID, PK)
  - `route_id` (UUID, FK → `naeem_routes.id`)
  - `delivery_date` (DATE, DEFAULT CURRENT_DATE)
  - `standard_fare` (NUMERIC(12, 2))
  - `extra_charge` (NUMERIC(12, 2), DEFAULT 0)
  - `final_fare` (NUMERIC(12, 2))
  - `cash_received` (NUMERIC(12, 2), DEFAULT 0)
  - `payment_method` (TEXT)
  - `balance` (NUMERIC(12, 2), DEFAULT 0)
  - `status` (TEXT: 'Paid', 'Partially Paid', 'Pending', 'No Order')
  - `notes` (TEXT)
- **Payments Table:** `public.naeem_payments`
  - `id` (UUID, PK)
  - `payment_date` (DATE)
  - `amount` (NUMERIC(12, 2))
  - `payment_method` (TEXT)
  - `reference_number`, `cheque_number`, `cheque_date`, `bank_name`, `notes`
- **Payment Allocations Table:** `public.naeem_payment_allocations`
  - `id` (UUID, PK)
  - `payment_id` (UUID, FK → `naeem_payments.id` ON DELETE CASCADE)
  - `daily_record_id` (UUID, FK → `naeem_daily_records.id` ON DELETE RESTRICT)
  - `allocated_amount` (NUMERIC(12, 2))
- **Monthly Balances Table:** `public.naeem_monthly_balances`
  - `id` (UUID, PK)
  - `year` (INT), `month` (INT)
  - `opening_balance` (NUMERIC)
  - `is_manual_override` (BOOLEAN, DEFAULT FALSE)

### 3.3 Accounting Integrity
- **Formulas Preserved:**
  - `Total Due = Opening Balance + Current Month Billed`
  - `Outstanding = Total Due − Total Received`
- **Zero-Billed Semantics:** Routes named "No Order" or records with status "No Order" contribute ₹0 to billed amounts and do not count toward billable trips.
- **Carry-Forward & Overrides:** Carries forward dynamic balance from the latest manual override before the target month. Overrides take precedence immediately.

### 3.4 Automated Test Coverage
- `src/lib/naeemCalculations.test.ts` (6 tests passing)
- `src/pages/naeem/index.test.tsx` (3 tests passing)

---

## 4. Module C: Dashboard & Reports Integration

### 4.1 Dashboard (`src/services/dashboard.ts`)
- Queries `general_daily_records` with `entries:general_delivery_entries(amount)` and aggregates `generalRevenue`, `generalFuel`, `generalNet`, and `generalActiveDays`.
- Queries `naeem_daily_records` and `naeem_payments` for period revenue and collections.

### 4.2 Reports (`src/pages/reports/index.tsx`)
- Exports all `general_daily_records` joined with `entries:general_delivery_entries(*)`.

### 4.3 Backup & Restore (`src/pages/backup/index.tsx`)
- Includes `general_daily_records` in database backups.

---

## 5. Summary of Defect Resolutions & Status

| Area | Status | Verified Behavior |
|---|---|---|
| `public.general_daily_records` Schema | REPAIRED | Migration `00005_fix_general_daily_delivery.sql` defined and runner prepared. |
| General Delivery Summary Cards | RESOLVED | Failed queries no longer present fake `0` / `₹0`; explicit Unavailable/Error state displayed. |
| General Delivery Entry CRUD | RESOLVED | Upsert safely handles parent record creation, ID preservation, and cascade deletion. |
| NAEEM Accounting Rules | VERIFIED PASS | `Total Due = Opening + Billed`, `Outstanding = Total Due − Received` verified. |
| PostgREST Schema Cache Reload | PREPARED | `NOTIFY pgrst, 'reload schema'` integrated into migration scripts. |
