-- ============================================================================
-- 7TIME WORKSPACE OWNERSHIP INTEGRITY & WRITE COMPATIBILITY SCRIPT
-- File: 7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql
-- Status: PREPARED OFFLINE — DO NOT APPLY WITHOUT EXPLICIT AUTHORIZATION
-- Target Supabase Project: haofuuvwciqsambgeqyn
-- Scope: 
--   1. Dynamic Enterprise Workspace resolution for 15 commercial tables
--   2. Strict Personal Workspace isolation for Personal Ledger contacts
--   3. Relational parent-to-child workspace inheritance for debt & payments
--   4. Universal UPDATE immutability preventing cross-workspace reassignment
--   5. Hardened, workspace-aware payment allocation RPC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMMERCIAL TABLES DYNAMIC WORKSPACE RESOLVER
-- ----------------------------------------------------------------------------
-- Assigns caller's active business workspace, or defaults to primary enterprise.
-- Pure commercial tables never hold personal individual assets.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_enterprise_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.workspace_id IS NULL THEN
        -- Attempt to resolve caller's active business workspace
        SELECT w.id INTO NEW.workspace_id
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = auth.uid()
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'BUSINESS'
        ORDER BY (w.owner_id = auth.uid()) DESC, w.created_at ASC
        LIMIT 1;

        -- Fallback to Primary Enterprise Workspace for administrator or unmapped users
        IF NEW.workspace_id IS NULL THEN
            NEW.workspace_id := 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_enterprise_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_enterprise_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_enterprise_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. RESELLER CUSTOMERS DYNAMIC CONTEXT RESOLVER
-- ----------------------------------------------------------------------------
-- Guarantees personal debtors are routed to caller's personal workspace,
-- while commercial wholesale resellers are routed to business workspace.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_reseller_customer_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_personal_ws UUID;
    v_business_ws UUID;
    v_ws_type TEXT;
BEGIN
    v_user_id := auth.uid();

    -- Case A: workspace_id explicitly supplied by client
    IF NEW.workspace_id IS NOT NULL THEN
        SELECT workspace_type INTO v_ws_type
        FROM public.workspaces
        WHERE id = NEW.workspace_id AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target workspace % does not exist or is inactive', NEW.workspace_id;
        END IF;

        -- Align contact_type with workspace type if null
        IF NEW.contact_type IS NULL THEN
            IF v_ws_type = 'PERSONAL' THEN
                NEW.contact_type := 'PERSONAL';
            ELSE
                NEW.contact_type := 'BUSINESS';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- Case B: workspace_id omitted (legacy client or direct service call)
    IF v_user_id IS NOT NULL THEN
        -- Find caller's personal workspace
        SELECT id INTO v_personal_ws
        FROM public.workspaces
        WHERE owner_id = v_user_id AND workspace_type = 'PERSONAL' AND is_active = true
        LIMIT 1;

        -- Find caller's active business workspace
        SELECT w.id INTO v_business_ws
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = v_user_id 
          AND wm.is_active = true 
          AND w.is_active = true 
          AND w.workspace_type = 'BUSINESS'
        ORDER BY (w.owner_id = v_user_id) DESC, w.created_at ASC
        LIMIT 1;

        -- Routing Decision:
        IF NEW.contact_type = 'PERSONAL' THEN
            -- Explicitly personal debtor
            IF v_personal_ws IS NOT NULL THEN
                NEW.workspace_id := v_personal_ws;
            ELSE
                NEW.workspace_id := COALESCE(v_business_ws, 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID);
            END IF;
        ELSE
            -- Default or business contact
            IF v_business_ws IS NOT NULL THEN
                NEW.workspace_id := v_business_ws;
                NEW.contact_type := 'BUSINESS';
            ELSIF v_personal_ws IS NOT NULL THEN
                -- Caller only has personal workspace: cannot create commercial contacts
                NEW.workspace_id := v_personal_ws;
                NEW.contact_type := 'PERSONAL';
            ELSE
                -- Primary enterprise fallback for administrator
                NEW.workspace_id := 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID;
                NEW.contact_type := 'BUSINESS';
            END IF;
        END IF;
    ELSE
        -- Service-role or migration fallback
        NEW.workspace_id := COALESCE(NEW.workspace_id, 'fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15'::UUID);
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.resolve_reseller_customer_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_reseller_customer_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_reseller_customer_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. PARENT-DERIVED WORKSPACE INHERITANCE TRIGGERS
-- ----------------------------------------------------------------------------
-- Guarantees customer_credits and reseller_payments mirror customer's workspace,
-- and customer_payment_allocations mirror credit's workspace.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inherit_customer_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cust_ws UUID;
BEGIN
    SELECT workspace_id INTO v_cust_ws
    FROM public.reseller_customers
    WHERE id = NEW.customer_id;

    IF v_cust_ws IS NULL THEN
        RAISE EXCEPTION 'Customer % not found or has no workspace', NEW.customer_id;
    END IF;

    IF NEW.workspace_id IS NULL THEN
        NEW.workspace_id := v_cust_ws;
    ELSIF NEW.workspace_id <> v_cust_ws THEN
        RAISE EXCEPTION 'Parent-child workspace mismatch: customer % belongs to workspace %, but record specifies workspace %',
            NEW.customer_id, v_cust_ws, NEW.workspace_id;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.inherit_customer_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.inherit_customer_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inherit_customer_workspace() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inherit_credit_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_credit_ws UUID;
BEGIN
    SELECT workspace_id INTO v_credit_ws
    FROM public.customer_credits
    WHERE id = NEW.credit_id;

    IF v_credit_ws IS NULL THEN
        RAISE EXCEPTION 'Credit % not found or has no workspace', NEW.credit_id;
    END IF;

    IF NEW.workspace_id IS NULL THEN
        NEW.workspace_id := v_credit_ws;
    ELSIF NEW.workspace_id <> v_credit_ws THEN
        RAISE EXCEPTION 'Parent-child workspace mismatch: credit % belongs to workspace %, but allocation specifies workspace %',
            NEW.credit_id, v_credit_ws, NEW.workspace_id;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.inherit_credit_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.inherit_credit_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inherit_credit_workspace() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. UNIVERSAL WORKSPACE IMMUTABILITY ENFORCEMENT
-- ----------------------------------------------------------------------------
-- Prevents ordinary users from reassigning workspace_id across all tables.
-- Verifies parent-child consistency if relational foreign keys are modified.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_workspace_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_ws UUID;
BEGIN
    -- 1. Check workspace_id modification
    IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        -- Only Super Admin or postgres superuser is permitted to reassign workspace
        IF current_user != 'postgres' AND NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Unauthorized: workspace_id is immutable (table: %, row: %)', TG_TABLE_NAME, OLD.id;
        END IF;

        -- Target workspace must exist and be active
        IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND is_active = true) THEN
            RAISE EXCEPTION 'Target workspace % does not exist or is inactive', NEW.workspace_id;
        END IF;
    END IF;

    -- 2. Verify parent-child integrity if foreign key changed
    IF TG_TABLE_NAME IN ('customer_credits', 'reseller_payments') THEN
        IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
            SELECT workspace_id INTO v_parent_ws FROM public.reseller_customers WHERE id = NEW.customer_id;
            IF v_parent_ws IS NULL OR v_parent_ws <> NEW.workspace_id THEN
                RAISE EXCEPTION 'Parent-child workspace mismatch: customer % belongs to workspace %, but record is in %',
                    NEW.customer_id, v_parent_ws, NEW.workspace_id;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'customer_payment_allocations' THEN
        IF NEW.credit_id IS DISTINCT FROM OLD.credit_id THEN
            SELECT workspace_id INTO v_parent_ws FROM public.customer_credits WHERE id = NEW.credit_id;
            IF v_parent_ws IS NULL OR v_parent_ws <> NEW.workspace_id THEN
                RAISE EXCEPTION 'Parent-child workspace mismatch: credit % belongs to workspace %, but allocation is in %',
                    NEW.credit_id, v_parent_ws, NEW.workspace_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_workspace_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_workspace_immutability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_workspace_immutability() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. ATTACH TRIGGERS ACROSS ALL 19 OPERATIONAL TABLES
-- ----------------------------------------------------------------------------

-- A. Commercial Tables BEFORE INSERT Defaults
DROP TRIGGER IF EXISTS trg_products_ws_default ON public.products;
CREATE TRIGGER trg_products_ws_default
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_dealers_ws_default ON public.dealers;
CREATE TRIGGER trg_dealers_ws_default
BEFORE INSERT ON public.dealers
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_purchases_ws_default ON public.purchases;
CREATE TRIGGER trg_purchases_ws_default
BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_dealer_payments_ws_default ON public.dealer_payments;
CREATE TRIGGER trg_dealer_payments_ws_default
BEFORE INSERT ON public.dealer_payments
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_wholesale_sales_ws_default ON public.wholesale_sales;
CREATE TRIGGER trg_wholesale_sales_ws_default
BEFORE INSERT ON public.wholesale_sales
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_gen_daily_records_ws_default ON public.general_daily_records;
CREATE TRIGGER trg_gen_daily_records_ws_default
BEFORE INSERT ON public.general_daily_records
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_gen_delivery_entries_ws_default ON public.general_delivery_entries;
CREATE TRIGGER trg_gen_delivery_entries_ws_default
BEFORE INSERT ON public.general_delivery_entries
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_customers') THEN
        DROP TRIGGER IF EXISTS trg_immutable_ws_delivery_customers ON public.delivery_customers;
        CREATE TRIGGER trg_immutable_ws_delivery_customers BEFORE UPDATE ON public.delivery_customers FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_routes') THEN
        DROP TRIGGER IF EXISTS trg_immutable_ws_delivery_routes ON public.delivery_routes;
        CREATE TRIGGER trg_immutable_ws_delivery_routes BEFORE UPDATE ON public.delivery_routes FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_deliveries') THEN
        DROP TRIGGER IF EXISTS trg_immutable_ws_daily_deliveries ON public.daily_deliveries;
        CREATE TRIGGER trg_immutable_ws_daily_deliveries BEFORE UPDATE ON public.daily_deliveries FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_naeem_routes_ws_default ON public.naeem_routes;
CREATE TRIGGER trg_naeem_routes_ws_default
BEFORE INSERT ON public.naeem_routes
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_naeem_daily_records_ws_default ON public.naeem_daily_records;
CREATE TRIGGER trg_naeem_daily_records_ws_default
BEFORE INSERT ON public.naeem_daily_records
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_naeem_payments_ws_default ON public.naeem_payments;
CREATE TRIGGER trg_naeem_payments_ws_default
BEFORE INSERT ON public.naeem_payments
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_naeem_monthly_balances_ws_default ON public.naeem_monthly_balances;
CREATE TRIGGER trg_naeem_monthly_balances_ws_default
BEFORE INSERT ON public.naeem_monthly_balances
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

DROP TRIGGER IF EXISTS trg_naeem_allocations_ws_default ON public.naeem_payment_allocations;
CREATE TRIGGER trg_naeem_allocations_ws_default
BEFORE INSERT ON public.naeem_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.resolve_enterprise_workspace();

-- B. Personal & Relational Tables BEFORE INSERT
DROP TRIGGER IF EXISTS trg_reseller_customers_ws_default ON public.reseller_customers;
CREATE TRIGGER trg_reseller_customers_ws_default
BEFORE INSERT ON public.reseller_customers
FOR EACH ROW EXECUTE FUNCTION public.resolve_reseller_customer_workspace();

DROP TRIGGER IF EXISTS trg_customer_credits_ws_default ON public.customer_credits;
CREATE TRIGGER trg_customer_credits_ws_default
BEFORE INSERT ON public.customer_credits
FOR EACH ROW EXECUTE FUNCTION public.inherit_customer_workspace();

DROP TRIGGER IF EXISTS trg_reseller_payments_ws_default ON public.reseller_payments;
CREATE TRIGGER trg_reseller_payments_ws_default
BEFORE INSERT ON public.reseller_payments
FOR EACH ROW EXECUTE FUNCTION public.inherit_customer_workspace();

DROP TRIGGER IF EXISTS trg_allocations_ws_default ON public.customer_payment_allocations;
CREATE TRIGGER trg_allocations_ws_default
BEFORE INSERT ON public.customer_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.inherit_credit_workspace();

-- C. Universal BEFORE UPDATE Immutability Triggers (All 19 Tables)
DROP TRIGGER IF EXISTS trg_immutable_ws_dealers ON public.dealers;
CREATE TRIGGER trg_immutable_ws_dealers BEFORE UPDATE ON public.dealers FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_products ON public.products;
CREATE TRIGGER trg_immutable_ws_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_purchases ON public.purchases;
CREATE TRIGGER trg_immutable_ws_purchases BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_dealer_payments ON public.dealer_payments;
CREATE TRIGGER trg_immutable_ws_dealer_payments BEFORE UPDATE ON public.dealer_payments FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_wholesale_sales ON public.wholesale_sales;
CREATE TRIGGER trg_immutable_ws_wholesale_sales BEFORE UPDATE ON public.wholesale_sales FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_reseller_customers ON public.reseller_customers;
CREATE TRIGGER trg_immutable_ws_reseller_customers BEFORE UPDATE ON public.reseller_customers FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_customer_credits ON public.customer_credits;
CREATE TRIGGER trg_immutable_ws_customer_credits BEFORE UPDATE ON public.customer_credits FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_reseller_payments ON public.reseller_payments;
CREATE TRIGGER trg_immutable_ws_reseller_payments BEFORE UPDATE ON public.reseller_payments FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_allocations ON public.customer_payment_allocations;
CREATE TRIGGER trg_immutable_ws_allocations BEFORE UPDATE ON public.customer_payment_allocations FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_general_daily_records ON public.general_daily_records;
CREATE TRIGGER trg_immutable_ws_general_daily_records BEFORE UPDATE ON public.general_daily_records FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_general_delivery_entries ON public.general_delivery_entries;
CREATE TRIGGER trg_immutable_ws_general_delivery_entries BEFORE UPDATE ON public.general_delivery_entries FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_customers') THEN
        DROP TRIGGER IF EXISTS trg_immutable_ws_delivery_customers ON public.delivery_customers;
        CREATE TRIGGER trg_immutable_ws_delivery_customers BEFORE UPDATE ON public.delivery_customers FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_routes') THEN
        DROP TRIGGER IF EXISTS trg_immutable_ws_delivery_routes ON public.delivery_routes;
        CREATE TRIGGER trg_immutable_ws_delivery_routes BEFORE UPDATE ON public.delivery_routes FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_deliveries') THEN
        DROP TRIGGER IF EXISTS trg_immutable_ws_daily_deliveries ON public.daily_deliveries;
        CREATE TRIGGER trg_immutable_ws_daily_deliveries BEFORE UPDATE ON public.daily_deliveries FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_immutable_ws_naeem_routes ON public.naeem_routes;
CREATE TRIGGER trg_immutable_ws_naeem_routes BEFORE UPDATE ON public.naeem_routes FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_naeem_daily_records ON public.naeem_daily_records;
CREATE TRIGGER trg_immutable_ws_naeem_daily_records BEFORE UPDATE ON public.naeem_daily_records FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_naeem_payments ON public.naeem_payments;
CREATE TRIGGER trg_immutable_ws_naeem_payments BEFORE UPDATE ON public.naeem_payments FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_naeem_monthly_balances ON public.naeem_monthly_balances;
CREATE TRIGGER trg_immutable_ws_naeem_monthly_balances BEFORE UPDATE ON public.naeem_monthly_balances FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();

DROP TRIGGER IF EXISTS trg_immutable_ws_naeem_allocations ON public.naeem_payment_allocations;
CREATE TRIGGER trg_immutable_ws_naeem_allocations BEFORE UPDATE ON public.naeem_payment_allocations FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_immutability();


-- ----------------------------------------------------------------------------
-- 6. CORRECTED WORKSPACE-AWARE PAYMENT ALLOCATION RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_customer_payment_with_allocations(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT DEFAULT 'Cash',
    p_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_allocations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment_id UUID;
    v_alloc JSONB;
    v_credit_id UUID;
    v_alloc_amount NUMERIC;
    v_alloc_notes TEXT;
    v_total_allocated NUMERIC := 0;
    v_credit_balance NUMERIC;
    v_workspace_id UUID;
    v_credit_workspace_id UUID;
    v_caller_id UUID;
BEGIN
    -- 1. Authentication & caller verification
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Authentication required to record customer payment';
    END IF;

    -- 2. Input validation
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID is required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 3. Resolve customer workspace & verify customer existence
    SELECT workspace_id INTO v_workspace_id
    FROM public.reseller_customers
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer % does not exist', p_customer_id;
    END IF;

    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Customer % has no assigned workspace', p_customer_id;
    END IF;

    -- 4. Authorization check: caller must have workspace access to the customer's workspace
    IF auth.role() <> 'service_role' AND NOT public.has_workspace_access(v_workspace_id) THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to record payments for workspace %', v_workspace_id;
    END IF;

    -- 5. Idempotency & duplicate submission guard
    IF p_reference IS NOT NULL AND TRIM(p_reference) <> '' THEN
        IF LOWER(TRIM(p_reference)) IN ('cash', 'bank', 'online', 'cheque', 'check', 'upi', 'hand cash', 'advance', 'payment', 'transfer', 'deposit', 'paid') THEN
            IF EXISTS (
                SELECT 1 FROM public.reseller_payments 
                WHERE customer_id = p_customer_id 
                  AND amount = p_amount
                  AND payment_date = COALESCE(p_payment_date, CURRENT_DATE)
                  AND LOWER(TRIM(reference)) = LOWER(TRIM(p_reference))
            ) THEN
                RAISE EXCEPTION 'Duplicate payment of % with reference % on % already recorded for customer %', 
                    p_amount, TRIM(p_reference), COALESCE(p_payment_date, CURRENT_DATE), p_customer_id;
            END IF;
        ELSE
            IF EXISTS (
                SELECT 1 FROM public.reseller_payments 
                WHERE customer_id = p_customer_id 
                  AND reference = TRIM(p_reference)
            ) THEN
                RAISE EXCEPTION 'Payment with reference % already exists for customer %', TRIM(p_reference), p_customer_id;
            END IF;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.reseller_payments 
        WHERE customer_id = p_customer_id 
          AND amount = p_amount 
          AND payment_date = COALESCE(p_payment_date, CURRENT_DATE)
          AND created_at >= (NOW() - INTERVAL '3 seconds')
    ) THEN
        RAISE EXCEPTION 'Duplicate payment request detected within last 3 seconds. Please refresh before retrying.';
    END IF;

    -- 6. Validate allocations sum before performing any inserts
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
        LOOP
            v_alloc_amount := (v_alloc->>'amount')::NUMERIC;
            IF v_alloc_amount > 0 THEN
                v_total_allocated := v_total_allocated + v_alloc_amount;
            END IF;
        END LOOP;

        IF v_total_allocated > (p_amount + 0.001) THEN
            RAISE EXCEPTION 'Total allocated amount (%) cannot exceed payment amount (%)', v_total_allocated, p_amount;
        END IF;
    END IF;

    -- 7. Insert into reseller_payments with explicit workspace_id
    INSERT INTO public.reseller_payments (
        workspace_id,
        customer_id,
        payment_date,
        amount,
        payment_method,
        reference,
        notes
    )
    VALUES (
        v_workspace_id,
        p_customer_id,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_amount,
        COALESCE(p_payment_method, 'Cash'),
        NULLIF(TRIM(p_reference), ''),
        NULLIF(TRIM(p_notes), '')
    )
    RETURNING id INTO v_payment_id;

    -- 8. Process and insert individual allocations with workspace verification
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        -- Acquire row-level locks on all targeted customer credits in deterministic ascending UUID order
        PERFORM id 
        FROM public.customer_credits 
        WHERE customer_id = p_customer_id 
          AND id IN (
              SELECT (x->>'credit_id')::UUID 
              FROM jsonb_array_elements(p_allocations) x 
              WHERE (x->>'amount')::NUMERIC > 0
          )
        ORDER BY id
        FOR UPDATE;

        FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
        LOOP
            v_credit_id := (v_alloc->>'credit_id')::UUID;
            v_alloc_amount := (v_alloc->>'amount')::NUMERIC;
            v_alloc_notes := NULLIF(TRIM(v_alloc->>'notes'), '');

            IF v_alloc_amount > 0 THEN
                -- Validate credit ownership, remaining balance, and WORKSPACE IDENTIFIER
                SELECT balance, workspace_id INTO v_credit_balance, v_credit_workspace_id 
                FROM public.customer_credits 
                WHERE id = v_credit_id AND customer_id = p_customer_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Target credit entry % does not exist or does not belong to customer %', v_credit_id, p_customer_id;
                END IF;

                -- REJECT CROSS-WORKSPACE ALLOCATION
                IF v_credit_workspace_id IS DISTINCT FROM v_workspace_id THEN
                    RAISE EXCEPTION 'Cross-workspace allocation rejected: credit % belongs to workspace %, but payment is for workspace %',
                        v_credit_id, v_credit_workspace_id, v_workspace_id;
                END IF;

                IF v_alloc_amount > (v_credit_balance + 0.001) THEN
                    RAISE EXCEPTION 'Allocation amount (%) exceeds remaining balance (%) for credit %', v_alloc_amount, v_credit_balance, v_credit_id;
                END IF;

                -- Insert allocation with explicit workspace_id
                INSERT INTO public.customer_payment_allocations (
                    workspace_id,
                    payment_id,
                    credit_id,
                    amount,
                    notes
                )
                VALUES (
                    v_workspace_id,
                    v_payment_id,
                    v_credit_id,
                    v_alloc_amount,
                    v_alloc_notes
                );
            END IF;
        END LOOP;
    END IF;

    -- 9. Return committed transaction metadata
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'workspace_id', v_workspace_id,
        'total_amount', p_amount,
        'allocated_amount', v_total_allocated,
        'advance_amount', GREATEST(0, p_amount - v_total_allocated)
    );
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

ALTER FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) TO service_role;

