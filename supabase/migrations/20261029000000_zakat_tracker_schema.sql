-- ============================================================================
-- MIGRATION: 20261029000000_zakat_tracker_schema.sql
-- Module: 7TIME Zakat Tracker (Hanafi Fiqh Wealth Ledger & Metal Rates)
-- Safety: Additive DDL with defensive pre-flight validation.
--         Guarantees atomic paired conversions, strict ledger immutability,
--         reciprocal cross-link integrity, and double-entry conservation of wealth.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. DEFENSIVE PRE-FLIGHT VALIDATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Precondition 1: Ensure required authentication schema exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: auth.users table not found. Supabase Auth required.';
    END IF;

    -- Precondition 2: Ensure audit logging trigger function exists from prior migrations
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace 
        WHERE pg_namespace.nspname = 'public' AND proname = 'log_audit_event'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: public.log_audit_event() function not found. Verify migration 20261019152000.';
    END IF;

    -- Precondition 3: Check for existing conflicting tables with unexpected schemas
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'zakat_wealth_entries'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'zakat_wealth_entries' 
              AND column_name = 'correction_of_entry_id'
        ) THEN
            RAISE EXCEPTION 'Precondition Failed: public.zakat_wealth_entries exists but lacks correction_of_entry_id column. Manual schema reconciliation required.';
        END IF;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. TABLE: zakat_daily_metal_rates (Shared Rates Cache)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zakat_daily_metal_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date DATE NOT NULL,
    metal TEXT NOT NULL CHECK (metal IN ('GOLD', 'SILVER')),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    rate_per_gram_24k NUMERIC(12, 4) NOT NULL CHECK (rate_per_gram_24k > 0),
    rate_per_gram_22k NUMERIC(12, 4) DEFAULT NULL CHECK (rate_per_gram_22k IS NULL OR rate_per_gram_22k > 0),
    rate_per_gram_18k NUMERIC(12, 4) DEFAULT NULL CHECK (rate_per_gram_18k IS NULL OR rate_per_gram_18k > 0),
    source_status TEXT NOT NULL DEFAULT 'LIVE' CHECK (source_status IN ('LIVE', 'STALE', 'MANUAL', 'UNAVAILABLE')),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider TEXT NOT NULL DEFAULT 'GoldAPI.io',
    CONSTRAINT uq_zakat_daily_metal_rates UNIQUE (rate_date, metal)
);

CREATE INDEX IF NOT EXISTS idx_zakat_daily_metal_rates_lookup 
    ON public.zakat_daily_metal_rates(rate_date, metal);

-- ----------------------------------------------------------------------------
-- 2. TABLE: zakat_metal_rate_snapshots (Internal Provider Audit Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zakat_metal_rate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date DATE NOT NULL,
    metal TEXT NOT NULL CHECK (metal IN ('GOLD', 'SILVER')),
    currency TEXT NOT NULL CHECK (currency = 'INR'),
    price_gram_24k NUMERIC(12, 4) NOT NULL CHECK (price_gram_24k > 0),
    price_gram_22k NUMERIC(12, 4) DEFAULT NULL CHECK (price_gram_22k IS NULL OR price_gram_22k > 0),
    price_gram_18k NUMERIC(12, 4) DEFAULT NULL CHECK (price_gram_18k IS NULL OR price_gram_18k > 0),
    exchange TEXT NOT NULL,
    provider_timestamp BIGINT NOT NULL,
    http_status_code INTEGER NOT NULL CHECK (http_status_code BETWEEN 200 AND 299),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. TABLE: zakat_user_settings (User Configuration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zakat_user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_nisab_standard TEXT NOT NULL DEFAULT 'SILVER' CHECK (preferred_nisab_standard IN ('SILVER', 'GOLD')),
    silver_nisab_grams NUMERIC(8, 2) NOT NULL DEFAULT 612.36 CHECK (silver_nisab_grams > 0),
    gold_nisab_grams NUMERIC(8, 2) NOT NULL DEFAULT 87.48 CHECK (gold_nisab_grams > 0),
    hijri_day_offset INTEGER NOT NULL DEFAULT 0 CHECK (hijri_day_offset BETWEEN -2 AND 2),
    custom_hawl_start_date DATE DEFAULT NULL,
    is_hawl_start_date_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. TABLE: zakat_hawl_records (Hawl Lifecycle History)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zakat_hawl_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hawl_start_date DATE NOT NULL,
    hawl_anniversary_date DATE NOT NULL,
    hijri_start_year INTEGER NOT NULL,
    hijri_start_month INTEGER NOT NULL,
    hijri_start_day INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'BELOW_NISAB', 'INSUFFICIENT_DATA', 'PROVISIONAL_TRACKING',
            'HAWL_IN_PROGRESS', 'HAWL_COMPLETED_DUE', 'HAWL_COMPLETED_EXEMPT',
            'ZERO_RESET'
        )
    ),
    is_confirmed BOOLEAN NOT NULL DEFAULT false,
    net_wealth_at_start NUMERIC(15, 2) NOT NULL,
    net_wealth_at_anniversary NUMERIC(15, 2) DEFAULT NULL,
    zakat_due_inr NUMERIC(15, 2) DEFAULT NULL,
    zakat_paid_inr NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zakat_hawl_records_user 
    ON public.zakat_hawl_records(user_id, hawl_start_date);

-- ----------------------------------------------------------------------------
-- 5. TABLE: zakat_wealth_entries (Ledger Table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zakat_wealth_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    entry_type TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT NOT NULL,
    amount_inr NUMERIC(15, 2) NOT NULL,
    quantity NUMERIC(12, 4) DEFAULT NULL,
    purity_carat NUMERIC(4, 2) DEFAULT NULL,
    linked_entry_id UUID DEFAULT NULL,
    description TEXT NOT NULL,
    notes TEXT DEFAULT NULL,
    correction_of_entry_id UUID DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred foreign key for paired conversion symmetry (evaluated at COMMIT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_zakat_wealth_entries_linked_entry'
    ) THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT fk_zakat_wealth_entries_linked_entry
            FOREIGN KEY (linked_entry_id)
            REFERENCES public.zakat_wealth_entries(id)
            ON DELETE NO ACTION
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- Foreign key for correction audit provenance (RESTRICT prevents deleting corrected entry)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_zakat_wealth_entries_correction_of'
    ) THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT fk_zakat_wealth_entries_correction_of
            FOREIGN KEY (correction_of_entry_id)
            REFERENCES public.zakat_wealth_entries(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- Check Constraints on zakat_wealth_entries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_nonzero_amount_inr') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_nonzero_amount_inr CHECK (amount_inr != 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_ordinary_entries') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_positive_ordinary_entries 
            CHECK (entry_type IN ('CONVERSION', 'CORRECTION') OR amount_inr > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversion_link_presence') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_conversion_link_presence 
            CHECK (
                (entry_type = 'CONVERSION' AND linked_entry_id IS NOT NULL) OR
                (entry_type != 'CONVERSION' AND linked_entry_id IS NULL)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_zakat_wealth_entry_type') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_zakat_wealth_entry_type 
            CHECK (
                entry_type IN (
                    'ACQUIRED', 'CONVERSION', 'VALUATION_ADJUSTMENT',
                    'LIABILITY_INCURRED', 'LIABILITY_SETTLED',
                    'EXPENSE', 'CORRECTION'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_zakat_wealth_category') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_zakat_wealth_category 
            CHECK (
                category IN (
                    'CASH', 'BANK', 'DIGITAL_WALLET', 'GOLD', 'SILVER',
                    'BUSINESS_INVENTORY', 'INVESTMENTS',
                    'RECEIVABLES_STRONG', 'RECEIVABLES_DOUBTFUL',
                    'LIABILITIES_IMMEDIATE', 'LIABILITIES_LONG_TERM',
                    'PERSONAL_EXPENSE', 'OTHER_ASSET'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversion_category_allowlist') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_conversion_category_allowlist 
            CHECK (
                entry_type != 'CONVERSION' OR
                category IN (
                    'CASH', 'BANK', 'DIGITAL_WALLET', 'GOLD', 'SILVER',
                    'BUSINESS_INVENTORY', 'INVESTMENTS',
                    'RECEIVABLES_STRONG', 'OTHER_ASSET'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_metal_fields_category_gate') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_metal_fields_category_gate 
            CHECK (
                category IN ('GOLD', 'SILVER') OR 
                (quantity IS NULL AND purity_carat IS NULL)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_purity_carat') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_valid_purity_carat 
            CHECK (
                purity_carat IS NULL OR 
                (purity_carat >= 1.0 AND purity_carat <= 24.0)
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_nonzero_quantity') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_nonzero_quantity 
            CHECK (quantity IS NULL OR quantity != 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_correction_requires_reason') THEN
        ALTER TABLE public.zakat_wealth_entries
            ADD CONSTRAINT chk_correction_requires_reason 
            CHECK (
                entry_type != 'CORRECTION' OR 
                (description IS NOT NULL AND length(trim(description)) >= 5)
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_zakat_wealth_entries_user_date 
    ON public.zakat_wealth_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_zakat_wealth_entries_linked 
    ON public.zakat_wealth_entries(linked_entry_id);
CREATE INDEX IF NOT EXISTS idx_zakat_wealth_entries_correction 
    ON public.zakat_wealth_entries(correction_of_entry_id);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS: Ledger Immutability & Conversion Pair Integrity
-- ----------------------------------------------------------------------------

-- A. protect_zakat_ledger_history() (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.protect_zakat_ledger_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_user_id UUID;
BEGIN
    -- Detect any attempt to alter financial, structural, or ownership fields
    IF OLD.amount_inr IS DISTINCT FROM NEW.amount_inr
       OR OLD.entry_date IS DISTINCT FROM NEW.entry_date
       OR OLD.category IS DISTINCT FROM NEW.category
       OR OLD.entry_type IS DISTINCT FROM NEW.entry_type
       OR OLD.quantity IS DISTINCT FROM NEW.quantity
       OR OLD.purity_carat IS DISTINCT FROM NEW.purity_carat
       OR OLD.linked_entry_id IS DISTINCT FROM NEW.linked_entry_id
       OR OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.correction_of_entry_id IS DISTINCT FROM NEW.correction_of_entry_id
    THEN
        RAISE EXCEPTION 'Financial ledger fields are strictly immutable. Post a CORRECTION entry for ledger adjustments.'
            USING ERRCODE = 'restrict_violation';
    END IF;

    -- Validate same-user boundary on correction reference
    IF NEW.correction_of_entry_id IS NOT NULL THEN
        SELECT user_id INTO v_parent_user_id 
        FROM public.zakat_wealth_entries 
        WHERE id = NEW.correction_of_entry_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target corrected entry % does not exist', NEW.correction_of_entry_id;
        END IF;

        IF v_parent_user_id != NEW.user_id THEN
            RAISE EXCEPTION 'Cross-user correction prohibited: entry % belongs to another user', NEW.correction_of_entry_id;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_zakat_ledger_history ON public.zakat_wealth_entries;
CREATE TRIGGER trg_protect_zakat_ledger_history
BEFORE UPDATE ON public.zakat_wealth_entries
FOR EACH ROW
EXECUTE FUNCTION public.protect_zakat_ledger_history();

-- B. check_zakat_conversion_pair_integrity() (AFTER INSERT OR UPDATE, DEFERRED)
CREATE OR REPLACE FUNCTION public.check_zakat_conversion_pair_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_linked RECORD;
BEGIN
    IF NEW.entry_type = 'CONVERSION' THEN
        SELECT * INTO v_linked
        FROM public.zakat_wealth_entries
        WHERE id = NEW.linked_entry_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Conversion entry % references nonexistent linked_entry_id %', 
                NEW.id, NEW.linked_entry_id;
        END IF;

        IF v_linked.entry_type != 'CONVERSION' THEN
            RAISE EXCEPTION 'Conversion entry % is linked to non-conversion entry % (type: %)', 
                NEW.id, v_linked.id, v_linked.entry_type;
        END IF;

        IF v_linked.user_id != NEW.user_id THEN
            RAISE EXCEPTION 'Cross-user conversion pair prohibited: entry % (user %) -> entry % (user %)',
                NEW.id, NEW.user_id, v_linked.id, v_linked.user_id;
        END IF;

        IF v_linked.linked_entry_id != NEW.id THEN
            RAISE EXCEPTION 'Asymmetric conversion link: entry % points to %, but % points to %',
                NEW.id, NEW.linked_entry_id, v_linked.id, v_linked.linked_entry_id;
        END IF;

        IF round(NEW.amount_inr + v_linked.amount_inr, 2) != 0.00 THEN
            RAISE EXCEPTION 'Conversion monetary imbalance: leg % (%) and leg % (%) do not sum to 0',
                NEW.id, NEW.amount_inr, v_linked.id, v_linked.amount_inr;
        END IF;

        IF NEW.entry_date != v_linked.entry_date THEN
            RAISE EXCEPTION 'Conversion date mismatch: leg % date (%) != leg % date (%)',
                NEW.id, NEW.entry_date, v_linked.id, v_linked.entry_date;
        END IF;

        IF NEW.category = v_linked.category THEN
            RAISE EXCEPTION 'Conversion category circularity: source and destination categories are identical (%)',
                NEW.category;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_zakat_conversion_pair_integrity ON public.zakat_wealth_entries;
CREATE CONSTRAINT TRIGGER trg_check_zakat_conversion_pair_integrity
AFTER INSERT OR UPDATE ON public.zakat_wealth_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.check_zakat_conversion_pair_integrity();

-- C. Attach existing audit log trigger
DROP TRIGGER IF EXISTS trg_audit_zakat_wealth_entries ON public.zakat_wealth_entries;
CREATE TRIGGER trg_audit_zakat_wealth_entries
AFTER INSERT OR UPDATE OR DELETE ON public.zakat_wealth_entries
FOR EACH ROW
EXECUTE FUNCTION public.log_audit_event();

-- ----------------------------------------------------------------------------
-- 7. PRIVILEGED FUNCTIONS (RPCs)
-- ----------------------------------------------------------------------------

-- A. create_zakat_paired_conversion
CREATE OR REPLACE FUNCTION public.create_zakat_paired_conversion(
    p_date DATE,
    p_source_category TEXT,
    p_dest_category TEXT,
    p_amount_inr NUMERIC,
    p_source TEXT DEFAULT 'Asset Conversion',
    p_description TEXT DEFAULT 'Asset Conversion',
    p_source_quantity NUMERIC DEFAULT NULL,
    p_source_purity_carat NUMERIC DEFAULT NULL,
    p_dest_quantity NUMERIC DEFAULT NULL,
    p_dest_purity_carat NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_source_id UUID := gen_random_uuid();
    v_dest_id UUID := gen_random_uuid();
    v_abs_amount NUMERIC;
BEGIN
    -- 1. Authorization check: derive user strictly from trusted auth context
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create conversion entries';
    END IF;

    -- 2. Input validation
    IF p_date IS NULL THEN
        RAISE EXCEPTION 'Conversion date is required';
    END IF;

    IF p_amount_inr IS NULL OR p_amount_inr <= 0 THEN
        RAISE EXCEPTION 'Conversion amount must be a positive number';
    END IF;
    v_abs_amount := round(p_amount_inr, 2);

    IF p_source_category = p_dest_category THEN
        RAISE EXCEPTION 'Source and destination categories must differ';
    END IF;

    -- Restrict conversion categories strictly to eligible asset pools
    IF p_source_category NOT IN (
        'CASH', 'BANK', 'DIGITAL_WALLET', 'GOLD', 'SILVER',
        'BUSINESS_INVENTORY', 'INVESTMENTS',
        'RECEIVABLES_STRONG', 'OTHER_ASSET'
    ) THEN
        RAISE EXCEPTION 'Invalid or non-convertible source category: %', p_source_category
            USING ERRCODE = 'check_violation';
    END IF;

    IF p_dest_category NOT IN (
        'CASH', 'BANK', 'DIGITAL_WALLET', 'GOLD', 'SILVER',
        'BUSINESS_INVENTORY', 'INVESTMENTS',
        'RECEIVABLES_STRONG', 'OTHER_ASSET'
    ) THEN
        RAISE EXCEPTION 'Invalid or non-convertible destination category: %', p_dest_category
            USING ERRCODE = 'check_violation';
    END IF;

    -- Metal field validation
    IF p_source_category NOT IN ('GOLD', 'SILVER') AND (p_source_quantity IS NOT NULL OR p_source_purity_carat IS NOT NULL) THEN
        RAISE EXCEPTION 'Source category % cannot carry metal quantity or purity', p_source_category;
    END IF;

    IF p_dest_category NOT IN ('GOLD', 'SILVER') AND (p_dest_quantity IS NOT NULL OR p_dest_purity_carat IS NOT NULL) THEN
        RAISE EXCEPTION 'Destination category % cannot carry metal quantity or purity', p_dest_category;
    END IF;

    IF p_source_purity_carat IS NOT NULL AND (p_source_purity_carat < 1.0 OR p_source_purity_carat > 24.0) THEN
        RAISE EXCEPTION 'Source purity carat must be between 1.0 and 24.0 (received: %)', p_source_purity_carat
            USING ERRCODE = 'check_violation';
    END IF;

    IF p_dest_purity_carat IS NOT NULL AND (p_dest_purity_carat < 1.0 OR p_dest_purity_carat > 24.0) THEN
        RAISE EXCEPTION 'Destination purity carat must be between 1.0 and 24.0 (received: %)', p_dest_purity_carat
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3. Insert Outgoing Leg (Debit)
    INSERT INTO public.zakat_wealth_entries (
        id,
        user_id,
        entry_date,
        entry_type,
        category,
        source,
        amount_inr,
        quantity,
        purity_carat,
        linked_entry_id,
        description
    ) VALUES (
        v_source_id,
        v_user_id,
        p_date,
        'CONVERSION',
        p_source_category,
        COALESCE(NULLIF(TRIM(p_source), ''), 'Asset Conversion'),
        -v_abs_amount,
        CASE WHEN p_source_quantity IS NOT NULL THEN -ABS(p_source_quantity) ELSE NULL END,
        p_source_purity_carat,
        v_dest_id,
        '[Conversion Out] ' || COALESCE(NULLIF(TRIM(p_description), ''), 'Asset Conversion')
    );

    -- 4. Insert Incoming Leg (Credit)
    INSERT INTO public.zakat_wealth_entries (
        id,
        user_id,
        entry_date,
        entry_type,
        category,
        source,
        amount_inr,
        quantity,
        purity_carat,
        linked_entry_id,
        description
    ) VALUES (
        v_dest_id,
        v_user_id,
        p_date,
        'CONVERSION',
        p_dest_category,
        COALESCE(NULLIF(TRIM(p_source), ''), 'Asset Conversion'),
        v_abs_amount,
        CASE WHEN p_dest_quantity IS NOT NULL THEN ABS(p_dest_quantity) ELSE NULL END,
        p_dest_purity_carat,
        v_source_id,
        '[Conversion In] ' || COALESCE(NULLIF(TRIM(p_description), ''), 'Asset Conversion')
    );

    RETURN jsonb_build_object(
        'source_entry_id', v_source_id,
        'dest_entry_id', v_dest_id,
        'amount_inr', v_abs_amount,
        'entry_date', p_date
    );
END;
$$;

-- B. delete_zakat_paired_conversion
CREATE OR REPLACE FUNCTION public.delete_zakat_paired_conversion(
    p_entry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_entry RECORD;
    v_linked RECORD;
BEGIN
    -- 1. Authorization check: derive user strictly from trusted auth context
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to delete conversion entries';
    END IF;

    -- 2. Fetch targeted entry
    SELECT * INTO v_entry
    FROM public.zakat_wealth_entries
    WHERE id = p_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversion entry % not found', p_entry_id;
    END IF;

    -- 3. Strict ownership check
    IF v_entry.user_id != v_user_id THEN
        RAISE EXCEPTION 'Access denied: cannot delete another user''s conversion entry';
    END IF;

    IF v_entry.entry_type != 'CONVERSION' THEN
        RAISE EXCEPTION 'Entry % is not a CONVERSION entry (type: %)', p_entry_id, v_entry.entry_type;
    END IF;

    IF v_entry.linked_entry_id IS NULL THEN
        RAISE EXCEPTION 'Conversion entry % has no linked counterpart', p_entry_id;
    END IF;

    -- 4. Fetch linked counterpart
    SELECT * INTO v_linked
    FROM public.zakat_wealth_entries
    WHERE id = v_entry.linked_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked conversion partner % not found for entry %', v_entry.linked_entry_id, p_entry_id;
    END IF;

    IF v_linked.user_id != v_user_id THEN
        RAISE EXCEPTION 'Integrity violation: linked partner % belongs to another user', v_linked.id;
    END IF;

    -- 5. Deterministic row locking in ascending UUID order to prevent deadlocks
    PERFORM id 
    FROM public.zakat_wealth_entries 
    WHERE id IN (v_entry.id, v_linked.id)
    ORDER BY id ASC
    FOR UPDATE;

    -- 6. Atomic deletion of both legs in single statement
    DELETE FROM public.zakat_wealth_entries
    WHERE id IN (v_entry.id, v_linked.id);

    RETURN jsonb_build_object(
        'deleted_entry_id', v_entry.id,
        'deleted_linked_id', v_linked.id,
        'status', 'DELETED'
    );
END;
$$;

-- Revoke all function permissions from public and anon
REVOKE ALL ON FUNCTION public.create_zakat_paired_conversion(DATE, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_zakat_paired_conversion(DATE, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_zakat_paired_conversion(DATE, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_zakat_paired_conversion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_zakat_paired_conversion(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_zakat_paired_conversion(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY & TABLE GRANTS
-- ----------------------------------------------------------------------------

-- Enable and FORCE RLS on user-facing tables (prevents owner bypass)
ALTER TABLE public.zakat_wealth_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_wealth_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.zakat_hawl_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_hawl_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.zakat_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_user_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.zakat_daily_metal_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_metal_rate_snapshots ENABLE ROW LEVEL SECURITY;

-- zakat_wealth_entries Policies
DROP POLICY IF EXISTS zakat_wealth_entries_select_policy ON public.zakat_wealth_entries;
CREATE POLICY zakat_wealth_entries_select_policy ON public.zakat_wealth_entries
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Direct client inserts cannot insert CONVERSION rows (must use RPC)
DROP POLICY IF EXISTS zakat_wealth_entries_insert_policy ON public.zakat_wealth_entries;
CREATE POLICY zakat_wealth_entries_insert_policy ON public.zakat_wealth_entries
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND entry_type != 'CONVERSION');

-- Direct client updates cannot touch CONVERSION rows
DROP POLICY IF EXISTS zakat_wealth_entries_update_policy ON public.zakat_wealth_entries;
CREATE POLICY zakat_wealth_entries_update_policy ON public.zakat_wealth_entries
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND entry_type != 'CONVERSION')
    WITH CHECK (auth.uid() = user_id AND entry_type != 'CONVERSION');

-- Direct client deletes cannot touch CONVERSION rows (must use RPC)
DROP POLICY IF EXISTS zakat_wealth_entries_delete_policy ON public.zakat_wealth_entries;
CREATE POLICY zakat_wealth_entries_delete_policy ON public.zakat_wealth_entries
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id AND entry_type != 'CONVERSION');

REVOKE ALL ON TABLE public.zakat_wealth_entries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.zakat_wealth_entries TO authenticated;
GRANT ALL ON TABLE public.zakat_wealth_entries TO service_role;

-- zakat_hawl_records Policies
DROP POLICY IF EXISTS zakat_hawl_records_user_policy ON public.zakat_hawl_records;
CREATE POLICY zakat_hawl_records_user_policy ON public.zakat_hawl_records
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.zakat_hawl_records FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.zakat_hawl_records TO authenticated;
GRANT ALL ON TABLE public.zakat_hawl_records TO service_role;

-- zakat_user_settings Policies
DROP POLICY IF EXISTS zakat_user_settings_user_policy ON public.zakat_user_settings;
CREATE POLICY zakat_user_settings_user_policy ON public.zakat_user_settings
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.zakat_user_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.zakat_user_settings TO authenticated;
GRANT ALL ON TABLE public.zakat_user_settings TO service_role;

-- zakat_daily_metal_rates Policies (Shared Read-Only Cache)
DROP POLICY IF EXISTS zakat_daily_metal_rates_select_policy ON public.zakat_daily_metal_rates;
CREATE POLICY zakat_daily_metal_rates_select_policy ON public.zakat_daily_metal_rates
    FOR SELECT TO authenticated
    USING (true);

REVOKE ALL ON TABLE public.zakat_daily_metal_rates FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.zakat_daily_metal_rates TO authenticated;
GRANT ALL ON TABLE public.zakat_daily_metal_rates TO service_role;

-- zakat_metal_rate_snapshots Lockdown (Internal Backend Audit Only)
REVOKE ALL ON TABLE public.zakat_metal_rate_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.zakat_metal_rate_snapshots TO service_role;

-- ----------------------------------------------------------------------------
-- 9. SCHEMA CACHE RELOAD NOTIFICATION
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

