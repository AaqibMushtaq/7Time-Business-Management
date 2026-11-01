# 7TIME BUSINESS MANAGEMENT — MULTI-ACCOUNT WORKSPACE ARCHITECTURE AUDIT
## Comprehensive Architectural Audit, Security Risk Assessment, and Zero-Data-Loss Migration Blueprint

**Author:** Antigravity Senior SaaS Architect & Security Reviewer  
**Audit Target:** 7TIME Business Management (`haofuuvwciqsambgeqyn`)  
**Git Branch:** `feature/7time-multi-account-workspaces`  
**Starting Commit:** `a985d72979400297dc65c637f6291476bd92a53d`  
**Status:** READ-ONLY COMPREHENSIVE AUDIT & BLUEPRINT (No Code or Database Modifications)  
**Date of Audit:** October 31, 2026  

---

## 1. EXECUTIVE SUMMARY

The 7TIME Business Management application is an active, production-grade business management system providing financial tracking, inventory valuation, purchases, dealer relations, wholesale sales, delivery route dispatching, personal ledger credits, and a Hanafi-compliant Zakat Tracker.

The system currently operates as a **single-tenant** operational deployment. All business modules and personal ledger tables are accessed by a single primary administrator account. The core objective of this project is to transition 7TIME into a **multi-account, workspace-isolated SaaS architecture** where:
1. The administrator can create new accounts without public self-registration.
2. Newly created accounts start with **zero enabled modules** by default.
3. The administrator individually selects and toggles module entitlements (Personal Ledger, Zakat Tracker, Wholesale Sales, Purchases, Dealers, Products, Deliveries, AI Assistant, etc.) per user account.
4. User accounts can be activated or suspended instantly without deleting their underlying data.
5. Absolute data preservation is maintained: the existing administrator account (`d2631c15-8193-4a2e-a099-40ca56a91523`) and all **252 existing database records** across all 26 public tables remain 100% intact, fully accessible, and uninterrupted.

### Key Audit Findings:
- **Severe RLS Vulnerability in Existing Database:** 20 out of 26 database tables currently have permissive Row Level Security policies (`FOR ALL TO authenticated USING (true)`). No commercial or personal ledger table has a `user_id` or `workspace_id` foreign key. If a second user account were created today without architectural modifications, that user would immediately inherit full read, write, update, and delete access to all commercial financial purchases, dealer payments, personal debt entries, and customer records via direct Supabase PostgREST queries.
- **Empty Profiles Table:** Although a `profiles` table schema exists from the initial migration, it contains **0 records**. No database trigger was ever attached to `auth.users` to automatically populate user profiles upon sign-up.
- **Personal Ledger and Wholesale Overlap:** "Personal Ledger" and "Wholesale Resellers" currently share the same underlying database table (`reseller_customers`). The system currently distinguishes personal debts from wholesale sales at the transaction level via `customer_credits` and `wholesale_sales`. In a multi-tenant system, personal debtors must be partitioned by workspace or user ownership so that personal contacts are never exposed across accounts.
- **Zakat Tracker is Pre-Engineered for Multi-Tenancy:** The Zakat Tracker module (implemented in `20261029000000_zakat_tracker_schema.sql`) was already constructed with strict multi-tenant isolation (`user_id REFERENCES auth.users(id)` and `USING (auth.uid() = user_id)`). It requires zero schema modifications.
- **Zero-Data-Loss Feasibility:** A strictly additive migration strategy—introducing `workspaces`, `workspace_members`, `module_catalog`, and `user_module_entitlements`, followed by a backfill of existing records to a primary enterprise workspace owned by the administrator—allows seamless isolation without any data destruction or downtime.

---

## 2. EXISTING AUTHENTICATION ARCHITECTURE

### 2.1 Supabase Auth Provider & User Records
- **Auth Provider:** Supabase Native Authentication using standard email and password.
- **User Count:** Exactly **1 user** exists in `auth.users`.
- **Primary Administrator Identity:**
  - `id`: `d2631c15-8193-4a2e-a099-40ca56a91523`
  - `email`: Authenticated administrator email
  - `created_at`: Verified in production auth directory
  - `last_sign_in_at`: 2026-10-29 18:31:07 UTC
  - `confirmed_at`: 2026-10-15 14:14:12 UTC
  - `app_metadata`: `{"provider": "email", "providers": ["email"]}`
  - `user_metadata`: `{}` (empty)

### 2.2 Roles and Profile State
- **Database Profiles Table:** `public.profiles` exists in the schema (created in `00001_initial_schema.sql` with columns `id UUID PRIMARY KEY REFERENCES auth.users(id)`, `email TEXT`, `role TEXT DEFAULT 'admin'`, `created_at`, `updated_at`).
- **Live Row Count:** **0 rows**.
- **Root Cause:** No PostgreSQL trigger or webhook was configured to insert a row into `public.profiles` when a user signs up or signs in. Consequently, the application currently operates without reading any profile row from the database.
- **JWT Claims:** The current JWT generated by Supabase Auth contains only standard claims (`sub`, `email`, `role: "authenticated"`, `aud: "authenticated"`). It contains no custom app-level roles, workspace IDs, or module permissions.

### 2.3 Frontend Authentication & Session Management
- **Auth Context (`src/components/auth/AuthProvider.tsx`):**
  - Uses `supabase.auth.onAuthStateChange` to listen for session events (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`).
  - Exposes state: `{ user, session, loading, signOut }`.
  - Exposes no profile state, role state, or workspace state.
- **Login Flow (`src/pages/auth/Login.tsx`):**
  - Simple form prompting for `email` and `password`.
  - Calls `supabase.auth.signInWithPassword({ email, password })`.
  - On success, redirects to `/`.
  - There is **no signup link, no registration form, and no self-service onboarding**.
- **Route Protection (`src/components/auth/ProtectedRoute.tsx`):**
  - Checks solely `if (!user) return <Navigate to="/login" />`.
  - Does not verify if the account is active, suspended, or entitled to any module.

---

## 3. EXISTING ADMINISTRATOR PRESERVATION ASSESSMENT

### 3.1 Non-Negotiable Preservation Directives
Under the absolute data-preservation mandate:
1. User `d2631c15-8193-4a2e-a099-40ca56a91523` must never be deleted, recreated, renamed, or modified.
2. The user's password and authentication credentials must not be altered.
3. The user's administrative authority must remain permanent and irrevocable.
4. All 252 existing database records across all tables must remain continuously accessible to this administrator without any disruption.

### 3.2 Compatibility Assessment
The proposed multi-account architecture is 100% compatible with preserving this administrator:
1. **System Role:** The administrator account will be assigned `system_role = 'SUPER_ADMIN'` in `public.profiles`.
2. **Primary Enterprise Workspace:** A default workspace named `'7TIME Primary Enterprise'` will be created with `owner_id = 'd2631c15-8193-4a2e-a099-40ca56a91523'`.
3. **Membership:** The administrator will be established as `OWNER` in `workspace_members`.
4. **Universal Module Entitlements:** All 12 modules in `module_catalog` will be enabled for the administrator by default.
5. **No Disruption:** The administrator's day-to-day workflow, session tokens, and navigation will remain identical to the current production experience.

---

## 4. EXISTING DATABASE SCHEMA OVERVIEW

An empirical database audit was conducted via linked SQL query on Supabase project `haofuuvwciqsambgeqyn`. The database contains **26 public tables**.

### 4.1 Complete Public Table Inventory & Verified Record Counts

| Category | Table Name | Verified Rows | Primary Key | Foreign Key Dependencies |
| :--- | :--- | :---: | :--- | :--- |
| **System** | `profiles` | 0 | `id` (UUID -> `auth.users`) | `auth.users(id)` |
| **System** | `audit_logs` | 2 | `id` (UUID) | `auth.users(id)` (nullable) |
| **Business / Core** | `dealers` | 5 | `id` (UUID) | None |
| **Business / Core** | `products` | 23 | `id` (UUID) | `dealers(id)` |
| **Business / Core** | `purchases` | 23 | `id` (UUID) | `dealers(id)`, `products(id)` |
| **Business / Core** | `dealer_payments` | 6 | `id` (UUID) | `dealers(id)` |
| **Business / Sales** | `reseller_customers` | 8 | `id` (UUID) | None |
| **Business / Sales** | `wholesale_sales` | 1 | `id` (UUID) | `reseller_customers(id)`, `dealers(id)`, `products(id)` |
| **Business / Sales** | `reseller_payments` | 6 | `id` (UUID) | `reseller_customers(id)` |
| **Personal Ledger** | `customer_credits` | 44 | `id` (UUID) | `reseller_customers(id)`, `products(id)` (nullable) |
| **Personal Ledger** | `customer_payment_allocations` | 30 | `id` (UUID) | `customer_credits(id)`, `reseller_payments(id)` |
| **Deliveries / Legacy** | `delivery_customers` | 1 | `id` (UUID) | None |
| **Deliveries / Legacy** | `delivery_routes` | 5 | `id` (UUID) | None |
| **Deliveries / Legacy** | `daily_deliveries` | 1 | `id` (UUID) | `delivery_customers(id)`, `delivery_routes(id)` |
| **Deliveries / General**| `general_daily_records` | 30 | `id` (UUID) | None |
| **Deliveries / General**| `general_delivery_entries` | 30 | `id` (UUID) | `general_daily_records(id)` |
| **Deliveries / Dedicated**| `naeem_routes` | 7 | `id` (UUID) | None |
| **Deliveries / Dedicated**| `naeem_daily_records` | 28 | `id` (UUID) | `naeem_routes(id)` |
| **Deliveries / Dedicated**| `naeem_payments` | 1 | `id` (UUID) | None |
| **Deliveries / Dedicated**| `naeem_monthly_balances` | 2 | `id` (UUID) | None |
| **Deliveries / Dedicated**| `naeem_payment_allocations` | 6 | `id` (UUID) | `naeem_daily_records(id)`, `naeem_payments(id)` |
| **Zakat Tracker** | `zakat_daily_metal_rates` | 2 | `id` (UUID) | None (Shared benchmark rates) |
| **Zakat Tracker** | `zakat_metal_rate_snapshots` | 130 | `id` (UUID) | None (Provider audit snapshots) |
| **Zakat Tracker** | `zakat_user_settings` | 0 | `user_id` (UUID -> `auth.users`) | `auth.users(id)` |
| **Zakat Tracker** | `zakat_hawl_records` | 0 | `id` (UUID) | `auth.users(id)` |
| **Zakat Tracker** | `zakat_wealth_entries` | 0 | `id` (UUID) | `auth.users(id)`, self-references |
| **TOTALS** | **26 Tables** | **252 Rows** | — | — |

---

## 5. EXISTING DATA OWNERSHIP MODEL

### 5.1 Analysis of Current Ownership Structure
1. **Implicit Single-Tenant Ownership:**
   In 20 of the 26 tables, there is no ownership column (`user_id` or `workspace_id`). The system was designed with the premise that whoever is logged into the application owns the entire dataset.
2. **Personal Ledger Data Coupling:**
   `reseller_customers` contains 8 records representing individuals known to the business owner (e.g., "Aamir sir", "Basit bai", "naheer bai", "ummar qadir"). 
   - 1 of these individuals ("naheer bai") has a commercial transaction in `wholesale_sales`.
   - All 8 individuals have personal loans, product credits, or advance entries in `customer_credits` (44 records) and `customer_payment_allocations` (30 records).
   - In `customer_credits`, column `funding_source` distinguishes between `"7TIME_FUNDS"` (business funding) and `"PERSONAL_FUNDS"` (personal funding).
3. **Zakat Tracker Multi-Tenant Separation:**
   Tables `zakat_user_settings`, `zakat_hawl_records`, and `zakat_wealth_entries` are explicitly isolated per user via `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.

---

## 6. RLS POLICY ASSESSMENT

### 6.1 Vulnerability Matrix

```
[CRITICAL SECURITY RISK]
Currently, 20 public tables have open RLS policies granting full access to ANY authenticated user:
CREATE POLICY "Allow authenticated users full access" ON <table> FOR ALL TO authenticated USING (true);
```

### 6.2 Detailed Policy Breakdown by Table

| Table Name | RLS Enabled | Existing Policy Definition | Evaluation & Risk |
| :--- | :---: | :--- | :--- |
| `profiles` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Any authenticated user can modify any user's profile or elevate their role. |
| `dealers` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Any user can view, edit, or delete all commercial supplier records. |
| `products` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Any user can modify catalog, prices, and stock quantities. |
| `purchases` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes confidential supplier purchase costs and trade payables. |
| `dealer_payments` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes banking, cash outflows, and supplier payment records. |
| `reseller_customers` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes customer contact details, phone numbers, and balances. |
| `wholesale_sales` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes wholesale profit margins, revenue, and customer sales. |
| `reseller_payments` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes customer settlement transactions. |
| `customer_credits` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes personal loans, cash advances, and debtor balances. |
| `customer_payment_allocations` | YES | `FOR ALL TO authenticated USING (true)` | **CRITICAL:** Exposes loan allocation and debt settlement details. |
| `delivery_customers` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes delivery client list. |
| `delivery_routes` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes delivery route fares and stop details. |
| `daily_deliveries` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes daily delivery logs. |
| `general_daily_records` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes daily delivery run financials and collections. |
| `general_delivery_entries` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes delivery entry breakdowns. |
| `naeem_routes` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes dedicated transport route structures. |
| `naeem_daily_records` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes dedicated transport daily revenue and expenses. |
| `naeem_payments` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes driver payments and vehicle expenses. |
| `naeem_monthly_balances` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes monthly route reconciliations. |
| `naeem_payment_allocations` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Exposes driver payment allocations. |
| `audit_logs` | YES | `FOR ALL TO authenticated USING (true)` | **HIGH:** Any user can view security audit logs or insert bogus logs. |
| `zakat_daily_metal_rates` | YES | `FOR SELECT TO authenticated USING (true)` | **SECURE:** Publicly cached market metal rates; read-only for users. |
| `zakat_metal_rate_snapshots`| YES | *No public policies* (Service Role Only) | **SECURE:** Provider response snapshots protected from all client tokens. |
| `zakat_user_settings` | YES | `USING (auth.uid() = user_id)` | **SECURE:** Fully isolated per authenticated user. |
| `zakat_hawl_records` | YES | `USING (auth.uid() = user_id)` | **SECURE:** Fully isolated per authenticated user. |
| `zakat_wealth_entries` | YES | `USING (auth.uid() = user_id)` | **SECURE:** Fully isolated per authenticated user. |

---

## 7. FRONTEND ROUTING AND NAVIGATION ASSESSMENT

### 7.1 Router Structure (`src/App.tsx`)
The application uses React Router 7 with `HashRouter` (`/#/...`). All application pages are loaded inside a single protected route:
```tsx
<ProtectedRoute>
  <AppLayout />
</ProtectedRoute>
```
Within `<AppLayout />`, child routes are rendered via `<Outlet />`.

### 7.2 Current Navigation Structure (`src/components/layout/AppLayout.tsx`)
The navigation items are hardcoded in a static array `navGroups`:
1. **General:** Dashboard (`/`), AI Assistant (`/assistant`)
2. **Business:** Dealers (`/dealers`), Products (`/products`), Price Calculator (`/calculator`), Purchases (`/purchases`), Dealer Payments (`/dealer-payments`), Inventory (`/inventory`)
3. **Personal Ledger:** Personal Ledger (`/local-customers`), Zakat Tracker (`/zakat`)
4. **Wholesale:** Wholesale Sales (`/wholesale`)
5. **Deliveries:** General Daily Delivery (`/general-deliveries`), NAEEM Uncle (`/naeem`)
6. **Reports:** Reports (`/reports`)
7. **System:** Settings (`/settings`), Backup & Data (`/backup`), Audit Log (`/audit`)

### 7.3 Identified Navigation Limitations:
- **No Dynamic Entitlement Filtering:** Every logged-in user currently sees all 15 navigation links.
- **Dashboard Data Leakage / Crashes:** Navigating to `/` triggers `useDashboardSummary()`, which automatically fires consolidated queries against `purchases`, `wholesale_sales`, `dealers`, `resellers`, `dealer_payments`, and `naeem_daily_records`. A user restricted to only "Personal Ledger" would either see confidential commercial metrics or experience error boundaries if backend RLS blocks those queries.
- **Missing Route Guards:** Directly entering a URL (e.g. `/#/purchases` or `/#/dealer-payments`) allows access to the page because no module-level guard wraps the child routes.

---

## 8. MODULE DEPENDENCY MATRIX

To prevent broken views or orphaned workflows when modules are selectively enabled, the relationships and prerequisites among modules have been mapped below:

| Module Key | Display Name | Category | Primary Database Tables | Module Dependencies | Required Prerequisite Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `personal_ledger` | Personal Ledger | PERSONAL | `reseller_customers`, `customer_credits`, `customer_payment_allocations`, `reseller_payments` | None | Fully independent. Can be granted alone. |
| `zakat_tracker` | Zakat Tracker | PERSONAL | `zakat_wealth_entries`, `zakat_hawl_records`, `zakat_user_settings`, `zakat_daily_metal_rates` | None | Fully independent. Can be granted alone. |
| `dealers` | Dealers & Suppliers | BUSINESS | `dealers` | None | Standalone CRUD for supplier entities. |
| `products` | Products Catalog | BUSINESS | `products`, `dealers` | `dealers` | **Depends on Dealers.** Product creation requires `dealer_id`. |
| `inventory` | Inventory Valuation | BUSINESS | `products` | `products` | **Depends on Products.** Read-only valuation over products. |
| `price_calculator` | Price Calculator | BUSINESS | `products` (optional) | None | Standalone utility; can read products if enabled. |
| `purchases` | Purchases Ledger | BUSINESS | `purchases`, `products`, `dealers` | `dealers`, `products` | **Depends on Dealers & Products.** Purchasing updates stock. |
| `dealer_payments` | Dealer Payments | BUSINESS | `dealer_payments`, `dealers` | `dealers` | **Depends on Dealers.** Reconciles payables owed to dealers. |
| `wholesale_sales` | Wholesale Sales | BUSINESS | `wholesale_sales`, `reseller_customers`, `products`, `dealers` | `products`, `dealers`, `reseller_customers` | **Depends on Products & Resellers.** Decreases stock on sale. |
| `deliveries` | Delivery Fleets | BUSINESS | `general_daily_records`, `general_delivery_entries`, `naeem_routes`, `naeem_daily_records`, `naeem_payments` | None | Fully independent delivery run ledger. |
| `reports` | Business Reports | BUSINESS | Cross-table aggregates | Active business modules | Aggregates only whichever business modules are active. |
| `ai_assistant` | AI Assistant | OTHER | Edge Function `gemini-assistant` | Depends on active entitlements | AI queries must be scoped to user's assigned modules. |

---

## 9. PROPOSED WORKSPACE ARCHITECTURE

The evaluation confirms that introducing a workspace and module entitlement model is completely feasible, highly robust, and requires zero destructive alterations.

```
                    ┌─────────────────────────┐
                    │       auth.users        │
                    └────────────┬────────────┘
                                 │ 1:1
                    ┌────────────▼────────────┐
                    │     public.profiles     │
                    │   (system_role, active) │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ 1:N                   │ 1:N                   │ 1:N
┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────────────┐
│   workspaces    │     │workspace_members│     │user_module_entitlements │
│ (owner_id, type)│     │(user_id, role)  │     │(user_id, module_id, on) │
└────────┬────────┘     └─────────────────┘     └────────┬────────────────┘
         │ 1:N                                           │
         ├───────────────────────────────────────────────┤ references
         │ (Additive workspace_id on business tables)    │
         ▼                                               ▼
┌─────────────────────────────────────────┐     ┌─────────────────┐
│ dealers, products, purchases, etc.      │     │ module_catalog  │
└─────────────────────────────────────────┘     └─────────────────┘
```

### 9.1 Proposed Database Entities

#### Entity 1: `public.profiles` (Enhanced Profile System)
```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    system_role TEXT NOT NULL DEFAULT 'USER' CHECK (system_role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Entity 2: `public.workspaces` (Workspace Isolation Root)
```sql
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    workspace_type TEXT NOT NULL DEFAULT 'BUSINESS' CHECK (workspace_type IN ('BUSINESS', 'PERSONAL')),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Entity 3: `public.workspace_members` (Tenant Membership & Workspace Role)
```sql
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);
```

#### Entity 4: `public.module_catalog` (Static System Modules)
```sql
CREATE TABLE IF NOT EXISTS public.module_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('PERSONAL', 'BUSINESS', 'OTHER')),
    description TEXT,
    icon_name TEXT,
    default_route TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);
```

#### Entity 5: `public.user_module_entitlements` (Per-User Module Toggle Matrix)
```sql
CREATE TABLE IF NOT EXISTS public.user_module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL REFERENCES public.module_catalog(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_module UNIQUE (user_id, module_id)
);
```

---

## 10. PROPOSED MODULE ENTITLEMENT ARCHITECTURE

### 10.1 Module Catalog Population
The catalog will contain exactly the 12 functional modules currently in the codebase:
1. `personal_ledger` (PERSONAL) — Personal debts, loans, and contact ledger (`/local-customers`)
2. `zakat_tracker` (PERSONAL) — Hanafi wealth assessment & precious metals (`/zakat`)
3. `dealers` (BUSINESS) — Supplier and vendor management (`/dealers`)
4. `products` (BUSINESS) — Product catalog and inventory specs (`/products`)
5. `purchases` (BUSINESS) — Supplier procurement and purchasing ledger (`/purchases`)
6. `inventory` (BUSINESS) — Real-time stock counts and valuation (`/inventory`)
7. `dealer_payments` (BUSINESS) — Payments made to suppliers (`/dealer-payments`)
8. `price_calculator` (BUSINESS) — Margin, wholesale, and retail pricing utility (`/calculator`)
9. `wholesale_sales` (BUSINESS) — Wholesale invoicing and customer receivables (`/wholesale`)
10. `deliveries` (BUSINESS) — General and dedicated delivery route manifests (`/general-deliveries`, `/naeem`)
11. `reports` (BUSINESS) — Comprehensive operational and financial reports (`/reports`)
12. `ai_assistant` (OTHER) — Gemini AI business assistant (`/assistant`)

### 10.2 Zero-Module Default Rule
When the administrator creates a new account:
1. The user record is created in `auth.users` and `public.profiles`.
2. A personal workspace is created for the user.
3. In `user_module_entitlements`, **all 12 modules are inserted with `is_enabled = false`** (or no rows are inserted until toggled).
4. The user cannot access any business module or personal ledger until the administrator toggles the corresponding module to `true`.

---

## 11. ACCOUNT CREATION SECURITY DESIGN

### 11.1 Threat Model: Preventing Unauthorized Sign-ups
- **No Public Self-Registration:** Public sign-up is disabled at the Supabase project level (`auth.users` sign-ups disabled).
- **Service-Role Edge Function:** A dedicated Supabase Edge Function (`admin-manage-users`) executes account creation via `supabase.auth.admin.createUser()`.
- **Caller Authentication & Authorization:**
  ```ts
  // 1. Verify caller session JWT
  const { data: { user } } = await supabaseAdminClient.auth.getUser(jwt);
  
  // 2. Query caller profile in database
  const { data: profile } = await supabaseAdminClient
    .from('profiles')
    .select('system_role, is_active')
    .eq('id', user.id)
    .single();
    
  // 3. Enforce SUPER_ADMIN check
  if (profile?.system_role !== 'SUPER_ADMIN' || !profile?.is_active) {
    return new Response(JSON.stringify({ error: 'FORBIDDEN: Admin privileges required' }), { status: 403 });
  }
  ```

### 11.2 Account Activation / Suspension Workflow
- The administrator can toggle an account's status:
  - Setting `profiles.is_active = false` immediately halts frontend sessions.
  - The Edge Function calls `supabase.auth.admin.updateUserById(userId, { ban_duration: '876600h' })` to invalidate all active JWT refresh tokens.
  - All RLS policies check `is_active = true` before returning data.
  - Data belonging to the suspended account is **never deleted**, preserving full historical auditability.

---

## 12. PERSONAL DATA ISOLATION DESIGN

### 12.1 Separating Personal Ledger from Commercial Resellers
Currently, `reseller_customers` contains both wholesale commercial clients and personal debtors:
1. Add an additive column to `reseller_customers`:
   ```sql
   ALTER TABLE public.reseller_customers 
   ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
   ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'BUSINESS' CHECK (contact_type IN ('BUSINESS', 'PERSONAL'));
   ```
2. Existing 8 customers will be assigned `workspace_id = <primary_workspace_id>` and `contact_type = 'PERSONAL'`.
3. For newly invited personal users:
   - When they create contacts in Personal Ledger, records are tagged with their own personal `workspace_id` and `contact_type = 'PERSONAL'`.
   - Their personal debts, loans, and allocations in `customer_credits` inherit this isolation.
   - Other users (even those with Personal Ledger enabled) will only see contacts belonging to their own workspace.

### 12.2 Zakat Tracker Isolation
The Zakat Tracker already enforces `auth.uid() = user_id` across all records. No additional database changes are needed for Zakat; each user only sees their own gold/silver assets, cash wealth, hawl cycle, and zakat liability.

---

## 13. BUSINESS DATA PRESERVATION STRATEGY

### 13.1 Non-Destructive Additive Scoping
To preserve all 252 existing records without altering any table relationships:
1. Every business table will receive a nullable `workspace_id UUID REFERENCES public.workspaces(id)` column.
2. In the migration transaction, the primary workspace (`'7TIME Primary Enterprise'`) is created and assigned to the existing administrator (`d2631c15-8193-4a2e-a099-40ca56a91523`).
3. An `UPDATE` backfill assigns all existing records in all 20 business tables to this primary workspace ID:
   ```sql
   UPDATE public.dealers SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.products SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.purchases SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.dealer_payments SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.reseller_customers SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.wholesale_sales SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.reseller_payments SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.customer_credits SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.customer_payment_allocations SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.general_daily_records SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.general_delivery_entries SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.naeem_routes SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.naeem_daily_records SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.naeem_payments SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.naeem_monthly_balances SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.naeem_payment_allocations SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.delivery_customers SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.delivery_routes SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   UPDATE public.daily_deliveries SET workspace_id = v_primary_workspace_id WHERE workspace_id IS NULL;
   ```
4. Once verified, `workspace_id` is set to `NOT NULL` with an index:
   ```sql
   ALTER TABLE public.dealers ALTER COLUMN workspace_id SET NOT NULL;
   CREATE INDEX idx_dealers_workspace ON public.dealers(workspace_id);
   ```
5. Result: The administrator continues to access 100% of existing business data. Any future user added to a personal workspace has zero access to the enterprise business data.

---

## 14. MIGRATION PROPOSAL

The proposed database migration will be structured into 3 additive, defensive SQL migrations with atomic verification blocks:

### Migration 1: Identity & Profiles Foundation
- Creates `public.profiles` if missing or reconciles schema.
- Attaches an `AFTER INSERT ON auth.users` trigger to automatically create profile records.
- Inserts/updates the existing administrator record (`d2631c15-8193-4a2e-a099-40ca56a91523`) with `system_role = 'SUPER_ADMIN'` and `is_active = true`.

### Migration 2: Workspaces & Module Catalog DDL
- Creates `public.workspaces`, `public.workspace_members`, `public.module_catalog`, and `public.user_module_entitlements`.
- Seeds the 12 standard modules into `public.module_catalog`.
- Seeds the primary enterprise workspace for administrator `d2631c15-8193-4a2e-a099-40ca56a91523` as `OWNER`.
- Grants all 12 modules to the administrator.

### Migration 3: Additive Business Table Scoping & RLS Hardening
- Adds `workspace_id UUID REFERENCES public.workspaces(id)` to all 20 business and personal ledger tables.
- Backfills all existing records to the primary enterprise workspace.
- Drops permissive `USING (true)` policies.
- Establishes workspace-isolated policies:
  ```sql
  CREATE POLICY dealers_workspace_isolation ON public.dealers
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      JOIN public.profiles p ON p.id = wm.user_id
      WHERE wm.user_id = auth.uid() 
        AND wm.is_active = true 
        AND p.is_active = true
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      JOIN public.profiles p ON p.id = wm.user_id
      WHERE wm.user_id = auth.uid() 
        AND wm.is_active = true 
        AND p.is_active = true
    )
  );
  ```

---

## 15. ROLLBACK AND RECOVERY PROPOSAL

### 15.1 Disaster Prevention & Pre-Flight Snapshot
Before running any migration in production:
1. Perform a complete database dump via Supabase CLI:
   `npx supabase db dump -f backup_pre_multi_account.sql --linked`
2. Verify table row counts against the 252 baseline rows documented in this audit.

### 15.2 Step-by-Step Rollback SQL Script
A companion rollback script (`supabase/migrations/rollback/rollback_multi_account.sql`) will be prepared:
- Reverts RLS policies back to `USING (true)` if workspace filtering encounters any unexpected edge case.
- Drops foreign key constraints and `workspace_id` columns from business tables without deleting the underlying records.
- Drops `user_module_entitlements`, `module_catalog`, `workspace_members`, and `workspaces`.
- Restores the exact single-tenant production state within 60 seconds.

---

## 16. RISKS AND UNRESOLVED QUESTIONS

### 16.1 Identified Technical Debt
1. **Missing `app_settings` Table:**
   `src/pages/settings/index.tsx` queries `supabase.from("app_settings").select("*")`. This table does not exist in the database (query fails silently and falls back to default component state). In Phase 2, `app_settings` should either be formalized with workspace scoping or cleanly replaced by workspace settings.
2. **AI Assistant Data Scoping:**
   `supabase/functions/gemini-assistant/index.ts` queries business tables using the caller's JWT. When RLS is hardened to workspace-scoped queries, non-business users won't see business records. However, the AI assistant prompt logic should also inspect `user_module_entitlements` and immediately decline commercial questions if the user lacks the business module.
3. **Cross-Module UX Edge Cases:**
   If the administrator enables `purchases` for a user but forgets to enable `dealers` or `products`, creating a purchase in the frontend would fail because the supplier dropdown would be empty. The admin account management UI should feature dependency guidance (e.g. automatically checking `dealers` and `products` when `purchases` is selected).

---

## 17. RECOMMENDED IMPLEMENTATION SEQUENCE

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Database Foundation & Identity Verification                  │
│ - Seed profiles for existing admin; create auth trigger.              │
│ - Create workspaces, workspace_members, catalog, entitlements.         │
│ - Add workspace_id columns & backfill existing 252 records.           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 2: RLS Security Hardening & Zero-Permissive Policies             │
│ - Replace all USING (true) policies with workspace-isolated policies.  │
│ - Validate via automated regression test suite.                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 3: Admin Management Edge Function & API                          │
│ - Deploy admin-manage-users Edge Function.                            │
│ - Endpoints: listUsers, createUser, toggleModule, setAccountStatus.   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 4: Frontend State, Module Hooks & Dynamic Navigation            │
│ - Implement UserEntitlementsContext and useModuleAccess hook.          │
│ - Filter sidebar navigation items based on active entitlements.       │
│ - Create RouteGuard wrappers for all protected modules.               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 5: Admin Account Management Console UI                           │
│ - Build Admin Users & Modules management page under /settings/accounts.│
│ - User creation modal with temporary password / credentials display.   │
│ - Interactive module toggle grid with dependency hints.               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 6: End-to-End QA, Multi-Persona Testing & Staging Verification   │
│ - Verify Admin sees 100% of existing records.                         │
│ - Verify New User (0 modules) sees "No Access" screen.                 │
│ - Verify Personal User sees ONLY Personal Ledger & Zakat Tracker.      │
│ - Verify Business User sees ONLY assigned business operations.        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 18. EXACT LIST OF FILES LIKELY TO REQUIRE MODIFICATION

| Layer | File Path | Action | Purpose |
| :--- | :--- | :---: | :--- |
| **Database** | `supabase/migrations/20261101000000_multi_account_core.sql` | **NEW** | Workspaces, members, catalog, entitlements, backfill. |
| **Database** | `supabase/migrations/20261101010000_harden_rls_policies.sql` | **NEW** | Replace `USING (true)` with workspace & module isolation. |
| **Database** | `supabase/migrations/rollback/rollback_multi_account.sql` | **NEW** | Instant zero-downtime rollback script. |
| **Backend** | `supabase/functions/admin-manage-users/index.ts` | **NEW** | Admin Edge Function for creating users & managing modules. |
| **Backend** | `supabase/functions/gemini-assistant/index.ts` | **EDIT** | Add module entitlement awareness to AI assistant queries. |
| **Types** | `src/types/auth.ts` | **NEW** | Interfaces for profiles, workspaces, modules, entitlements. |
| **Context** | `src/components/auth/AuthContext.ts` | **EDIT** | Add profile, workspace, and module entitlement state. |
| **Context** | `src/components/auth/AuthProvider.tsx` | **EDIT** | Fetch profile & entitlements on auth change; handle suspend. |
| **Hooks** | `src/hooks/useModuleAccess.ts` | **NEW** | Custom hook returning `{ hasModule, enabledModules, isAdmin }`.|
| **Routing** | `src/components/auth/ProtectedRoute.tsx` | **EDIT** | Enforce `is_active` check; redirect suspended accounts. |
| **Routing** | `src/components/auth/ModuleRouteGuard.tsx` | **NEW** | Guard component wrapping modular route outlets. |
| **Routing** | `src/App.tsx` | **EDIT** | Wrap routes with `<ModuleRouteGuard module="...">`. |
| **Navigation**| `src/components/layout/AppLayout.tsx` | **EDIT** | Filter `navGroups` dynamically by `useModuleAccess`. |
| **Dashboard** | `src/pages/dashboard/index.tsx` | **EDIT** | Graceful fallback / redirect if user has no business modules. |
| **Admin UI** | `src/pages/settings/AccountManagement.tsx` | **NEW** | Admin UI to create accounts, toggle modules, suspend users. |
| **Admin UI** | `src/pages/settings/index.tsx` | **EDIT** | Add tab or link for Account & Module Management. |
| **Services** | `src/services/adminService.ts` | **NEW** | Client service to interact with `admin-manage-users` function. |
| **Tests** | `src/components/auth/ModuleRouteGuard.test.tsx`| **NEW** | Unit tests for route protection and entitlement gating. |
| **Tests** | `src/hooks/useModuleAccess.test.ts` | **NEW** | Unit tests for module access logic. |

---

## 19. AUDIT VERIFICATION & COMPLIANCE CONFIRMATION

In strict adherence to the project instructions:
1. **No source code was modified.**
2. **No existing account was modified.**
3. **No database records were modified.**
4. **No schema migration was applied.**
5. **No RLS policy was changed.**
6. **No Supabase secret was changed.**
7. **No Edge Function was deployed.**
8. **No Git branch was merged.**
9. **No production deployment occurred.**
10. **The audit has concluded and execution is STOPPED awaiting explicit user approval.**

