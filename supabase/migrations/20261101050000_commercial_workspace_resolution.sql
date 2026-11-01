-- ============================================================================
-- MIGRATION: 20261101050000_commercial_workspace_resolution.sql
-- Module: 7TIME Commercial & Customer Domain Multi-Account Architecture
-- Scope: Automatic workspace resolution and tenant integrity enforcement for:
--        dealers, products, purchases, dealer_payments, wholesale_sales,
--        reseller_customers, customer_credits, customer_payment_allocations,
--        reseller_payments
-- Description:
--   Attaches dynamic workspace resolution triggers (BEFORE INSERT) and
--   immutability triggers (BEFORE UPDATE) across all commercial domain tables.
--   Enforces:
--     1. Derivation of caller identity exclusively via auth.uid().
--     2. Resolution through verified, active workspace membership.
--     3. Rejection of suspended accounts.
--     4. Type matching: BUSINESS workspaces for commercial wholesale/dealers,
--        and PERSONAL workspaces for personal ledger contacts.
--     5. Rejection of ambiguous workspace membership when workspace context is omitted.
--     6. Complete elimination of hardcoded enterprise workspace UUID fallbacks.
--     7. Strict validation of client-provided workspace IDs against memberships.
--     8. Parent-child workspace inheritance and consistency across:
--        dealers -> purchases, dealer_payments
--        reseller_customers -> customer_credits, reseller_payments
--        customer_credits + reseller_payments -> customer_payment_allocations
--     9. Workspace immutability on UPDATE operations across all domain tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DYNAMIC BUSINESS WORKSPACE RESOLVER FUNCTION
--    (dealers, products, wholesale_sales)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_business_workspace()
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
        RAISE EXCEPTION 'Account suspended: active account required for commercial operations.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Case A: Client provided an explicit workspace_id
    IF NEW.workspace_id IS NOT NULL THEN
        SELECT workspace_type, is_active
        INTO v_ws_type, v_ws_active
        FROM public.workspaces
        WHERE id = NEW.workspace_id;

        IF v_ws_type IS NULL THEN
            RAISE EXCEPTION 'Invalid workspace: specified workspace does not exist.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Workspace inactive: cannot insert commercial records into a deactivated workspace.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_type <> 'BUSINESS' THEN
            RAISE EXCEPTION 'Invalid workspace type: commercial operations are restricted to business workspaces.'
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
    SELECT COUNT(DISTINCT w.id)
    INTO v_matched_count
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = v_user_id
      AND wm.is_active = true
      AND w.is_active = true
      AND w.workspace_type = 'BUSINESS';

    IF v_matched_count = 0 THEN
        RAISE EXCEPTION 'No authorized business workspace: caller is not an active member of any business workspace.'
            USING ERRCODE = '42501';
    END IF;

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

ALTER FUNCTION public.resolve_business_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_business_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_business_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. RESELLER & LOCAL CUSTOMER WORKSPACE RESOLVER
--    (reseller_customers: supports both BUSINESS and PERSONAL contacts)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_reseller_customer_workspace()
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
    v_target_type TEXT;
    v_matched_count INT;
    v_resolved_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Service role / background maintenance
    IF v_user_id IS NULL THEN
        IF NEW.workspace_id IS NOT NULL THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Authentication required: caller identity cannot be verified and no workspace_id provided.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Verify caller profile
    SELECT is_active, (system_role = 'SUPER_ADMIN')
    INTO v_is_user_active, v_is_super_admin
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_user_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Account suspended: active account required for customer management.'
            USING ERRCODE = '42501';
    END IF;

    -- Determine target workspace type from contact_type (default: BUSINESS)
    IF NEW.contact_type = 'PERSONAL' THEN
        v_target_type := 'PERSONAL';
    ELSE
        v_target_type := 'BUSINESS';
        NEW.contact_type := 'BUSINESS';
    END IF;

    -- Case A: Explicit workspace_id provided
    IF NEW.workspace_id IS NOT NULL THEN
        SELECT workspace_type, is_active
        INTO v_ws_type, v_ws_active
        FROM public.workspaces
        WHERE id = NEW.workspace_id;

        IF v_ws_type IS NULL THEN
            RAISE EXCEPTION 'Invalid workspace: specified workspace does not exist.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Workspace inactive: cannot add customers to a deactivated workspace.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_type <> v_target_type THEN
            RAISE EXCEPTION 'Workspace type mismatch: customer contact_type is % but workspace is %.', v_target_type, v_ws_type
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

        RETURN NEW;
    END IF;

    -- Case B: Unspecified workspace_id -> resolve based on target_type
    SELECT COUNT(DISTINCT w.id)
    INTO v_matched_count
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = v_user_id
      AND wm.is_active = true
      AND w.is_active = true
      AND w.workspace_type = v_target_type;

    IF v_matched_count = 0 THEN
        RAISE EXCEPTION 'No authorized % workspace: caller is not an active member of any % workspace.', v_target_type, lower(v_target_type)
            USING ERRCODE = '42501';
    END IF;

    IF v_matched_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous % workspace membership: caller belongs to multiple active % workspaces. Explicit workspace_id is required.', v_target_type, lower(v_target_type)
            USING ERRCODE = '42501';
    END IF;

    SELECT w.id
    INTO v_resolved_ws_id
    FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = v_user_id
      AND wm.is_active = true
      AND w.is_active = true
      AND w.workspace_type = v_target_type
    LIMIT 1;

    NEW.workspace_id := v_resolved_ws_id;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_reseller_customer_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_reseller_customer_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_reseller_customer_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. DEALER CHILD TABLE WORKSPACE RESOLVER
--    (purchases, dealer_payments)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dealer_child_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_dealer_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.dealer_id IS NULL THEN
        RAISE EXCEPTION 'dealer_id is required for dealer transactions.'
            USING ERRCODE = '42501';
    END IF;

    -- Lookup dealer's workspace
    SELECT workspace_id INTO v_dealer_ws_id
    FROM public.dealers
    WHERE id = NEW.dealer_id;

    IF v_dealer_ws_id IS NULL THEN
        RAISE EXCEPTION 'Parent dealer not found: dealer_id % does not exist.', NEW.dealer_id
            USING ERRCODE = '42501';
    END IF;

    -- Validate workspace consistency
    IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_dealer_ws_id THEN
        RAISE EXCEPTION 'Workspace mismatch: transaction workspace must match dealer workspace.'
            USING ERRCODE = '42501';
    END IF;

    NEW.workspace_id := v_dealer_ws_id;

    -- Verify caller authorization in dealer's workspace
    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for dealer transactions.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of dealer workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_dealer_child_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_dealer_child_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_dealer_child_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. CUSTOMER CHILD TABLE WORKSPACE RESOLVER
--    (customer_credits, reseller_payments)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_customer_child_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_customer_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.customer_id IS NULL THEN
        RAISE EXCEPTION 'customer_id is required for customer credit/payment transactions.'
            USING ERRCODE = '42501';
    END IF;

    -- Lookup customer's workspace
    SELECT workspace_id INTO v_customer_ws_id
    FROM public.reseller_customers
    WHERE id = NEW.customer_id;

    IF v_customer_ws_id IS NULL THEN
        RAISE EXCEPTION 'Parent customer not found: customer_id % does not exist.', NEW.customer_id
            USING ERRCODE = '42501';
    END IF;

    -- Validate workspace consistency
    IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_customer_ws_id THEN
        RAISE EXCEPTION 'Workspace mismatch: transaction workspace must match customer workspace.'
            USING ERRCODE = '42501';
    END IF;

    NEW.workspace_id := v_customer_ws_id;

    -- Verify caller authorization in customer's workspace
    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for customer transactions.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of customer workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_customer_child_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_customer_child_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_customer_child_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. CUSTOMER PAYMENT ALLOCATION WORKSPACE RESOLVER
--    (customer_payment_allocations)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_customer_allocation_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_credit_ws_id UUID;
    v_payment_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.credit_id IS NULL OR NEW.payment_id IS NULL THEN
        RAISE EXCEPTION 'credit_id and payment_id are required for payment allocations.'
            USING ERRCODE = '42501';
    END IF;

    SELECT workspace_id INTO v_credit_ws_id
    FROM public.customer_credits
    WHERE id = NEW.credit_id;

    IF v_credit_ws_id IS NULL THEN
        RAISE EXCEPTION 'Parent credit entry not found: credit_id % does not exist.', NEW.credit_id
            USING ERRCODE = '42501';
    END IF;

    SELECT workspace_id INTO v_payment_ws_id
    FROM public.reseller_payments
    WHERE id = NEW.payment_id;

    IF v_payment_ws_id IS NULL THEN
        RAISE EXCEPTION 'Parent payment entry not found: payment_id % does not exist.', NEW.payment_id
            USING ERRCODE = '42501';
    END IF;

    IF v_credit_ws_id <> v_payment_ws_id THEN
        RAISE EXCEPTION 'Tenant violation: payment (%) and credit (%) belong to different workspaces.',
            v_payment_ws_id, v_credit_ws_id
            USING ERRCODE = '42501';
    END IF;

    IF NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_credit_ws_id THEN
        RAISE EXCEPTION 'Workspace mismatch: allocation workspace must match parent workspace.'
            USING ERRCODE = '42501';
    END IF;

    NEW.workspace_id := v_credit_ws_id;

    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for allocations.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of allocation workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_customer_allocation_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_customer_allocation_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_customer_allocation_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 6. COMMERCIAL CHILD TABLE UPDATE VALIDATOR
--    (purchases, dealer_payments, customer_credits, reseller_payments, wholesale_sales)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_commercial_child_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_parent_ws_id UUID;
BEGIN
    -- 1. Workspace immutability
    IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        RAISE EXCEPTION 'Workspace immutability violation: workspace_id cannot be modified.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Dealer child parent reassignment check
    IF TG_TABLE_NAME IN ('purchases', 'dealer_payments') THEN
        IF NEW.dealer_id IS DISTINCT FROM OLD.dealer_id THEN
            SELECT workspace_id INTO v_new_parent_ws_id
            FROM public.dealers
            WHERE id = NEW.dealer_id;

            IF v_new_parent_ws_id IS NULL OR v_new_parent_ws_id <> NEW.workspace_id THEN
                RAISE EXCEPTION 'Parent reassignment violation: new dealer belongs to a different workspace.'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- 3. Customer child parent reassignment check
    IF TG_TABLE_NAME IN ('customer_credits', 'reseller_payments') THEN
        IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
            SELECT workspace_id INTO v_new_parent_ws_id
            FROM public.reseller_customers
            WHERE id = NEW.customer_id;

            IF v_new_parent_ws_id IS NULL OR v_new_parent_ws_id <> NEW.workspace_id THEN
                RAISE EXCEPTION 'Parent reassignment violation: new customer belongs to a different workspace.'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_commercial_child_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_commercial_child_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_commercial_child_update() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 6B. COMMERCIAL WORKSPACE IMMUTABILITY FUNCTION (UPDATE)
--     (dealers, products, reseller_customers, customer_payment_allocations)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_workspace_reassignment()
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

ALTER FUNCTION public.prevent_workspace_reassignment() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_workspace_reassignment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_workspace_reassignment() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. ATTACH TRIGGERS ACROSS ALL COMMERCIAL & CUSTOMER TABLES
-- ----------------------------------------------------------------------------

-- Dealers
DROP TRIGGER IF EXISTS trg_resolve_dealer_workspace ON public.dealers;
CREATE TRIGGER trg_resolve_dealer_workspace
BEFORE INSERT ON public.dealers
FOR EACH ROW
EXECUTE FUNCTION public.resolve_business_workspace();

DROP TRIGGER IF EXISTS trg_prevent_dealer_workspace_change ON public.dealers;
CREATE TRIGGER trg_prevent_dealer_workspace_change
BEFORE UPDATE ON public.dealers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_reassignment();

-- Products
DROP TRIGGER IF EXISTS trg_resolve_product_workspace ON public.products;
CREATE TRIGGER trg_resolve_product_workspace
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.resolve_business_workspace();

DROP TRIGGER IF EXISTS trg_prevent_product_workspace_change ON public.products;
CREATE TRIGGER trg_prevent_product_workspace_change
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_reassignment();

-- Purchases
DROP TRIGGER IF EXISTS trg_resolve_purchase_workspace ON public.purchases;
CREATE TRIGGER trg_resolve_purchase_workspace
BEFORE INSERT ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.resolve_dealer_child_workspace();

DROP TRIGGER IF EXISTS trg_validate_purchase_update ON public.purchases;
CREATE TRIGGER trg_validate_purchase_update
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.validate_commercial_child_update();

-- Dealer Payments
DROP TRIGGER IF EXISTS trg_resolve_dealer_payment_workspace ON public.dealer_payments;
CREATE TRIGGER trg_resolve_dealer_payment_workspace
BEFORE INSERT ON public.dealer_payments
FOR EACH ROW
EXECUTE FUNCTION public.resolve_dealer_child_workspace();

DROP TRIGGER IF EXISTS trg_validate_dealer_payment_update ON public.dealer_payments;
CREATE TRIGGER trg_validate_dealer_payment_update
BEFORE UPDATE ON public.dealer_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_commercial_child_update();

-- Wholesale Sales
DROP TRIGGER IF EXISTS trg_resolve_wholesale_sale_workspace ON public.wholesale_sales;
CREATE TRIGGER trg_resolve_wholesale_sale_workspace
BEFORE INSERT ON public.wholesale_sales
FOR EACH ROW
EXECUTE FUNCTION public.resolve_business_workspace();

DROP TRIGGER IF EXISTS trg_validate_wholesale_sale_update ON public.wholesale_sales;
CREATE TRIGGER trg_validate_wholesale_sale_update
BEFORE UPDATE ON public.wholesale_sales
FOR EACH ROW
EXECUTE FUNCTION public.validate_commercial_child_update();

-- Reseller Customers
DROP TRIGGER IF EXISTS trg_resolve_reseller_customer_workspace ON public.reseller_customers;
CREATE TRIGGER trg_resolve_reseller_customer_workspace
BEFORE INSERT ON public.reseller_customers
FOR EACH ROW
EXECUTE FUNCTION public.resolve_reseller_customer_workspace();

DROP TRIGGER IF EXISTS trg_prevent_reseller_customer_workspace_change ON public.reseller_customers;
CREATE TRIGGER trg_prevent_reseller_customer_workspace_change
BEFORE UPDATE ON public.reseller_customers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_reassignment();

-- Customer Credits
DROP TRIGGER IF EXISTS trg_resolve_customer_credit_workspace ON public.customer_credits;
CREATE TRIGGER trg_resolve_customer_credit_workspace
BEFORE INSERT ON public.customer_credits
FOR EACH ROW
EXECUTE FUNCTION public.resolve_customer_child_workspace();

DROP TRIGGER IF EXISTS trg_validate_customer_credit_update ON public.customer_credits;
CREATE TRIGGER trg_validate_customer_credit_update
BEFORE UPDATE ON public.customer_credits
FOR EACH ROW
EXECUTE FUNCTION public.validate_commercial_child_update();

-- Reseller Payments
DROP TRIGGER IF EXISTS trg_resolve_reseller_payment_workspace ON public.reseller_payments;
CREATE TRIGGER trg_resolve_reseller_payment_workspace
BEFORE INSERT ON public.reseller_payments
FOR EACH ROW
EXECUTE FUNCTION public.resolve_customer_child_workspace();

DROP TRIGGER IF EXISTS trg_validate_reseller_payment_update ON public.reseller_payments;
CREATE TRIGGER trg_validate_reseller_payment_update
BEFORE UPDATE ON public.reseller_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_commercial_child_update();

-- Customer Payment Allocations
DROP TRIGGER IF EXISTS trg_resolve_customer_allocation_workspace ON public.customer_payment_allocations;
CREATE TRIGGER trg_resolve_customer_allocation_workspace
BEFORE INSERT ON public.customer_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.resolve_customer_allocation_workspace();

DROP TRIGGER IF EXISTS trg_prevent_customer_allocation_workspace_change ON public.customer_payment_allocations;
CREATE TRIGGER trg_prevent_customer_allocation_workspace_change
BEFORE UPDATE ON public.customer_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_workspace_reassignment();

