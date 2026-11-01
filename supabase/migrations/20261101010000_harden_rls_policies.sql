-- ============================================================================
-- MIGRATION: 20261101010000_harden_rls_policies.sql
-- Module: 7TIME Multi-Account Workspace Architecture — RLS Policy Hardening
-- Safety: Eliminates permissive USING (true) policies across all business and
--         ledger tables. Replaces with strict, membership-verified workspace
--         isolation and system_role permissions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS FOR HIGH-PERFORMANCE RLS EVALUATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_access(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_workspace_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members wm
        JOIN public.profiles p ON p.id = wm.user_id
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = auth.uid()
          AND wm.is_active = true
          AND p.is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND system_role = 'SUPER_ADMIN'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 1. DROP LEGACY PERMISSIVE POLICIES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- profiles
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

    -- business tables
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.dealers;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.products;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.purchases;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.dealer_payments;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.reseller_customers;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.wholesale_sales;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.reseller_payments;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.customer_credits;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.customer_payment_allocations;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.general_daily_records;
    DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.general_daily_records;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.general_delivery_entries;
    DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.general_delivery_entries;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_routes;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_daily_records;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_payments;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_monthly_balances;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_payment_allocations;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_customers') THEN
        DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.delivery_customers;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_routes') THEN
        DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.delivery_routes;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_deliveries') THEN
        DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.daily_deliveries;
    END IF;
    DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.audit_logs;
    DROP POLICY IF EXISTS "Enable read for authenticated users only" ON public.audit_logs;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.audit_logs;
    DROP POLICY IF EXISTS "Enable read for authenticated users only" ON public.app_settings;
    DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.app_settings;

    -- Drop idempotent hardening policies if re-applying
    DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
    DROP POLICY IF EXISTS "workspaces_modify_policy" ON public.workspaces;
    DROP POLICY IF EXISTS "workspace_members_select_policy" ON public.workspace_members;
    DROP POLICY IF EXISTS "workspace_members_modify_policy" ON public.workspace_members;
    DROP POLICY IF EXISTS "module_catalog_select_policy" ON public.module_catalog;
    DROP POLICY IF EXISTS "user_module_entitlements_select" ON public.user_module_entitlements;
    DROP POLICY IF EXISTS "user_module_entitlements_modify" ON public.user_module_entitlements;
    DROP POLICY IF EXISTS "dealers_workspace_isolation" ON public.dealers;
    DROP POLICY IF EXISTS "products_workspace_isolation" ON public.products;
    DROP POLICY IF EXISTS "purchases_workspace_isolation" ON public.purchases;
    DROP POLICY IF EXISTS "dealer_payments_workspace_isolation" ON public.dealer_payments;
    DROP POLICY IF EXISTS "reseller_customers_workspace_isolation" ON public.reseller_customers;
    DROP POLICY IF EXISTS "wholesale_sales_workspace_isolation" ON public.wholesale_sales;
    DROP POLICY IF EXISTS "reseller_payments_workspace_isolation" ON public.reseller_payments;
    DROP POLICY IF EXISTS "customer_credits_workspace_isolation" ON public.customer_credits;
    DROP POLICY IF EXISTS "customer_payment_allocations_workspace_isolation" ON public.customer_payment_allocations;
    DROP POLICY IF EXISTS "general_daily_records_workspace_isolation" ON public.general_daily_records;
    DROP POLICY IF EXISTS "general_delivery_entries_workspace_isolation" ON public.general_delivery_entries;
    DROP POLICY IF EXISTS "naeem_routes_workspace_isolation" ON public.naeem_routes;
    DROP POLICY IF EXISTS "naeem_daily_records_workspace_isolation" ON public.naeem_daily_records;
    DROP POLICY IF EXISTS "naeem_payments_workspace_isolation" ON public.naeem_payments;
    DROP POLICY IF EXISTS "naeem_monthly_balances_workspace_isolation" ON public.naeem_monthly_balances;
    DROP POLICY IF EXISTS "naeem_payment_allocations_workspace_isolation" ON public.naeem_payment_allocations;
    DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
    DROP POLICY IF EXISTS "app_settings_select_policy" ON public.app_settings;
    DROP POLICY IF EXISTS "app_settings_update_policy" ON public.app_settings;
END $$;

-- ----------------------------------------------------------------------------
-- 2. HARDENED POLICIES: PROFILES, WORKSPACES, MEMBERS, ENTITLEMENTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_policy ON public.profiles
FOR SELECT TO authenticated
USING (
    auth.uid() = id OR public.is_super_admin()
);

CREATE POLICY profiles_update_policy ON public.profiles
FOR UPDATE TO authenticated
USING (
    auth.uid() = id OR public.is_super_admin()
)
WITH CHECK (
    -- Non-super admins cannot alter system_role or is_active
    (
        auth.uid() = id 
        AND system_role = (SELECT system_role FROM public.profiles WHERE id = auth.uid())
        AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
    ) 
    OR public.is_super_admin()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_select_policy ON public.workspaces
FOR SELECT TO authenticated
USING (
    public.has_workspace_access(id) OR public.is_super_admin()
);

CREATE POLICY workspaces_modify_policy ON public.workspaces
FOR ALL TO authenticated
USING (
    public.is_super_admin() OR (owner_id = auth.uid() AND public.has_workspace_access(id))
)
WITH CHECK (
    public.is_super_admin() OR (owner_id = auth.uid())
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_select_policy ON public.workspace_members
FOR SELECT TO authenticated
USING (
    public.has_workspace_access(workspace_id) OR public.is_super_admin()
);

CREATE POLICY workspace_members_modify_policy ON public.workspace_members
FOR ALL TO authenticated
USING (
    public.is_super_admin()
)
WITH CHECK (
    public.is_super_admin()
);

ALTER TABLE public.module_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY module_catalog_select_policy ON public.module_catalog
FOR SELECT TO authenticated
USING (true);

ALTER TABLE public.user_module_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_module_entitlements_select ON public.user_module_entitlements
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR public.is_super_admin()
);

CREATE POLICY user_module_entitlements_modify ON public.user_module_entitlements
FOR ALL TO authenticated
USING (
    public.is_super_admin()
)
WITH CHECK (
    public.is_super_admin()
);

-- ----------------------------------------------------------------------------
-- 3. HARDENED POLICIES: BUSINESS & PERSONAL LEDGER TABLES
-- ----------------------------------------------------------------------------
-- dealers
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
CREATE POLICY dealers_workspace_isolation ON public.dealers
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_workspace_isolation ON public.products
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_workspace_isolation ON public.purchases
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- dealer_payments
ALTER TABLE public.dealer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dealer_payments_workspace_isolation ON public.dealer_payments
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- reseller_customers
ALTER TABLE public.reseller_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY reseller_customers_workspace_isolation ON public.reseller_customers
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- wholesale_sales
ALTER TABLE public.wholesale_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY wholesale_sales_workspace_isolation ON public.wholesale_sales
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- reseller_payments
ALTER TABLE public.reseller_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY reseller_payments_workspace_isolation ON public.reseller_payments
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- customer_credits
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_credits_workspace_isolation ON public.customer_credits
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- customer_payment_allocations
ALTER TABLE public.customer_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_payment_allocations_workspace_isolation ON public.customer_payment_allocations
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- general_daily_records
ALTER TABLE public.general_daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY general_daily_records_workspace_isolation ON public.general_daily_records
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- general_delivery_entries
ALTER TABLE public.general_delivery_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY general_delivery_entries_workspace_isolation ON public.general_delivery_entries
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- naeem_routes
ALTER TABLE public.naeem_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY naeem_routes_workspace_isolation ON public.naeem_routes
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- naeem_daily_records
ALTER TABLE public.naeem_daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY naeem_daily_records_workspace_isolation ON public.naeem_daily_records
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- naeem_payments
ALTER TABLE public.naeem_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY naeem_payments_workspace_isolation ON public.naeem_payments
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- naeem_monthly_balances
ALTER TABLE public.naeem_monthly_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY naeem_monthly_balances_workspace_isolation ON public.naeem_monthly_balances
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

-- naeem_payment_allocations
ALTER TABLE public.naeem_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY naeem_payment_allocations_workspace_isolation ON public.naeem_payment_allocations
FOR ALL TO authenticated
USING (public.has_workspace_access(workspace_id))
WITH CHECK (public.has_workspace_access(workspace_id));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_customers') THEN
        ALTER TABLE public.delivery_customers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS delivery_customers_workspace_isolation ON public.delivery_customers;
        CREATE POLICY delivery_customers_workspace_isolation ON public.delivery_customers
        FOR ALL TO authenticated
        USING (public.has_workspace_access(workspace_id))
        WITH CHECK (public.has_workspace_access(workspace_id));
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_routes') THEN
        ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS delivery_routes_workspace_isolation ON public.delivery_routes;
        CREATE POLICY delivery_routes_workspace_isolation ON public.delivery_routes
        FOR ALL TO authenticated
        USING (public.has_workspace_access(workspace_id))
        WITH CHECK (public.has_workspace_access(workspace_id));
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_deliveries') THEN
        ALTER TABLE public.daily_deliveries ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS daily_deliveries_workspace_isolation ON public.daily_deliveries;
        CREATE POLICY daily_deliveries_workspace_isolation ON public.daily_deliveries
        FOR ALL TO authenticated
        USING (public.has_workspace_access(workspace_id))
        WITH CHECK (public.has_workspace_access(workspace_id));
    END IF;
END $$;

-- audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT TO authenticated
USING (workspace_id IS NULL OR public.has_workspace_access(workspace_id) OR public.is_super_admin());

CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (workspace_id IS NULL OR public.has_workspace_access(workspace_id) OR public.is_super_admin());

-- app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_select_policy ON public.app_settings
FOR SELECT TO authenticated
USING (public.has_workspace_access(workspace_id) OR public.is_super_admin());

CREATE POLICY app_settings_update_policy ON public.app_settings
FOR UPDATE TO authenticated
USING (public.has_workspace_access(workspace_id) OR public.is_super_admin())
WITH CHECK (public.has_workspace_access(workspace_id) OR public.is_super_admin());
