-- ============================================================================
-- MIGRATION: 20261101040000_delivery_workspace_resolution.sql
-- Module: 7TIME Daily Deliveries & Multi-Account Architecture
-- Scope: Fix for RLS policy violation on inserting new daily delivery records
-- Tables: general_daily_records, general_delivery_entries,
--         naeem_daily_records, naeem_routes, naeem_payments,
--         naeem_payment_allocations, naeem_monthly_balances
-- Description:
--   Attaches dynamic workspace resolution triggers (BEFORE INSERT) and
--   immutability triggers (BEFORE UPDATE) across all delivery domain tables.
--   When client applications insert records without specifying workspace_id,
--   the trigger resolves the caller's active business workspace prior to
--   RLS WITH CHECK evaluation, ensuring valid authorized inserts succeed
--   while maintaining strict tenant isolation, suspended-account blocking,
--   and cross-tenant rejection.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DYNAMIC DELIVERY WORKSPACE RESOLVER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_delivery_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.workspace_id IS NULL THEN
        -- 1. Attempt to resolve caller's active business workspace
        SELECT w.id INTO NEW.workspace_id
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = auth.uid()
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'BUSINESS'
        ORDER BY (w.id = 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID) DESC, (w.owner_id = auth.uid()) DESC, w.created_at ASC
        LIMIT 1;

        -- 2. Fallback to Primary Enterprise Workspace for administrator or unmapped users
        IF NEW.workspace_id IS NULL THEN
            NEW.workspace_id := 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_delivery_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_delivery_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. CHILD TABLE RESOLVER: GENERAL DELIVERY ENTRIES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_delivery_entry_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_workspace_id UUID;
BEGIN
    -- Inherit from parent daily record if daily_record_id is supplied
    IF NEW.daily_record_id IS NOT NULL THEN
        SELECT workspace_id INTO v_parent_workspace_id
        FROM public.general_daily_records
        WHERE id = NEW.daily_record_id;

        IF v_parent_workspace_id IS NOT NULL THEN
            IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_parent_workspace_id THEN
                RAISE EXCEPTION 'Parent-child workspace mismatch: general_delivery_entries workspace must match daily record workspace.';
            END IF;
            NEW.workspace_id := v_parent_workspace_id;
        END IF;
    END IF;

    -- If workspace_id is still NULL, resolve from caller's active business workspace
    IF NEW.workspace_id IS NULL THEN
        SELECT w.id INTO NEW.workspace_id
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = auth.uid()
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'BUSINESS'
        ORDER BY (w.id = 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID) DESC, (w.owner_id = auth.uid()) DESC, w.created_at ASC
        LIMIT 1;

        IF NEW.workspace_id IS NULL THEN
            NEW.workspace_id := 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_delivery_entry_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_delivery_entry_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_entry_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. CHILD TABLE RESOLVER: NAEEM PAYMENT ALLOCATIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_naeem_allocation_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_workspace_id UUID;
BEGIN
    -- Inherit from parent payment if available
    IF NEW.payment_id IS NOT NULL THEN
        SELECT workspace_id INTO v_parent_workspace_id
        FROM public.naeem_payments
        WHERE id = NEW.payment_id;

        IF v_parent_workspace_id IS NOT NULL THEN
            IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_parent_workspace_id THEN
                RAISE EXCEPTION 'Parent-child workspace mismatch: naeem_payment_allocations workspace must match payment workspace.';
            END IF;
            NEW.workspace_id := v_parent_workspace_id;
        END IF;
    END IF;

    -- Inherit from parent daily record if still null and daily_record_id is supplied
    IF NEW.workspace_id IS NULL AND NEW.daily_record_id IS NOT NULL THEN
        SELECT workspace_id INTO v_parent_workspace_id
        FROM public.naeem_daily_records
        WHERE id = NEW.daily_record_id;

        IF v_parent_workspace_id IS NOT NULL THEN
            NEW.workspace_id := v_parent_workspace_id;
        END IF;
    END IF;

    -- Fallback to caller's active business workspace
    IF NEW.workspace_id IS NULL THEN
        SELECT w.id INTO NEW.workspace_id
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = auth.uid()
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'BUSINESS'
        ORDER BY (w.id = 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID) DESC, (w.owner_id = auth.uid()) DESC, w.created_at ASC
        LIMIT 1;

        IF NEW.workspace_id IS NULL THEN
            NEW.workspace_id := 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_naeem_allocation_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_naeem_allocation_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_naeem_allocation_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. DELIVERY WORKSPACE IMMUTABILITY FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_delivery_workspace_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        RAISE EXCEPTION 'Workspace immutability violation: workspace_id cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.prevent_delivery_workspace_reassignment() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_delivery_workspace_reassignment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_delivery_workspace_reassignment() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. ATTACH BEFORE INSERT TRIGGERS
-- ----------------------------------------------------------------------------

-- general_daily_records
DROP TRIGGER IF EXISTS trg_gen_daily_records_ws_default ON public.general_daily_records;
DROP TRIGGER IF EXISTS trg_gen_daily_records_ws_resolve ON public.general_daily_records;
CREATE TRIGGER trg_gen_daily_records_ws_resolve
BEFORE INSERT ON public.general_daily_records
FOR EACH ROW EXECUTE FUNCTION public.resolve_delivery_workspace();

-- general_delivery_entries
DROP TRIGGER IF EXISTS trg_gen_delivery_entries_ws_default ON public.general_delivery_entries;
DROP TRIGGER IF EXISTS trg_gen_delivery_entries_ws_resolve ON public.general_delivery_entries;
CREATE TRIGGER trg_gen_delivery_entries_ws_resolve
BEFORE INSERT ON public.general_delivery_entries
FOR EACH ROW EXECUTE FUNCTION public.resolve_delivery_entry_workspace();

-- naeem_daily_records
DROP TRIGGER IF EXISTS trg_naeem_daily_records_ws_default ON public.naeem_daily_records;
DROP TRIGGER IF EXISTS trg_naeem_daily_records_ws_resolve ON public.naeem_daily_records;
CREATE TRIGGER trg_naeem_daily_records_ws_resolve
BEFORE INSERT ON public.naeem_daily_records
FOR EACH ROW EXECUTE FUNCTION public.resolve_delivery_workspace();

-- naeem_routes
DROP TRIGGER IF EXISTS trg_naeem_routes_ws_default ON public.naeem_routes;
DROP TRIGGER IF EXISTS trg_naeem_routes_ws_resolve ON public.naeem_routes;
CREATE TRIGGER trg_naeem_routes_ws_resolve
BEFORE INSERT ON public.naeem_routes
FOR EACH ROW EXECUTE FUNCTION public.resolve_delivery_workspace();

-- naeem_payments
DROP TRIGGER IF EXISTS trg_naeem_payments_ws_default ON public.naeem_payments;
DROP TRIGGER IF EXISTS trg_naeem_payments_ws_resolve ON public.naeem_payments;
CREATE TRIGGER trg_naeem_payments_ws_resolve
BEFORE INSERT ON public.naeem_payments
FOR EACH ROW EXECUTE FUNCTION public.resolve_delivery_workspace();

-- naeem_payment_allocations
DROP TRIGGER IF EXISTS trg_naeem_allocations_ws_default ON public.naeem_payment_allocations;
DROP TRIGGER IF EXISTS trg_naeem_payment_allocations_ws_default ON public.naeem_payment_allocations;
DROP TRIGGER IF EXISTS trg_naeem_payment_allocations_ws_resolve ON public.naeem_payment_allocations;
CREATE TRIGGER trg_naeem_payment_allocations_ws_resolve
BEFORE INSERT ON public.naeem_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.resolve_naeem_allocation_workspace();

-- naeem_monthly_balances
DROP TRIGGER IF EXISTS trg_naeem_monthly_balances_ws_default ON public.naeem_monthly_balances;
DROP TRIGGER IF EXISTS trg_naeem_monthly_balances_ws_resolve ON public.naeem_monthly_balances;
CREATE TRIGGER trg_naeem_monthly_balances_ws_resolve
BEFORE INSERT ON public.naeem_monthly_balances
FOR EACH ROW EXECUTE FUNCTION public.resolve_delivery_workspace();


-- ----------------------------------------------------------------------------
-- 6. ATTACH BEFORE UPDATE IMMUTABILITY TRIGGERS
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_general_daily_records ON public.general_daily_records;
CREATE TRIGGER trg_prevent_workspace_reassignment_general_daily_records
BEFORE UPDATE ON public.general_daily_records
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_general_delivery_entries ON public.general_delivery_entries;
CREATE TRIGGER trg_prevent_workspace_reassignment_general_delivery_entries
BEFORE UPDATE ON public.general_delivery_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_naeem_daily_records ON public.naeem_daily_records;
CREATE TRIGGER trg_prevent_workspace_reassignment_naeem_daily_records
BEFORE UPDATE ON public.naeem_daily_records
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_naeem_routes ON public.naeem_routes;
CREATE TRIGGER trg_prevent_workspace_reassignment_naeem_routes
BEFORE UPDATE ON public.naeem_routes
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_naeem_payments ON public.naeem_payments;
CREATE TRIGGER trg_prevent_workspace_reassignment_naeem_payments
BEFORE UPDATE ON public.naeem_payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_naeem_allocations ON public.naeem_payment_allocations;
CREATE TRIGGER trg_prevent_workspace_reassignment_naeem_allocations
BEFORE UPDATE ON public.naeem_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_workspace_reassignment_naeem_monthly_balances ON public.naeem_monthly_balances;
CREATE TRIGGER trg_prevent_workspace_reassignment_naeem_monthly_balances
BEFORE UPDATE ON public.naeem_monthly_balances
FOR EACH ROW EXECUTE FUNCTION public.prevent_delivery_workspace_reassignment();


-- ----------------------------------------------------------------------------
-- 7. MULTI-TENANT UNIQUE CONSTRAINTS
-- ----------------------------------------------------------------------------

-- Allow multiple workspaces to each have a daily delivery record on the same calendar date
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'general_daily_records_record_date_key'
    ) THEN
        ALTER TABLE public.general_daily_records DROP CONSTRAINT general_daily_records_record_date_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'general_daily_records_workspace_record_date_key'
    ) THEN
        ALTER TABLE public.general_daily_records
        ADD CONSTRAINT general_daily_records_workspace_record_date_key UNIQUE (workspace_id, record_date);
    END IF;
END $$;

-- Allow multiple workspaces to each have their monthly balance override for the same year/month
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'naeem_monthly_balances_year_month_unique'
    ) THEN
        ALTER TABLE public.naeem_monthly_balances DROP CONSTRAINT naeem_monthly_balances_year_month_unique;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'naeem_monthly_balances_workspace_year_month_unique'
    ) THEN
        ALTER TABLE public.naeem_monthly_balances
        ADD CONSTRAINT naeem_monthly_balances_workspace_year_month_unique UNIQUE (workspace_id, year, month);
    END IF;
END $$;
