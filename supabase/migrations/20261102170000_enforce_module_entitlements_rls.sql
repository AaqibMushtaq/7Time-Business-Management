-- ============================================================================
-- MIGRATION: 20261102170000_enforce_module_entitlements_rls.sql
-- Module: 7TIME Multi-Account Backend Module Entitlement Authorization & RLS Hardening
-- Scope: PostgreSQL Row Level Security (RLS) enforcement of module entitlements
--        across all domain tables in 7TIME Business Management.
--
-- Security Objectives:
--   1. Enforce module entitlement authorization at the database boundary (PostgreSQL RLS)
--      in addition to existing workspace isolation.
--   2. Direct Supabase REST API requests by authenticated users with disabled modules
--      are rejected by RLS (returns 0 rows or blocks writes).
--   3. Immediate rejection of suspended accounts (is_active = false) on both reads and writes.
--   4. Preserve SUPER_ADMIN unrestricted administrative access.
--   5. Maintain strict contact_type partitioning:
--      - contact_type = 'PERSONAL' requires 'personal_ledger' module.
--      - contact_type = 'BUSINESS' requires 'wholesale_sales' module.
--   6. Prevent recursive RLS dependencies via SECURITY DEFINER helper function with fixed search_path.
--   7. Respect workflow dependencies: allow cross-module SELECT access where needed
--      (e.g., purchases selecting dealers/products) while strictly restricting modifications.
--   8. Forward-only, additive, and idempotent.
--
-- DO NOT APPLY WITHOUT EXPLICIT OPERATIONAL AUTHORIZATION.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURE MODULE ENTITLEMENT VERIFICATION FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_module_access(p_module_key text)
RETURNS boolean AS $$
DECLARE
    v_user_id uuid;
    v_is_active boolean;
    v_is_super_admin boolean;
    v_has_entitlement boolean;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- 1. Verify caller profile exists and is active
    SELECT is_active, (system_role = 'SUPER_ADMIN')
    INTO v_is_active, v_is_super_admin
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_active IS NOT TRUE THEN
        RETURN false;
    END IF;

    -- 2. Super Administrators retain full system access across all functional domains
    IF v_is_super_admin THEN
        RETURN true;
    END IF;

    -- 3. Check explicit active entitlement in user_module_entitlements
    SELECT EXISTS (
        SELECT 1
        FROM public.user_module_entitlements
        WHERE user_id = v_user_id
          AND module_id = p_module_key
          AND is_enabled = true
    ) INTO v_has_entitlement;

    RETURN v_has_entitlement;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.has_module_access(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_module_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_access(text) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. HARDENED RLS POLICIES COMBINING WORKSPACE ISOLATION & MODULE ENTITLEMENTS
-- ----------------------------------------------------------------------------

-- A. dealers (Owning module: 'dealers')
-- Read: dealers, purchases, dealer_payments, products, wholesale_sales
-- Write: dealers
DROP POLICY IF EXISTS dealers_workspace_isolation ON public.dealers;
DROP POLICY IF EXISTS dealers_workspace_isolation_select ON public.dealers;
DROP POLICY IF EXISTS dealers_workspace_isolation_modify ON public.dealers;

CREATE POLICY dealers_workspace_isolation_select ON public.dealers
FOR SELECT TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND (
        public.has_module_access('dealers') OR
        public.has_module_access('purchases') OR
        public.has_module_access('dealer_payments') OR
        public.has_module_access('products') OR
        public.has_module_access('wholesale_sales')
    )
);

CREATE POLICY dealers_workspace_isolation_modify ON public.dealers
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('dealers')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('dealers')
);

-- B. products (Owning module: 'products')
-- Read: products, inventory, price_calculator, purchases, wholesale_sales
-- Write: products
DROP POLICY IF EXISTS products_workspace_isolation ON public.products;
DROP POLICY IF EXISTS products_workspace_isolation_select ON public.products;
DROP POLICY IF EXISTS products_workspace_isolation_modify ON public.products;

CREATE POLICY products_workspace_isolation_select ON public.products
FOR SELECT TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND (
        public.has_module_access('products') OR
        public.has_module_access('inventory') OR
        public.has_module_access('price_calculator') OR
        public.has_module_access('purchases') OR
        public.has_module_access('wholesale_sales')
    )
);

CREATE POLICY products_workspace_isolation_modify ON public.products
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('products')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('products')
);

-- C. purchases (Owning module: 'purchases')
-- Read: purchases, dealer_payments, dealers, inventory
-- Write: purchases
DROP POLICY IF EXISTS purchases_workspace_isolation ON public.purchases;
DROP POLICY IF EXISTS purchases_workspace_isolation_select ON public.purchases;
DROP POLICY IF EXISTS purchases_workspace_isolation_modify ON public.purchases;

CREATE POLICY purchases_workspace_isolation_select ON public.purchases
FOR SELECT TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND (
        public.has_module_access('purchases') OR
        public.has_module_access('dealer_payments') OR
        public.has_module_access('dealers') OR
        public.has_module_access('inventory')
    )
);

CREATE POLICY purchases_workspace_isolation_modify ON public.purchases
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('purchases')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('purchases')
);

-- D. dealer_payments (Owning module: 'dealer_payments')
-- Read: dealer_payments, dealers, purchases
-- Write: dealer_payments, dealers
DROP POLICY IF EXISTS dealer_payments_workspace_isolation ON public.dealer_payments;
DROP POLICY IF EXISTS dealer_payments_workspace_isolation_select ON public.dealer_payments;
DROP POLICY IF EXISTS dealer_payments_workspace_isolation_modify ON public.dealer_payments;

CREATE POLICY dealer_payments_workspace_isolation_select ON public.dealer_payments
FOR SELECT TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND (
        public.has_module_access('dealer_payments') OR
        public.has_module_access('dealers') OR
        public.has_module_access('purchases')
    )
);

CREATE POLICY dealer_payments_workspace_isolation_modify ON public.dealer_payments
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND (
        public.has_module_access('dealer_payments') OR public.has_module_access('dealers')
    )
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND (
        public.has_module_access('dealer_payments') OR public.has_module_access('dealers')
    )
);

-- E. reseller_customers (partitioned: 'personal_ledger' for PERSONAL, 'wholesale_sales' for BUSINESS)
DROP POLICY IF EXISTS reseller_customers_workspace_isolation ON public.reseller_customers;
CREATE POLICY reseller_customers_workspace_isolation ON public.reseller_customers
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND (
        (contact_type = 'PERSONAL' AND public.has_module_access('personal_ledger')) OR
        (contact_type = 'BUSINESS' AND public.has_module_access('wholesale_sales'))
    )
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND (
        (contact_type = 'PERSONAL' AND public.has_module_access('personal_ledger')) OR
        (contact_type = 'BUSINESS' AND public.has_module_access('wholesale_sales'))
    )
);

-- F. wholesale_sales (Owning module: 'wholesale_sales')
DROP POLICY IF EXISTS wholesale_sales_workspace_isolation ON public.wholesale_sales;
CREATE POLICY wholesale_sales_workspace_isolation ON public.wholesale_sales
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('wholesale_sales')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('wholesale_sales')
);

-- G. customer_credits (Owning module: 'personal_ledger')
DROP POLICY IF EXISTS customer_credits_workspace_isolation ON public.customer_credits;
CREATE POLICY customer_credits_workspace_isolation ON public.customer_credits
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('personal_ledger')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('personal_ledger')
);

-- H. reseller_payments (Owning module: 'personal_ledger')
DROP POLICY IF EXISTS reseller_payments_workspace_isolation ON public.reseller_payments;
CREATE POLICY reseller_payments_workspace_isolation ON public.reseller_payments
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('personal_ledger')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('personal_ledger')
);

-- I. customer_payment_allocations (Owning module: 'personal_ledger')
DROP POLICY IF EXISTS customer_payment_allocations_workspace_isolation ON public.customer_payment_allocations;
CREATE POLICY customer_payment_allocations_workspace_isolation ON public.customer_payment_allocations
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('personal_ledger')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('personal_ledger')
);

-- J. general_daily_records (Owning module: 'deliveries')
DROP POLICY IF EXISTS general_daily_records_workspace_isolation ON public.general_daily_records;
CREATE POLICY general_daily_records_workspace_isolation ON public.general_daily_records
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- K. general_delivery_entries (Owning module: 'deliveries')
DROP POLICY IF EXISTS general_delivery_entries_workspace_isolation ON public.general_delivery_entries;
CREATE POLICY general_delivery_entries_workspace_isolation ON public.general_delivery_entries
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- L. naeem_routes (Owning module: 'deliveries')
DROP POLICY IF EXISTS naeem_routes_workspace_isolation ON public.naeem_routes;
CREATE POLICY naeem_routes_workspace_isolation ON public.naeem_routes
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- M. naeem_daily_records (Owning module: 'deliveries')
DROP POLICY IF EXISTS naeem_daily_records_workspace_isolation ON public.naeem_daily_records;
CREATE POLICY naeem_daily_records_workspace_isolation ON public.naeem_daily_records
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- N. naeem_payments (Owning module: 'deliveries')
DROP POLICY IF EXISTS naeem_payments_workspace_isolation ON public.naeem_payments;
CREATE POLICY naeem_payments_workspace_isolation ON public.naeem_payments
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- O. naeem_monthly_balances (Owning module: 'deliveries')
DROP POLICY IF EXISTS naeem_monthly_balances_workspace_isolation ON public.naeem_monthly_balances;
CREATE POLICY naeem_monthly_balances_workspace_isolation ON public.naeem_monthly_balances
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- P. naeem_payment_allocations (Owning module: 'deliveries')
DROP POLICY IF EXISTS naeem_payment_allocations_workspace_isolation ON public.naeem_payment_allocations;
CREATE POLICY naeem_payment_allocations_workspace_isolation ON public.naeem_payment_allocations
FOR ALL TO authenticated
USING (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
)
WITH CHECK (
    public.has_workspace_access(workspace_id) AND public.has_module_access('deliveries')
);

-- Q. zakat_entries (Owning module: 'zakat_tracker')
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='zakat_entries') THEN
        DROP POLICY IF EXISTS "zakat_entries_owner_access" ON public.zakat_entries;
        CREATE POLICY "zakat_entries_owner_access" ON public.zakat_entries
        FOR ALL TO authenticated
        USING (auth.uid() = user_id AND public.has_module_access('zakat_tracker'))
        WITH CHECK (auth.uid() = user_id AND public.has_module_access('zakat_tracker'));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Ensure optional phone column exists on profiles table
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
END $$;
