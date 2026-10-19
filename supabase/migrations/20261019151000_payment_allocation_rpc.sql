-- ============================================================================
-- MIGRATION: 20261019151000_payment_allocation_rpc.sql
-- Module: Wholesale & Personal Ledger Settlement Domain
-- Safety: Transactional PostgreSQL RPC for atomic payment recording and
--         multi-entry allocations. Guarantees complete statement-level
--         rollback if any allocation fails, eliminating orphan unallocated
--         payments and avoiding compensating deletion failure modes.
-- ============================================================================

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
SET search_path = public
AS $$
DECLARE
    v_payment_id UUID;
    v_alloc JSONB;
    v_credit_id UUID;
    v_alloc_amount NUMERIC;
    v_alloc_notes TEXT;
    v_total_allocated NUMERIC := 0;
    v_credit_balance NUMERIC;
BEGIN
    -- 1. Authentication & Authorization check
    -- Note: inside a SECURITY DEFINER function, current_user evaluates to the function owner (postgres).
    -- We verify the calling session via Supabase JWT context: auth.role() and auth.uid().
    IF auth.role() = 'anon' OR (COALESCE(auth.role(), '') <> 'service_role' AND auth.uid() IS NULL) THEN
        RAISE EXCEPTION 'Authentication required to record customer payment';
    END IF;

    -- 2. Input validation
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID is required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reseller_customers WHERE id = p_customer_id) THEN
        RAISE EXCEPTION 'Customer % does not exist', p_customer_id;
    END IF;

    -- 3. Idempotency & duplicate submission guard
    -- Differentiate unique transaction identifiers (cheques/UTRs) from generic payment method notes (e.g., 'Cash', 'Bank')
    IF p_reference IS NOT NULL AND TRIM(p_reference) <> '' THEN
        IF LOWER(TRIM(p_reference)) IN ('cash', 'bank', 'online', 'cheque', 'check', 'upi', 'hand cash', 'advance', 'payment', 'transfer', 'deposit', 'paid') THEN
            -- Generic reference: allow reuse across different dates/amounts, but reject exact identical duplicate on the same date
            IF EXISTS (
                SELECT 1 FROM reseller_payments 
                WHERE customer_id = p_customer_id 
                  AND amount = p_amount
                  AND payment_date = COALESCE(p_payment_date, CURRENT_DATE)
                  AND LOWER(TRIM(reference)) = LOWER(TRIM(p_reference))
            ) THEN
                RAISE EXCEPTION 'Duplicate payment of % with reference % on % already recorded for customer %', 
                    p_amount, TRIM(p_reference), COALESCE(p_payment_date, CURRENT_DATE), p_customer_id;
            END IF;
        ELSE
            -- Specific transaction reference (e.g. cheque number or UTR): enforce unique reference per customer
            IF EXISTS (
                SELECT 1 FROM reseller_payments 
                WHERE customer_id = p_customer_id 
                  AND reference = TRIM(p_reference)
            ) THEN
                RAISE EXCEPTION 'Payment with reference % already exists for customer %', TRIM(p_reference), p_customer_id;
            END IF;
        END IF;
    END IF;

    -- Guard against accidental double-clicks within a 3-second window
    IF EXISTS (
        SELECT 1 FROM reseller_payments 
        WHERE customer_id = p_customer_id 
          AND amount = p_amount 
          AND payment_date = COALESCE(p_payment_date, CURRENT_DATE)
          AND created_at >= (NOW() - INTERVAL '3 seconds')
    ) THEN
        RAISE EXCEPTION 'Duplicate payment request detected within last 3 seconds. Please refresh before retrying.';
    END IF;

    -- 4. Validate allocations sum before performing any inserts
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

    -- 5. Insert into reseller_payments
    INSERT INTO reseller_payments (
        customer_id,
        payment_date,
        amount,
        payment_method,
        reference,
        notes
    )
    VALUES (
        p_customer_id,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_amount,
        COALESCE(p_payment_method, 'Cash'),
        NULLIF(TRIM(p_reference), ''),
        NULLIF(TRIM(p_notes), '')
    )
    RETURNING id INTO v_payment_id;

    -- 6. Process and insert individual allocations with balance bounds check
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        -- Acquire row-level locks on all targeted customer credits in deterministic ascending UUID order.
        -- This guarantees consistent lock acquisition order across concurrent transactions, eliminating deadlock risk.
        PERFORM id 
        FROM customer_credits 
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
                -- Validate credit ownership and remaining balance (already locked above)
                SELECT balance INTO v_credit_balance 
                FROM customer_credits 
                WHERE id = v_credit_id AND customer_id = p_customer_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Target credit entry % does not exist or does not belong to customer %', v_credit_id, p_customer_id;
                END IF;

                IF v_alloc_amount > (v_credit_balance + 0.001) THEN
                    RAISE EXCEPTION 'Allocation amount (%) exceeds remaining balance (%) for credit %', v_alloc_amount, v_credit_balance, v_credit_id;
                END IF;

                -- Insert allocation (triggers trg_sync_customer_credit_balance automatically)
                INSERT INTO customer_payment_allocations (
                    payment_id,
                    credit_id,
                    amount,
                    notes
                )
                VALUES (
                    v_payment_id,
                    v_credit_id,
                    v_alloc_amount,
                    v_alloc_notes
                );
            END IF;
        END LOOP;
    END IF;

    -- 7. Return committed transaction metadata
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'total_amount', p_amount,
        'allocated_amount', v_total_allocated,
        'advance_amount', GREATEST(0, p_amount - v_total_allocated)
    );
EXCEPTION WHEN OTHERS THEN
    -- Automatic PostgreSQL transaction rollback guarantees zero partial rows
    RAISE;
END;
$$;

-- Revoke all execution permissions from anon and public to prevent unauthorized access
REVOKE ALL ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) FROM anon;

-- Grant permissions exclusively to authenticated users
GRANT EXECUTE ON FUNCTION public.record_customer_payment_with_allocations(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
