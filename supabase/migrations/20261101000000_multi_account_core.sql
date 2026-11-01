-- ============================================================================
-- MIGRATION: 20261101000000_multi_account_core.sql
-- Module: 7TIME Multi-Account Workspace Architecture — Foundation & Core Schema
-- Safety: Additive DDL with strict pre-flight validation.
--         Guarantees 100% preservation of administrator d2631c15-8193-4a2e-a099-40ca56a91523
--         and all 252 existing records across all business and ledger tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. DEFENSIVE PRE-FLIGHT VALIDATION
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_admin_id UUID := 'd2631c15-8193-4a2e-a099-40ca56a91523';
BEGIN
    -- Precondition 1: Ensure auth.users exists and contains the primary administrator
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
        RAISE EXCEPTION 'Precondition Failed: Primary administrator % not found in auth.users.', v_admin_id;
    END IF;

    -- Precondition 2: Verify existing core business tables are present
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dealers') THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.dealers not found.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.products not found.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases') THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.purchases not found.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_customers') THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.reseller_customers not found.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. RECONCILE public.profiles & AUTOMATIC AUTH TRIGGER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    system_role TEXT NOT NULL DEFAULT 'USER' CHECK (system_role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure required columns exist on profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'system_role') THEN
        ALTER TABLE public.profiles ADD COLUMN system_role TEXT NOT NULL DEFAULT 'USER' CHECK (system_role IN ('SUPER_ADMIN', 'ADMIN', 'USER'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active') THEN
        ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
END $$;

-- Automatic profile creation trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, system_role, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'USER',
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed / Update profile for the existing administrator
INSERT INTO public.profiles (id, email, full_name, system_role, is_active)
SELECT id, email, 'Enterprise Administrator', 'SUPER_ADMIN', true
FROM auth.users
WHERE id = 'd2631c15-8193-4a2e-a099-40ca56a91523'
ON CONFLICT (id) DO UPDATE SET
    system_role = 'SUPER_ADMIN',
    is_active = true,
    full_name = 'Enterprise Administrator',
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 2. WORKSPACES & WORKSPACE MEMBERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    workspace_type TEXT NOT NULL DEFAULT 'BUSINESS' CHECK (workspace_type IN ('BUSINESS', 'PERSONAL')),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);

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

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- ----------------------------------------------------------------------------
-- 3. MODULE CATALOG & USER ENTITLEMENTS
-- ----------------------------------------------------------------------------
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

INSERT INTO public.module_catalog (id, name, category, description, icon_name, default_route, sort_order) VALUES
('personal_ledger', 'Personal Ledger', 'PERSONAL', 'Personal debt, loans, and contact ledger', 'Users', '/local-customers', 1),
('zakat_tracker', 'Zakat Tracker', 'PERSONAL', 'Hanafi wealth assessment & precious metals tracking', 'Coins', '/zakat', 2),
('dealers', 'Dealers & Suppliers', 'BUSINESS', 'Supplier directory and relations', 'Users', '/dealers', 3),
('products', 'Product Catalog', 'BUSINESS', 'Catalog of goods and inventory specifications', 'Package', '/products', 4),
('price_calculator', 'Price Calculator', 'BUSINESS', 'Margin, wholesale, and retail pricing utility', 'Calculator', '/calculator', 5),
('purchases', 'Purchases Ledger', 'BUSINESS', 'Supplier procurement and stock inward log', 'ShoppingCart', '/purchases', 6),
('dealer_payments', 'Dealer Payments', 'BUSINESS', 'Payment settlements to dealers and suppliers', 'Wallet', '/dealer-payments', 7),
('inventory', 'Inventory Valuation', 'BUSINESS', 'Current stock quantities and asset valuation', 'Package', '/inventory', 8),
('wholesale_sales', 'Wholesale Sales', 'BUSINESS', 'Wholesale invoicing and customer receivables', 'ShoppingCart', '/wholesale', 9),
('deliveries', 'Deliveries', 'BUSINESS', 'General and dedicated delivery manifests', 'Truck', '/general-deliveries', 10),
('reports', 'Business Reports', 'BUSINESS', 'Consolidated financial and operational summaries', 'FileText', '/reports', 11),
('ai_assistant', 'AI Assistant', 'OTHER', 'Intelligent conversational business assistant', 'Sparkles', '/assistant', 12)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    default_route = EXCLUDED.default_route,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.user_module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL REFERENCES public.module_catalog(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_module UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_module_entitlements_lookup ON public.user_module_entitlements(user_id, is_enabled);

-- ----------------------------------------------------------------------------
-- 4. SEED PRIMARY ENTERPRISE WORKSPACE & ADMIN ENTITLEMENTS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_admin_id UUID := 'd2631c15-8193-4a2e-a099-40ca56a91523';
    v_ws_id UUID;
BEGIN
    -- 1. Ensure primary enterprise workspace exists
    SELECT id INTO v_ws_id FROM public.workspaces WHERE owner_id = v_admin_id AND workspace_type = 'BUSINESS' LIMIT 1;
    IF v_ws_id IS NULL THEN
        INSERT INTO public.workspaces (name, workspace_type, owner_id, is_active)
        VALUES ('7TIME Primary Enterprise', 'BUSINESS', v_admin_id, true)
        RETURNING id INTO v_ws_id;
    END IF;

    -- 2. Ensure admin is enrolled as OWNER in workspace_members
    INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
    VALUES (v_ws_id, v_admin_id, 'OWNER', true)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'OWNER', is_active = true;

    -- 3. Grant all 12 modules to the primary administrator
    INSERT INTO public.user_module_entitlements (user_id, module_id, is_enabled, granted_by)
    SELECT v_admin_id, id, true, v_admin_id
    FROM public.module_catalog
    ON CONFLICT (user_id, module_id) DO UPDATE SET is_enabled = true;
END $$;

-- ----------------------------------------------------------------------------
-- 5. RECONCILE app_settings WITH WORKSPACE SCOPING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL DEFAULT '7TIME',
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    date_format TEXT NOT NULL DEFAULT 'DD-MMM-YYYY',
    low_stock_threshold INTEGER NOT NULL DEFAULT 2,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_app_settings_workspace UNIQUE (workspace_id)
);

-- Ensure workspace_id column exists if table pre-existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='workspace_id') THEN
        ALTER TABLE public.app_settings ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_app_settings_workspace') THEN
            ALTER TABLE public.app_settings ADD CONSTRAINT uq_app_settings_workspace UNIQUE (workspace_id);
        END IF;
    END IF;
END $$;

-- Seed app_settings for primary enterprise workspace
DO $$
DECLARE
    v_ws_id UUID;
BEGIN
    SELECT id INTO v_ws_id FROM public.workspaces WHERE name = '7TIME Primary Enterprise' LIMIT 1;
    IF v_ws_id IS NOT NULL THEN
        INSERT INTO public.app_settings (workspace_id, business_name, currency, timezone, date_format, low_stock_threshold)
        VALUES (v_ws_id, '7TIME', 'INR', 'Asia/Kolkata', 'DD-MMM-YYYY', 2)
        ON CONFLICT (workspace_id) DO NOTHING;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. ADDITIVE workspace_id TO BUSINESS & PERSONAL LEDGER TABLES
-- ----------------------------------------------------------------------------
-- Helper block: Add column workspace_id safely if not present
DO $$
BEGIN
    -- dealers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealers' AND column_name='workspace_id') THEN
        ALTER TABLE public.dealers ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='workspace_id') THEN
        ALTER TABLE public.products ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- purchases
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='workspace_id') THEN
        ALTER TABLE public.purchases ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- dealer_payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dealer_payments' AND column_name='workspace_id') THEN
        ALTER TABLE public.dealer_payments ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- reseller_customers (+ contact_type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_customers' AND column_name='workspace_id') THEN
        ALTER TABLE public.reseller_customers ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_customers' AND column_name='contact_type') THEN
        ALTER TABLE public.reseller_customers ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'BUSINESS' CHECK (contact_type IN ('BUSINESS', 'PERSONAL'));
    END IF;

    -- wholesale_sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wholesale_sales' AND column_name='workspace_id') THEN
        ALTER TABLE public.wholesale_sales ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- reseller_payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_payments' AND column_name='workspace_id') THEN
        ALTER TABLE public.reseller_payments ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- customer_credits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_credits' AND column_name='workspace_id') THEN
        ALTER TABLE public.customer_credits ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- customer_payment_allocations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_payment_allocations' AND column_name='workspace_id') THEN
        ALTER TABLE public.customer_payment_allocations ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- general_daily_records
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='general_daily_records' AND column_name='workspace_id') THEN
        ALTER TABLE public.general_daily_records ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- general_delivery_entries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='general_delivery_entries' AND column_name='workspace_id') THEN
        ALTER TABLE public.general_delivery_entries ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- naeem_routes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='naeem_routes' AND column_name='workspace_id') THEN
        ALTER TABLE public.naeem_routes ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- naeem_daily_records
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='naeem_daily_records' AND column_name='workspace_id') THEN
        ALTER TABLE public.naeem_daily_records ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- naeem_payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='naeem_payments' AND column_name='workspace_id') THEN
        ALTER TABLE public.naeem_payments ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- naeem_monthly_balances
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='naeem_monthly_balances' AND column_name='workspace_id') THEN
        ALTER TABLE public.naeem_monthly_balances ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- naeem_payment_allocations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='naeem_payment_allocations' AND column_name='workspace_id') THEN
        ALTER TABLE public.naeem_payment_allocations ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- delivery_customers (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_customers') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_customers' AND column_name='workspace_id') THEN
        ALTER TABLE public.delivery_customers ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- delivery_routes (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_routes') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_routes' AND column_name='workspace_id') THEN
        ALTER TABLE public.delivery_routes ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- daily_deliveries (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_deliveries') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_deliveries' AND column_name='workspace_id') THEN
        ALTER TABLE public.daily_deliveries ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT;
    END IF;

    -- audit_logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='workspace_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. ATOMIC BACKFILL OF EXISTING 252 RECORDS TO PRIMARY ENTERPRISE WORKSPACE
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_ws_id UUID;
    v_count INTEGER;
BEGIN
    -- Fetch primary enterprise workspace ID
    SELECT id INTO v_ws_id FROM public.workspaces WHERE name = '7TIME Primary Enterprise' LIMIT 1;
    IF v_ws_id IS NULL THEN
        RAISE EXCEPTION 'Fatal: Primary enterprise workspace not found during backfill.';
    END IF;

    -- Backfill all tables
    UPDATE public.dealers SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.products SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.purchases SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.dealer_payments SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    
    -- Reseller customers: set workspace and mark as PERSONAL since all 8 are in Personal Ledger
    UPDATE public.reseller_customers 
    SET workspace_id = v_ws_id, 
        contact_type = 'PERSONAL' 
    WHERE workspace_id IS NULL;

    UPDATE public.wholesale_sales SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.reseller_payments SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.customer_credits SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.customer_payment_allocations SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

    UPDATE public.general_daily_records SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.general_delivery_entries SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

    UPDATE public.naeem_routes SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.naeem_daily_records SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.naeem_payments SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.naeem_monthly_balances SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    UPDATE public.naeem_payment_allocations SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_customers') THEN
        UPDATE public.delivery_customers SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_routes') THEN
        UPDATE public.delivery_routes SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_deliveries') THEN
        UPDATE public.daily_deliveries SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
    END IF;

    UPDATE public.audit_logs SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 8. ENFORCE NOT NULL CONSTRAINTS & PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
ALTER TABLE public.dealers ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dealers_workspace ON public.dealers(workspace_id);

ALTER TABLE public.products ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_workspace ON public.products(workspace_id);

ALTER TABLE public.purchases ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_workspace ON public.purchases(workspace_id);

ALTER TABLE public.dealer_payments ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dealer_payments_workspace ON public.dealer_payments(workspace_id);

ALTER TABLE public.reseller_customers ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reseller_customers_workspace ON public.reseller_customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reseller_customers_type ON public.reseller_customers(contact_type);

ALTER TABLE public.wholesale_sales ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wholesale_sales_workspace ON public.wholesale_sales(workspace_id);

ALTER TABLE public.reseller_payments ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reseller_payments_workspace ON public.reseller_payments(workspace_id);

ALTER TABLE public.customer_credits ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_credits_workspace ON public.customer_credits(workspace_id);

ALTER TABLE public.customer_payment_allocations ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_allocations_workspace ON public.customer_payment_allocations(workspace_id);

ALTER TABLE public.general_daily_records ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gen_daily_records_workspace ON public.general_daily_records(workspace_id);

ALTER TABLE public.general_delivery_entries ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gen_delivery_entries_workspace ON public.general_delivery_entries(workspace_id);

ALTER TABLE public.naeem_routes ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_naeem_routes_workspace ON public.naeem_routes(workspace_id);

ALTER TABLE public.naeem_daily_records ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_naeem_daily_records_workspace ON public.naeem_daily_records(workspace_id);

ALTER TABLE public.naeem_payments ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_naeem_payments_workspace ON public.naeem_payments(workspace_id);

ALTER TABLE public.naeem_monthly_balances ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_naeem_balances_workspace ON public.naeem_monthly_balances(workspace_id);

ALTER TABLE public.naeem_payment_allocations ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_naeem_allocations_workspace ON public.naeem_payment_allocations(workspace_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_customers') THEN
        ALTER TABLE public.delivery_customers ALTER COLUMN workspace_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_delivery_customers_workspace ON public.delivery_customers(workspace_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_routes') THEN
        ALTER TABLE public.delivery_routes ALTER COLUMN workspace_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_delivery_routes_workspace ON public.delivery_routes(workspace_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_deliveries') THEN
        ALTER TABLE public.daily_deliveries ALTER COLUMN workspace_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_daily_deliveries_workspace ON public.daily_deliveries(workspace_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON public.audit_logs(workspace_id);

-- ----------------------------------------------------------------------------
-- 9. POST-FLIGHT VALIDATION ASSERTION
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_dealers_count INTEGER;
    v_products_count INTEGER;
    v_purchases_count INTEGER;
    v_resellers_count INTEGER;
    v_credits_count INTEGER;
    v_admin_profile_role TEXT;
BEGIN
    -- Verify row counts are 100% intact
    SELECT count(*) INTO v_dealers_count FROM public.dealers;
    SELECT count(*) INTO v_products_count FROM public.products;
    SELECT count(*) INTO v_purchases_count FROM public.purchases;
    SELECT count(*) INTO v_resellers_count FROM public.reseller_customers;
    SELECT count(*) INTO v_credits_count FROM public.customer_credits;

    -- Verify row counts are 100% intact if pre-existing data was present
    IF v_dealers_count > 0 AND v_dealers_count != 5 THEN
        RAISE EXCEPTION 'Post-flight Failed: Expected 5 dealers, found %', v_dealers_count;
    END IF;
    IF v_products_count > 0 AND v_products_count != 23 THEN
        RAISE EXCEPTION 'Post-flight Failed: Expected 23 products, found %', v_products_count;
    END IF;
    IF v_purchases_count > 0 AND v_purchases_count != 23 THEN
        RAISE EXCEPTION 'Post-flight Failed: Expected 23 purchases, found %', v_purchases_count;
    END IF;
    IF v_resellers_count > 0 AND v_resellers_count != 8 THEN
        RAISE EXCEPTION 'Post-flight Failed: Expected 8 reseller_customers, found %', v_resellers_count;
    END IF;
    IF v_credits_count > 0 AND v_credits_count != 44 THEN
        RAISE EXCEPTION 'Post-flight Failed: Expected 44 customer_credits, found %', v_credits_count;
    END IF;

    -- Verify administrator profile has SUPER_ADMIN role
    SELECT system_role INTO v_admin_profile_role 
    FROM public.profiles 
    WHERE id = 'd2631c15-8193-4a2e-a099-40ca56a91523';

    IF v_admin_profile_role != 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Post-flight Failed: Administrator system_role is %, expected SUPER_ADMIN', v_admin_profile_role;
    END IF;
END $$;
