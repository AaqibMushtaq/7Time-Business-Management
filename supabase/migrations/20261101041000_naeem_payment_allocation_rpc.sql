-- ============================================================================
-- MIGRATION: 20261101041000_naeem_payment_allocation_rpc.sql
-- Module: NAEEM Dedicated Delivery Manual Ledger
-- Scope: Transactional PostgreSQL RPC for atomic payment recording and
--        payment allocation replacement. Eliminates non-atomic delete-then-insert
--        sequences from client code, ensuring that failed allocation updates
--        roll back cleanly without data loss.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_naeem_payment_with_allocations(
    p_payment_id UUID DEFAULT NULL,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_amount NUMERIC DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Cash',
    p_reference_number TEXT DEFAULT NULL,
    p_cheque_number TEXT DEFAULT NULL,
    p_cheque_date DATE DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_workspace_id UUID DEFAULT NULL,
    p_allocations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_target_ws_id UUID;
    v_matched_count INTEGER := 0;
    v_target_payment_id UUID;
    v_total_allocated NUMERIC := 0;
    v_item JSONB;
    v_alloc_record_id UUID;
    v_alloc_amount NUMERIC;
    v_daily_rec_ws UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();

    -- 1. Authentication check
    IF v_user_id IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Authentication required: caller identity cannot be verified.'
            USING ERRCODE = '42501';
    END IF;

    -- Verify active profile (unless service role)
    IF v_user_id IS NOT NULL THEN
        SELECT is_active, (system_role = 'SUPER_ADMIN')
        INTO v_is_user_active, v_is_super_admin
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_is_user_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Account suspended: active account required for payment operations.'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        v_is_super_admin := true;
    END IF;

    -- 2. Input validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.'
            USING ERRCODE = '22003';
    END IF;

    IF p_payment_date IS NULL THEN
        RAISE EXCEPTION 'Payment date is required.'
            USING ERRCODE = '22004';
    END IF;

    -- 3. Workspace resolution
    IF p_payment_id IS NOT NULL THEN
        -- Case A: Updating existing payment -> Workspace is immutable
        SELECT workspace_id INTO v_target_ws_id
        FROM public.naeem_payments
        WHERE id = p_payment_id;

        IF v_target_ws_id IS NULL THEN
            RAISE EXCEPTION 'Payment % not found.', p_payment_id
                USING ERRCODE = 'P0002';
        END IF;

        IF p_workspace_id IS NOT NULL AND p_workspace_id <> v_target_ws_id THEN
            RAISE EXCEPTION 'Workspace mismatch: payment belongs to workspace %.', v_target_ws_id
                USING ERRCODE = '42501';
        END IF;
    ELSE
        -- Case B: Creating new payment
        IF p_workspace_id IS NOT NULL THEN
            SELECT id INTO v_target_ws_id
            FROM public.workspaces
            WHERE id = p_workspace_id AND is_active = true AND workspace_type = 'BUSINESS';

            IF v_target_ws_id IS NULL THEN
                RAISE EXCEPTION 'Invalid or inactive business workspace: %.', p_workspace_id
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            -- Resolve unambiguous business workspace for caller
            SELECT COUNT(DISTINCT w.id)
            INTO v_matched_count
            FROM public.workspaces w
            JOIN public.workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = v_user_id
              AND wm.is_active = true
              AND w.is_active = true
              AND w.workspace_type = 'BUSINESS';

            IF v_matched_count = 0 THEN
                RAISE EXCEPTION 'No authorized business workspace found for caller.'
                    USING ERRCODE = '42501';
            END IF;

            IF v_matched_count > 1 THEN
                RAISE EXCEPTION 'Ambiguous workspace membership: caller belongs to multiple active business workspaces. Explicit workspace_id is required.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT w.id INTO v_target_ws_id
            FROM public.workspaces w
            JOIN public.workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = v_user_id
              AND wm.is_active = true
              AND w.is_active = true
              AND w.workspace_type = 'BUSINESS'
            LIMIT 1;
        END IF;
    END IF;

    -- Verify caller membership in target workspace
    IF NOT v_is_super_admin THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = v_target_ws_id
              AND wm.user_id = v_user_id
              AND wm.is_active = true
        ) THEN
            RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of workspace %.', v_target_ws_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Pre-validate allocations before performing any mutations
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_allocations)
        LOOP
            v_alloc_record_id := NULLIF(v_item->>'daily_record_id', '')::UUID;
            v_alloc_amount := (v_item->>'allocated_amount')::NUMERIC;

            IF v_alloc_record_id IS NULL THEN
                RAISE EXCEPTION 'daily_record_id is required for every allocation.'
                    USING ERRCODE = '22004';
            END IF;

            IF v_alloc_amount IS NULL OR v_alloc_amount <= 0 THEN
                RAISE EXCEPTION 'Allocated amount must be greater than zero.'
                    USING ERRCODE = '22003';
            END IF;

            -- Check daily record exists and belongs to the same workspace
            SELECT workspace_id INTO v_daily_rec_ws
            FROM public.naeem_daily_records
            WHERE id = v_alloc_record_id;

            IF v_daily_rec_ws IS NULL THEN
                RAISE EXCEPTION 'Daily record % not found.', v_alloc_record_id
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_daily_rec_ws <> v_target_ws_id THEN
                RAISE EXCEPTION 'Cross-workspace violation: daily record % belongs to workspace %, but payment is in workspace %.',
                    v_alloc_record_id, v_daily_rec_ws, v_target_ws_id
                    USING ERRCODE = '42501';
            END IF;

            v_total_allocated := v_total_allocated + v_alloc_amount;
        END LOOP;

        IF v_total_allocated > (p_amount + 0.001) THEN
            RAISE EXCEPTION 'Total allocated amount (%) exceeds payment amount (%).', v_total_allocated, p_amount
                USING ERRCODE = '22003';
        END IF;
    END IF;

    -- 5. Atomic Execution within single transaction block
    v_target_payment_id := COALESCE(p_payment_id, gen_random_uuid());

    -- Upsert parent payment
    INSERT INTO public.naeem_payments (
        id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        cheque_number,
        cheque_date,
        bank_name,
        notes,
        workspace_id,
        updated_at
    ) VALUES (
        v_target_payment_id,
        p_payment_date,
        p_amount,
        COALESCE(p_payment_method, 'Cash'),
        NULLIF(TRIM(p_reference_number), ''),
        NULLIF(TRIM(p_cheque_number), ''),
        p_cheque_date,
        NULLIF(TRIM(p_bank_name), ''),
        NULLIF(TRIM(p_notes), ''),
        v_target_ws_id,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        payment_date = EXCLUDED.payment_date,
        amount = EXCLUDED.amount,
        payment_method = EXCLUDED.payment_method,
        reference_number = EXCLUDED.reference_number,
        cheque_number = EXCLUDED.cheque_number,
        cheque_date = EXCLUDED.cheque_date,
        bank_name = EXCLUDED.bank_name,
        notes = EXCLUDED.notes,
        updated_at = NOW();

    -- Delete stale allocations for this payment (atomic within transaction)
    DELETE FROM public.naeem_payment_allocations
    WHERE payment_id = v_target_payment_id;

    -- Insert new validated allocations
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_allocations)
        LOOP
            v_alloc_record_id := (v_item->>'daily_record_id')::UUID;
            v_alloc_amount := (v_item->>'allocated_amount')::NUMERIC;

            INSERT INTO public.naeem_payment_allocations (
                id,
                payment_id,
                daily_record_id,
                allocated_amount,
                workspace_id
            ) VALUES (
                COALESCE(NULLIF(v_item->>'id', '')::UUID, gen_random_uuid()),
                v_target_payment_id,
                v_alloc_record_id,
                v_alloc_amount,
                v_target_ws_id
            );
        END LOOP;
    END IF;

    -- Return the authoritative payment record as JSONB
    SELECT jsonb_build_object(
        'id', p.id,
        'payment_date', p.payment_date,
        'amount', p.amount,
        'payment_method', p.payment_method,
        'reference_number', p.reference_number,
        'cheque_number', p.cheque_number,
        'cheque_date', p.cheque_date,
        'bank_name', p.bank_name,
        'notes', p.notes,
        'workspace_id', p.workspace_id,
        'created_at', p.created_at,
        'updated_at', p.updated_at
    )
    INTO v_result
    FROM public.naeem_payments p
    WHERE p.id = v_target_payment_id;

    RETURN v_result;
END;
$$;

ALTER FUNCTION public.record_naeem_payment_with_allocations(
    UUID, DATE, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, UUID, JSONB
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.record_naeem_payment_with_allocations(
    UUID, DATE, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, UUID, JSONB
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_naeem_payment_with_allocations(
    UUID, DATE, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, UUID, JSONB
) TO authenticated, service_role;

