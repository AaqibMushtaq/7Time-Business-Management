-- Migration: 20261103180000_personal_ledger_and_qarz_hasana.sql
-- Description: Additive standalone Personal Ledger and Qarz-e-Hasana (قرضِ حسنہ) schema.
-- Strict Multi-Account Isolation, User Scoping, and Row Level Security.
-- Status: PREPARED FOR REVIEW (PENDING USER AUTHORIZATION BEFORE APPLYING TO PRODUCTION)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 0. Dependency: Module Entitlement Verification Function (Idempotent)
-- Ensures has_module_access exists even if prior migration wasn't executed
-- ============================================================================
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
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_module_entitlements'
    ) THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_module_entitlements
            WHERE user_id = v_user_id
              AND module_id = p_module_key
              AND is_enabled = true
        ) INTO v_has_entitlement;
        RETURN v_has_entitlement;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION public.has_module_access(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_module_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_access(text) TO authenticated, service_role;

-- ============================================================================
-- 1. Table: personal_transactions
-- Independent personal income, expense, and transfer records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.personal_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    particulars TEXT NOT NULL,
    account TEXT NOT NULL DEFAULT 'Cash',
    to_account TEXT,
    linked_transaction_id UUID REFERENCES public.personal_transactions(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_personal_transfer_accounts CHECK (
        entry_type != 'TRANSFER' OR (to_account IS NOT NULL AND length(trim(to_account)) > 0)
    ),
    CONSTRAINT chk_personal_transfer_diff_accounts CHECK (
        entry_type != 'TRANSFER' OR account != to_account
    )
);

CREATE INDEX IF NOT EXISTS idx_personal_tx_workspace_id ON public.personal_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_tx_user_id ON public.personal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_tx_date ON public.personal_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_personal_tx_type ON public.personal_transactions(entry_type);
CREATE INDEX IF NOT EXISTS idx_personal_tx_linked ON public.personal_transactions(linked_transaction_id);

-- ============================================================================
-- 2. Table: personal_qarz_entries
-- Dedicated Qarz-e-Hasana (interest-free loans) Given & Received
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.personal_qarz_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL CHECK (length(trim(person_name)) > 0),
    direction TEXT NOT NULL CHECK (direction IN ('GIVEN', 'RECEIVED')),
    original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount > 0),
    amount_repaid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_repaid >= 0),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account TEXT NOT NULL DEFAULT 'Cash',
    due_date DATE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'OUTSTANDING' CHECK (status IN ('OUTSTANDING', 'PARTIALLY_REPAID', 'FULLY_SETTLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_qarz_workspace_id ON public.personal_qarz_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_qarz_user_id ON public.personal_qarz_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_qarz_direction ON public.personal_qarz_entries(direction);
CREATE INDEX IF NOT EXISTS idx_personal_qarz_status ON public.personal_qarz_entries(status);
CREATE INDEX IF NOT EXISTS idx_personal_qarz_date ON public.personal_qarz_entries(transaction_date);

-- ============================================================================
-- 3. Table: personal_qarz_repayments
-- Immutable individual repayment events linked to parent Qarz entry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.personal_qarz_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qarz_entry_id UUID NOT NULL REFERENCES public.personal_qarz_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_account TEXT NOT NULL DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_repay_qarz_id ON public.personal_qarz_repayments(qarz_entry_id);
CREATE INDEX IF NOT EXISTS idx_personal_repay_workspace_id ON public.personal_qarz_repayments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_repay_user_id ON public.personal_qarz_repayments(user_id);

-- ============================================================================
-- 4. Triggers & Functions: Automated balance and settlement calculation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_personal_qarz_defaults()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.amount_repaid IS NULL THEN
        NEW.amount_repaid := 0;
    END IF;
    NEW.balance := GREATEST(0, NEW.original_amount - NEW.amount_repaid);
    NEW.status := CASE 
        WHEN NEW.amount_repaid >= NEW.original_amount THEN 'FULLY_SETTLED'
        WHEN NEW.amount_repaid > 0 THEN 'PARTIALLY_REPAID'
        ELSE 'OUTSTANDING'
    END;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_personal_qarz_defaults() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_personal_qarz_defaults() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_personal_qarz_defaults() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_personal_qarz_defaults ON public.personal_qarz_entries;
CREATE TRIGGER trg_personal_qarz_defaults
BEFORE INSERT OR UPDATE ON public.personal_qarz_entries
FOR EACH ROW EXECUTE FUNCTION public.set_personal_qarz_defaults();

CREATE OR REPLACE FUNCTION public.sync_personal_qarz_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_qarz_id UUID;
    v_total_repaid NUMERIC(12, 2);
    v_original NUMERIC(12, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_qarz_id := OLD.qarz_entry_id;
    ELSE
        v_qarz_id := NEW.qarz_entry_id;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_repaid
    FROM public.personal_qarz_repayments
    WHERE qarz_entry_id = v_qarz_id;

    SELECT original_amount INTO v_original
    FROM public.personal_qarz_entries
    WHERE id = v_qarz_id;

    IF v_original IS NOT NULL THEN
        UPDATE public.personal_qarz_entries
        SET 
            amount_repaid = v_total_repaid,
            balance = GREATEST(0, v_original - v_total_repaid),
            status = CASE 
                WHEN v_total_repaid >= v_original THEN 'FULLY_SETTLED'
                WHEN v_total_repaid > 0 THEN 'PARTIALLY_REPAID'
                ELSE 'OUTSTANDING'
            END,
            updated_at = NOW()
        WHERE id = v_qarz_id;
    END IF;

    RETURN NULL;
END;
$$;

ALTER FUNCTION public.sync_personal_qarz_balance() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_personal_qarz_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_personal_qarz_balance() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_sync_personal_qarz_balance ON public.personal_qarz_repayments;
CREATE TRIGGER trg_sync_personal_qarz_balance
AFTER INSERT OR UPDATE OR DELETE ON public.personal_qarz_repayments
FOR EACH ROW EXECUTE FUNCTION public.sync_personal_qarz_balance();

-- ============================================================================
-- 5. Row Level Security: Multi-Account Personal Isolation & Entitlement
-- Strictly enforces:
-- 1. user_id = auth.uid()
-- 2. public.has_workspace_access(workspace_id)
-- 3. public.has_module_access('personal_ledger')
-- 4. Inactive/disabled entitlement immediately blocks access
-- ============================================================================
ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_qarz_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_qarz_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_transactions_isolation" ON public.personal_transactions;
DROP POLICY IF EXISTS "Users can only access personal_transactions in their personal workspace" ON public.personal_transactions;
CREATE POLICY "personal_transactions_isolation"
ON public.personal_transactions
FOR ALL
TO authenticated
USING (
    user_id = auth.uid()
    AND public.has_workspace_access(workspace_id)
    AND public.has_module_access('personal_ledger')
)
WITH CHECK (
    user_id = auth.uid()
    AND public.has_workspace_access(workspace_id)
    AND public.has_module_access('personal_ledger')
);

DROP POLICY IF EXISTS "personal_qarz_entries_isolation" ON public.personal_qarz_entries;
DROP POLICY IF EXISTS "Users can only access personal_qarz_entries in their personal workspace" ON public.personal_qarz_entries;
CREATE POLICY "personal_qarz_entries_isolation"
ON public.personal_qarz_entries
FOR ALL
TO authenticated
USING (
    user_id = auth.uid()
    AND public.has_workspace_access(workspace_id)
    AND public.has_module_access('personal_ledger')
)
WITH CHECK (
    user_id = auth.uid()
    AND public.has_workspace_access(workspace_id)
    AND public.has_module_access('personal_ledger')
);

DROP POLICY IF EXISTS "personal_qarz_repayments_isolation" ON public.personal_qarz_repayments;
DROP POLICY IF EXISTS "Users can only access personal_qarz_repayments in their personal workspace" ON public.personal_qarz_repayments;
CREATE POLICY "personal_qarz_repayments_isolation"
ON public.personal_qarz_repayments
FOR ALL
TO authenticated
USING (
    user_id = auth.uid()
    AND public.has_workspace_access(workspace_id)
    AND public.has_module_access('personal_ledger')
)
WITH CHECK (
    user_id = auth.uid()
    AND public.has_workspace_access(workspace_id)
    AND public.has_module_access('personal_ledger')
);

-- ============================================================================
-- 6. Atomic RPC: create_personal_transfer
-- Enforces:
-- - Double-entry linked records: source debit & destination credit
-- - Prevents same-account transfer
-- - Checks module entitlement and workspace access
-- - Atomic transaction guarantees zero partial transfers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_personal_transfer(
    p_workspace_id UUID,
    p_amount NUMERIC,
    p_date DATE,
    p_from_account TEXT,
    p_to_account TEXT,
    p_particulars TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_debit_id UUID;
    v_credit_id UUID;
    v_part TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT public.has_workspace_access(p_workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: Inactive or missing workspace membership.';
    END IF;

    IF NOT public.has_module_access('personal_ledger') THEN
        RAISE EXCEPTION 'Personal Ledger module is disabled for this account.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be greater than zero.';
    END IF;

    IF TRIM(p_from_account) = TRIM(p_to_account) THEN
        RAISE EXCEPTION 'Source and destination accounts must be different.';
    END IF;

    v_part := COALESCE(NULLIF(TRIM(p_particulars), ''), 'Transfer from ' || TRIM(p_from_account) || ' to ' || TRIM(p_to_account));

    -- 1. Insert source debit (outflow from source account)
    INSERT INTO public.personal_transactions (
        user_id, workspace_id, entry_type, amount, transaction_date,
        category, particulars, account, to_account, notes
    ) VALUES (
        v_user_id, p_workspace_id, 'TRANSFER', p_amount, COALESCE(p_date, CURRENT_DATE),
        'Transfer', v_part, TRIM(p_from_account), TRIM(p_to_account), p_notes
    )
    RETURNING id INTO v_debit_id;

    -- 2. Insert destination credit (inflow to destination account) linked to debit
    INSERT INTO public.personal_transactions (
        user_id, workspace_id, entry_type, amount, transaction_date,
        category, particulars, account, to_account, linked_transaction_id, notes
    ) VALUES (
        v_user_id, p_workspace_id, 'TRANSFER', p_amount, COALESCE(p_date, CURRENT_DATE),
        'Transfer', v_part, TRIM(p_to_account), TRIM(p_from_account), v_debit_id, p_notes
    )
    RETURNING id INTO v_credit_id;

    -- 3. Link source debit back to credit
    UPDATE public.personal_transactions
    SET linked_transaction_id = v_credit_id
    WHERE id = v_debit_id;

    RETURN jsonb_build_object(
        'debit_id', v_debit_id,
        'credit_id', v_credit_id,
        'amount', p_amount,
        'from_account', TRIM(p_from_account),
        'to_account', TRIM(p_to_account),
        'date', COALESCE(p_date, CURRENT_DATE)
    );
END;
$$;

ALTER FUNCTION public.create_personal_transfer(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_personal_transfer(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_personal_transfer(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 7. Atomic RPC: record_personal_qarz_repayment
-- Enforces:
-- - Row lock FOR UPDATE on the qarz entry (concurrency protection)
-- - Ownership and workspace verification
-- - Module entitlement check (has_module_access('personal_ledger'))
-- - Over-repayment prevention (amount <= balance)
-- - Positive amount check (amount > 0)
-- - Atomic repayment insert + balance/status recalculation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_personal_qarz_repayment(
    p_qarz_id UUID,
    p_amount NUMERIC,
    p_repayment_date DATE,
    p_payment_account TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_qarz public.personal_qarz_entries%ROWTYPE;
    v_repay_id UUID;
    v_new_repaid NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_new_status TEXT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to record Qarz repayments.';
    END IF;

    IF NOT public.has_module_access('personal_ledger') THEN
        RAISE EXCEPTION 'Personal Ledger module is disabled for this account.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Repayment amount must be greater than zero.';
    END IF;

    -- Lock the target Qarz row FOR UPDATE to prevent race conditions & duplicate repayments
    SELECT * INTO v_qarz
    FROM public.personal_qarz_entries
    WHERE id = p_qarz_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Qarz entry not found.';
    END IF;

    IF v_qarz.user_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this Qarz entry.';
    END IF;

    IF NOT public.has_workspace_access(v_qarz.workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: Inactive or missing workspace membership.';
    END IF;

    IF p_amount > v_qarz.balance THEN
        RAISE EXCEPTION 'Repayment amount (₹%) exceeds outstanding loan balance (₹%).', p_amount, v_qarz.balance;
    END IF;

    -- Insert the repayment event
    INSERT INTO public.personal_qarz_repayments (
        qarz_entry_id, user_id, workspace_id, amount, repayment_date, payment_account, notes
    ) VALUES (
        p_qarz_id, v_user_id, v_qarz.workspace_id, p_amount, COALESCE(p_repayment_date, CURRENT_DATE), COALESCE(p_payment_account, 'Cash'), p_notes
    )
    RETURNING id INTO v_repay_id;

    -- Compute new state (the trigger will also sync the table row)
    v_new_repaid := v_qarz.amount_repaid + p_amount;
    v_new_balance := GREATEST(0, v_qarz.original_amount - v_new_repaid);
    v_new_status := CASE
        WHEN v_new_balance = 0 THEN 'FULLY_SETTLED'
        WHEN v_new_repaid > 0 THEN 'PARTIALLY_REPAID'
        ELSE 'OUTSTANDING'
    END;

    v_result := jsonb_build_object(
        'id', v_repay_id,
        'qarz_entry_id', p_qarz_id,
        'amount', p_amount,
        'repayment_date', COALESCE(p_repayment_date, CURRENT_DATE),
        'payment_account', COALESCE(p_payment_account, 'Cash'),
        'new_amount_repaid', v_new_repaid,
        'new_balance', v_new_balance,
        'new_status', v_new_status
    );

    RETURN v_result;
END;
$$;

ALTER FUNCTION public.record_personal_qarz_repayment(UUID, NUMERIC, DATE, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_personal_qarz_repayment(UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_personal_qarz_repayment(UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 8. Idempotent Data Backfill: Historical Personal Cash Loans & Allocations
-- Preserves original UUIDs, historical dates, and repayment records.
-- ============================================================================
INSERT INTO public.personal_qarz_entries (
    id, user_id, workspace_id, person_name, direction,
    original_amount, amount_repaid, balance, transaction_date,
    account, status, notes, created_at, updated_at
)
SELECT 
    c.id,
    COALESCE(w.owner_id, (SELECT id FROM public.profiles WHERE system_role = 'SUPER_ADMIN' LIMIT 1)),
    c.workspace_id,
    r.name,
    'GIVEN',
    c.total_amount,
    COALESCE(c.amount_paid, 0),
    COALESCE(c.balance, c.total_amount),
    c.entry_date,
    COALESCE(c.funding_source, 'Cash'),
    CASE 
        WHEN c.balance <= 0 THEN 'FULLY_SETTLED'
        WHEN c.amount_paid > 0 THEN 'PARTIALLY_REPAID'
        ELSE 'OUTSTANDING'
    END,
    c.notes,
    c.created_at,
    c.updated_at
FROM public.customer_credits c
JOIN public.reseller_customers r ON c.customer_id = r.id
LEFT JOIN public.workspaces w ON c.workspace_id = w.id
WHERE r.contact_type = 'PERSONAL'
  AND c.entry_type = 'CASH_LOAN'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.personal_qarz_repayments (
    id, qarz_entry_id, user_id, workspace_id,
    amount, repayment_date, payment_account, notes, created_at
)
SELECT
    a.id,
    a.credit_id,
    COALESCE(w.owner_id, (SELECT id FROM public.profiles WHERE system_role = 'SUPER_ADMIN' LIMIT 1)),
    a.workspace_id,
    a.amount,
    COALESCE(p.payment_date, CURRENT_DATE),
    COALESCE(p.payment_method, 'Cash'),
    a.notes,
    a.created_at
FROM public.customer_payment_allocations a
JOIN public.customer_credits c ON a.credit_id = c.id
JOIN public.reseller_customers r ON c.customer_id = r.id
LEFT JOIN public.reseller_payments p ON a.payment_id = p.id
LEFT JOIN public.workspaces w ON a.workspace_id = w.id
WHERE r.contact_type = 'PERSONAL'
  AND c.entry_type = 'CASH_LOAN'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. Register Migration in Supabase Schema Migrations History
-- ============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261103180000', 'personal_ledger_and_qarz_hasana')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
