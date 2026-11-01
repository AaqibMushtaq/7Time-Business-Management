-- ============================================================================
-- FULLY REPAIRED ROLLBACK SCRIPT: rollback_multi_account.sql
-- Module: Reverts Multi-Account Workspace Schema back to single-tenant state.
-- Safety: Preserves all business and personal ledger records. Drops only
--         the additive workspace_id columns, multi-account tables, and policies.
-- Status: PREPARED OFFLINE — DO NOT EXECUTE WITHOUT EXPLICIT AUTHORIZATION
-- Target Project: haofuuvwciqsambgeqyn
-- ============================================================================

DO $$
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. DROP WORKSPACE POLICIES ACROSS ALL 19 BUSINESS & DELIVERY TABLES
    -- ------------------------------------------------------------------------
    -- Commercial Supply Chain & Inventory
    DROP POLICY IF EXISTS "dealers_workspace_isolation" ON public.dealers;
    DROP POLICY IF EXISTS "products_workspace_isolation" ON public.products;
    DROP POLICY IF EXISTS "purchases_workspace_isolation" ON public.purchases;
    DROP POLICY IF EXISTS "dealer_payments_workspace_isolation" ON public.dealer_payments;
    DROP POLICY IF EXISTS "wholesale_sales_workspace_isolation" ON public.wholesale_sales;

    -- Personal Ledger & Debtors
    DROP POLICY IF EXISTS "reseller_customers_workspace_isolation" ON public.reseller_customers;
    DROP POLICY IF EXISTS "reseller_payments_workspace_isolation" ON public.reseller_payments;
    DROP POLICY IF EXISTS "customer_credits_workspace_isolation" ON public.customer_credits;
    DROP POLICY IF EXISTS "customer_payment_allocations_workspace_isolation" ON public.customer_payment_allocations;

    -- Fleet & General Deliveries
    DROP POLICY IF EXISTS "delivery_customers_workspace_isolation" ON public.delivery_customers;
    DROP POLICY IF EXISTS "delivery_routes_workspace_isolation" ON public.delivery_routes;
    DROP POLICY IF EXISTS "daily_deliveries_workspace_isolation" ON public.daily_deliveries;
    DROP POLICY IF EXISTS "general_daily_records_workspace_isolation" ON public.general_daily_records;
    DROP POLICY IF EXISTS "general_delivery_entries_workspace_isolation" ON public.general_delivery_entries;

    -- NAEEM Dedicated Fleet Route
    DROP POLICY IF EXISTS "naeem_routes_workspace_isolation" ON public.naeem_routes;
    DROP POLICY IF EXISTS "naeem_daily_records_workspace_isolation" ON public.naeem_daily_records;
    DROP POLICY IF EXISTS "naeem_payments_workspace_isolation" ON public.naeem_payments;
    DROP POLICY IF EXISTS "naeem_monthly_balances_workspace_isolation" ON public.naeem_monthly_balances;
    DROP POLICY IF EXISTS "naeem_payment_allocations_workspace_isolation" ON public.naeem_payment_allocations;

    -- System & Logs
    DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
    DROP POLICY IF EXISTS "app_settings_select_policy" ON public.app_settings;
    DROP POLICY IF EXISTS "app_settings_update_policy" ON public.app_settings;
    DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

    -- ------------------------------------------------------------------------
    -- 2. RE-ESTABLISH ORIGINAL PERMISSIVE AUTHENTICATED POLICIES
    -- ------------------------------------------------------------------------
    CREATE POLICY "Allow authenticated users full access" ON public.dealers FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.products FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.purchases FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.dealer_payments FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.reseller_customers FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.wholesale_sales FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.reseller_payments FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.customer_credits FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.customer_payment_allocations FOR ALL TO authenticated USING (true);

    -- Fleet & Deliveries Full Access
    CREATE POLICY "Allow authenticated users full access" ON public.delivery_customers FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.delivery_routes FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.daily_deliveries FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.general_daily_records FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.general_delivery_entries FOR ALL TO authenticated USING (true);

    -- NAEEM Fleet Route Full Access
    CREATE POLICY "Allow authenticated users full access" ON public.naeem_routes FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.naeem_daily_records FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.naeem_payments FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.naeem_monthly_balances FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.naeem_payment_allocations FOR ALL TO authenticated USING (true);

    -- Audit Logs & Settings
    CREATE POLICY "Allow authenticated users full access" ON public.audit_logs FOR ALL TO authenticated USING (true);
    CREATE POLICY "Allow authenticated users full access" ON public.app_settings FOR ALL TO authenticated USING (true);

    -- ------------------------------------------------------------------------
    -- 3. DROP FOREIGN KEYS AND COLUMNS FROM ALL 19 BUSINESS TABLES
    -- ------------------------------------------------------------------------
    ALTER TABLE IF EXISTS public.dealers DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.products DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.purchases DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.dealer_payments DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.reseller_customers DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.reseller_customers DROP COLUMN IF EXISTS contact_type;
    ALTER TABLE IF EXISTS public.wholesale_sales DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.reseller_payments DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.customer_credits DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.customer_payment_allocations DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.general_daily_records DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.general_delivery_entries DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.naeem_routes DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.naeem_daily_records DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.naeem_payments DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.naeem_monthly_balances DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.naeem_payment_allocations DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.delivery_customers DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.delivery_routes DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.daily_deliveries DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.audit_logs DROP COLUMN IF EXISTS workspace_id;
    ALTER TABLE IF EXISTS public.app_settings DROP COLUMN IF EXISTS workspace_id;

    -- ------------------------------------------------------------------------
    -- 4. DROP MULTI-ACCOUNT WORKSPACE TABLES
    -- ------------------------------------------------------------------------
    DROP TABLE IF EXISTS public.user_module_entitlements CASCADE;
    DROP TABLE IF EXISTS public.module_catalog CASCADE;
    DROP TABLE IF EXISTS public.workspace_members CASCADE;
    DROP TABLE IF EXISTS public.workspaces CASCADE;

    -- ------------------------------------------------------------------------
    -- 5. DROP TRIGGER AND HELPER FUNCTIONS
    -- ------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP FUNCTION IF EXISTS public.handle_new_user();
    DROP FUNCTION IF EXISTS public.has_workspace_access(UUID);
    DROP FUNCTION IF EXISTS public.is_super_admin();

    -- ------------------------------------------------------------------------
    -- 6. REMOVE MIGRATION RECORDS FROM SUPABASE SCHEMA_MIGRATIONS
    -- ------------------------------------------------------------------------
    DELETE FROM supabase_migrations.schema_migrations 
    WHERE version IN ('20261101000000', '20261101010000');
END $$;
