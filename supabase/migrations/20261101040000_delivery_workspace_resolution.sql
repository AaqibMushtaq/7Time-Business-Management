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
--   Enforces:
--     1. Derivation of caller identity exclusively via auth.uid().
--     2. Resolution through verified, active business workspace membership.
--     3. Rejection of suspended accounts.
--     4. Rejection of personal workspaces for business delivery records.
--     5. Rejection of ambiguous workspace membership when workspace context is omitted.
--     6. Complete elimination of hardcoded enterprise workspace UUID fallbacks.
--     7. Strict validation of client-provided workspace IDs against memberships.
--     8. Relational consistency and database-enforced composite FK between
--        naeem_daily_records and naeem_routes.
--     9. Preservation of parent-child tenant integrity for all entry and allocation tables.
--    10. Unique date and monthly balance constraints per workspace.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DYNAMIC DELIVERY WORKSPACE RESOLVER FUNCTION
--    (general_daily_records, naeem_routes, naeem_payments, naeem_monthly_balances)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_delivery_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_ws_type TEXT;
    v_ws_active BOOLEAN;
    v_matched_count INT;
    v_resolved_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Service role / background system maintenance (auth.uid() IS NULL)
    IF v_user_id IS NULL THEN
        IF NEW.workspace_id IS NOT NULL THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Authentication required: caller identity cannot be verified and no workspace_id provided.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 1. Verify caller profile exists and is active
    SELECT is_active, (system_role = 'SUPER_ADMIN')
    INTO v_is_user_active, v_is_super_admin
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_user_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Account suspended: active account required for delivery operations.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Case A: Client provided an explicit workspace_id
    IF NEW.workspace_id IS NOT NULL THEN
        -- Never trust client-provided workspace ID without validating membership
        SELECT workspace_type, is_active
        INTO v_ws_type, v_ws_active
        FROM public.workspaces
        WHERE id = NEW.workspace_id;

        IF v_ws_type IS NULL THEN
            RAISE EXCEPTION 'Invalid workspace: specified workspace does not exist.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Workspace inactive: cannot insert delivery records into a deactivated workspace.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_type <> 'BUSINESS' THEN
            RAISE EXCEPTION 'Invalid workspace type: delivery operations are restricted to business workspaces.'
                USING ERRCODE = '42501';
        END IF;

        -- Verify membership unless caller is super admin
        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- 3. Case B: Client did NOT provide workspace_id (NEW.workspace_id IS NULL)
    -- Resolve from verified, active business workspace memberships
    SELECT COUNT(DISTINCT w.id)
    INTO v_matched_count
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = v_user_id
      AND wm.is_active = true
      AND w.is_active = true
      AND w.workspace_type = 'BUSINESS';

    -- If user has no active business workspace memberships:
    IF v_matched_count = 0 THEN
        RAISE EXCEPTION 'No authorized business workspace: caller is not an active member of any business workspace.'
            USING ERRCODE = '42501';
    END IF;

    -- If user belongs to multiple active business workspaces, reject ambiguity:
    IF v_matched_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous workspace membership: caller belongs to multiple active business workspaces. Explicit workspace_id is required.'
            USING ERRCODE = '42501';
    END IF;

    -- Exactly 1 active business workspace: unambiguous resolution
    SELECT w.id
    INTO v_resolved_ws_id
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = v_user_id
      AND wm.is_active = true
      AND w.is_active = true
      AND w.workspace_type = 'BUSINESS'
    LIMIT 1;

    NEW.workspace_id := v_resolved_ws_id;
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
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_parent_workspace_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Service role / background system maintenance (auth.uid() IS NULL)
    IF v_user_id IS NULL THEN
        IF NEW.workspace_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Inherit from parent daily record
    IF NEW.daily_record_id IS NOT NULL THEN
        SELECT workspace_id INTO v_parent_workspace_id
        FROM public.general_daily_records
        WHERE id = NEW.daily_record_id;

        IF v_parent_workspace_id IS NULL THEN
            RAISE EXCEPTION 'Parent daily record not found: daily_record_id % does not exist.', NEW.daily_record_id
                USING ERRCODE = '42501';
        END IF;

        IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_parent_workspace_id THEN
            RAISE EXCEPTION 'Parent-child workspace mismatch: general_delivery_entries workspace must match daily record workspace.'
                USING ERRCODE = '42501';
        END IF;

        NEW.workspace_id := v_parent_workspace_id;
    ELSE
        RAISE EXCEPTION 'daily_record_id is required for general delivery entries.'
            USING ERRCODE = '42501';
    END IF;

    -- Verify caller profile is active and has access to parent workspace
    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for delivery operations.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_delivery_entry_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_delivery_entry_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_entry_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. NAEEM DAILY RECORD RESOLVER & ROUTE WORKSPACE CONSISTENCY (INSERT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_naeem_daily_record_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_route_workspace_id UUID;
    v_ws_type TEXT;
    v_ws_active BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    -- Service role / background system maintenance (auth.uid() IS NULL)
    IF v_user_id IS NULL THEN
        IF NEW.workspace_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    -- 1. Validate route_id
    IF NEW.route_id IS NULL THEN
        RAISE EXCEPTION 'route_id is required for naeem daily delivery records.'
            USING ERRCODE = '42501';
    END IF;

    SELECT r.workspace_id, w.workspace_type, w.is_active
    INTO v_route_workspace_id, v_ws_type, v_ws_active
    FROM public.naeem_routes r
    JOIN public.workspaces w ON w.id = r.workspace_id
    WHERE r.id = NEW.route_id;

    IF v_route_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Invalid route: specified route does not exist.'
            USING ERRCODE = '42501';
    END IF;

    IF v_ws_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Workspace inactive: route belongs to an inactive workspace.'
            USING ERRCODE = '42501';
    END IF;

    IF v_ws_type <> 'BUSINESS' THEN
        RAISE EXCEPTION 'Invalid workspace type: route belongs to a non-business workspace.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Verify caller profile exists and is active
    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for delivery operations.'
                USING ERRCODE = '42501';
        END IF;

        -- Verify caller has active membership in the route's workspace
        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = v_route_workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized route: caller is not an active member of the route''s workspace.'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- 3. If caller supplied workspace_id, verify it matches route's workspace
    IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_route_workspace_id THEN
        RAISE EXCEPTION 'Workspace mismatch: naeem_daily_records workspace (%) must match route workspace (%).',
            NEW.workspace_id, v_route_workspace_id
            USING ERRCODE = '42501';
    END IF;

    -- Inherit workspace_id directly from the verified route
    NEW.workspace_id := v_route_workspace_id;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_naeem_daily_record_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_naeem_daily_record_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_naeem_daily_record_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. NAEEM DAILY RECORD ROUTE & WORKSPACE UPDATE VALIDATOR (UPDATE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_naeem_daily_record_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_new_route_ws_id UUID;
BEGIN
    -- 1. Enforce workspace immutability
    IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        RAISE EXCEPTION 'Workspace immutability violation: workspace_id cannot be modified.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. If route_id is modified, ensure the new route belongs to the same workspace
    IF NEW.route_id IS DISTINCT FROM OLD.route_id THEN
        SELECT workspace_id INTO v_new_route_ws_id
        FROM public.naeem_routes
        WHERE id = NEW.route_id;

        IF v_new_route_ws_id IS NULL THEN
            RAISE EXCEPTION 'Invalid route: new route does not exist.'
                USING ERRCODE = '42501';
        END IF;

        IF v_new_route_ws_id <> NEW.workspace_id THEN
            RAISE EXCEPTION 'Workspace route mismatch: cannot change route to a route belonging to a different workspace.'
                USING ERRCODE = '42501';
        END IF;

        -- Verify caller is active
        v_user_id := auth.uid();
        IF v_user_id IS NOT NULL THEN
            SELECT is_active, (system_role = 'SUPER_ADMIN')
            INTO v_is_user_active, v_is_super_admin
            FROM public.profiles
            WHERE id = v_user_id;

            IF v_is_user_active IS NOT TRUE THEN
                RAISE EXCEPTION 'Account suspended: active account required for delivery operations.'
                    USING ERRCODE = '42501';
            END IF;

            IF NOT v_is_super_admin THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.workspace_members wm
                    WHERE wm.workspace_id = NEW.workspace_id
                      AND wm.user_id = v_user_id
                      AND wm.is_active = true
                ) THEN
                    RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of workspace %.', NEW.workspace_id
                        USING ERRCODE = '42501';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_naeem_daily_record_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_naeem_daily_record_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_naeem_daily_record_update() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. CHILD TABLE RESOLVER: NAEEM PAYMENT ALLOCATIONS (INSERT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_naeem_allocation_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_payment_ws_id UUID;
    v_daily_record_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Service role / background system maintenance (auth.uid() IS NULL)
    IF v_user_id IS NULL THEN
        IF NEW.workspace_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Look up payment's workspace
    IF NEW.payment_id IS NOT NULL THEN
        SELECT workspace_id INTO v_payment_ws_id
        FROM public.naeem_payments
        WHERE id = NEW.payment_id;

        IF v_payment_ws_id IS NULL THEN
            RAISE EXCEPTION 'Parent payment not found: payment_id % does not exist.', NEW.payment_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Look up daily record's workspace
    IF NEW.daily_record_id IS NOT NULL THEN
        SELECT workspace_id INTO v_daily_record_ws_id
        FROM public.naeem_daily_records
        WHERE id = NEW.daily_record_id;

        IF v_daily_record_ws_id IS NULL THEN
            RAISE EXCEPTION 'Parent daily record not found: daily_record_id % does not exist.', NEW.daily_record_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Verify payment and daily record belong to the same workspace
    IF v_payment_ws_id IS NOT NULL AND v_daily_record_ws_id IS NOT NULL THEN
        IF v_payment_ws_id <> v_daily_record_ws_id THEN
            RAISE EXCEPTION 'Parent-child workspace mismatch: payment workspace (%) does not match daily record workspace (%).',
                v_payment_ws_id, v_daily_record_ws_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- If client passed workspace_id, verify it matches
    IF NEW.workspace_id IS NOT NULL THEN
        IF v_payment_ws_id IS NOT NULL AND NEW.workspace_id <> v_payment_ws_id THEN
            RAISE EXCEPTION 'Workspace mismatch: allocation workspace does not match payment workspace.'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        NEW.workspace_id := COALESCE(v_payment_ws_id, v_daily_record_ws_id);
    END IF;

    IF NEW.workspace_id IS NULL THEN
        RAISE EXCEPTION 'Unable to resolve workspace for payment allocation.'
            USING ERRCODE = '42501';
    END IF;

    -- Verify caller profile is active and has access to this workspace
    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for delivery operations.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_naeem_allocation_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_naeem_allocation_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_naeem_allocation_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 6. GENERAL DELIVERY WORKSPACE IMMUTABILITY FUNCTION (UPDATE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_delivery_workspace_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        RAISE EXCEPTION 'Workspace immutability violation: workspace_id cannot be modified.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.prevent_delivery_workspace_reassignment() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_delivery_workspace_reassignment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_delivery_workspace_reassignment() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. ATTACH BEFORE INSERT TRIGGERS
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
FOR EACH ROW EXECUTE FUNCTION public.resolve_naeem_daily_record_workspace();

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
-- 8. ATTACH BEFORE UPDATE TRIGGERS
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
DROP TRIGGER IF EXISTS trg_naeem_daily_records_update_validate ON public.naeem_daily_records;
CREATE TRIGGER trg_naeem_daily_records_update_validate
BEFORE UPDATE ON public.naeem_daily_records
FOR EACH ROW EXECUTE FUNCTION public.validate_naeem_daily_record_update();

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
-- 9. MULTI-TENANT UNIQUE CONSTRAINTS & COMPOSITE FOREIGN KEYS
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

-- NAEEM Routes: Add composite UNIQUE (id, workspace_id) to support composite FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'naeem_routes_id_workspace_unique'
    ) THEN
        ALTER TABLE public.naeem_routes
        ADD CONSTRAINT naeem_routes_id_workspace_unique UNIQUE (id, workspace_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'naeem_daily_records_route_workspace_fkey'
    ) THEN
        ALTER TABLE public.naeem_daily_records
        ADD CONSTRAINT naeem_daily_records_route_workspace_fkey
        FOREIGN KEY (route_id, workspace_id)
        REFERENCES public.naeem_routes(id, workspace_id);
    END IF;
END $$;
