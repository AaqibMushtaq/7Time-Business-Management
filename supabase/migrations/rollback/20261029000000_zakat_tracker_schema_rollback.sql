-- ============================================================================
-- SAFE NON-DESTRUCTIVE ROLLBACK PLAN: 20261029000000_zakat_tracker_schema.sql
-- Module: 7TIME Zakat Tracker
-- Safety Rules:
-- 1. NO CASCADE keyword used anywhere.
-- 2. Strictly removes only Zakat module objects in reverse dependency order.
-- 3. Does NOT drop shared tables (e.g., audit_logs) or shared functions (e.g., log_audit_event).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP ZAKAT TABLE TRIGGERS
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_zakat_wealth_entries ON public.zakat_wealth_entries;
DROP TRIGGER IF EXISTS trg_check_zakat_conversion_pair_integrity ON public.zakat_wealth_entries;
DROP TRIGGER IF EXISTS trg_protect_zakat_ledger_history ON public.zakat_wealth_entries;

-- ----------------------------------------------------------------------------
-- 2. DROP PRIVILEGED RPC FUNCTIONS (SPECIFIC SIGNATURES WITHOUT CASCADE)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_zakat_paired_conversion(UUID);
DROP FUNCTION IF EXISTS public.create_zakat_paired_conversion(
    DATE, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);
DROP FUNCTION IF EXISTS public.check_zakat_conversion_pair_integrity();
DROP FUNCTION IF EXISTS public.protect_zakat_ledger_history();

-- ----------------------------------------------------------------------------
-- 3. DROP MODULE TABLES IN REVERSE FOREIGN KEY DEPENDENCY ORDER
-- ----------------------------------------------------------------------------
-- A. Ledger table (self-referencing and referencing auth.users)
DROP TABLE IF EXISTS public.zakat_wealth_entries;

-- B. Hawl lifecycle table
DROP TABLE IF EXISTS public.zakat_hawl_records;

-- C. User preferences table
DROP TABLE IF EXISTS public.zakat_user_settings;

-- D. Rates cache & snapshot tables
DROP TABLE IF EXISTS public.zakat_daily_metal_rates;
DROP TABLE IF EXISTS public.zakat_metal_rate_snapshots;

-- ----------------------------------------------------------------------------
-- 4. RELOAD SCHEMA CACHE
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

