-- ============================================================================
-- MIGRATION: Restore naeem_payments & naeem_payment_allocations
-- Reason: These tables were defined in 00007 but never applied to Production.
-- Safety: All statements use IF NOT EXISTS / IF EXISTS guards.
--         No existing data is touched. No DROP TABLE or TRUNCATE.
-- ============================================================================

-- 1. Ensure uuid-ossp extension exists (should already, but safe to repeat)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create naeem_payments table
CREATE TABLE IF NOT EXISTS public.naeem_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    reference_number TEXT,
    cheque_number TEXT,
    cheque_date DATE,
    bank_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create naeem_payment_allocations table
CREATE TABLE IF NOT EXISTS public.naeem_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.naeem_payments(id) ON DELETE CASCADE,
    daily_record_id UUID NOT NULL REFERENCES public.naeem_daily_records(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_naeem_payment_alloc_payment ON public.naeem_payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_naeem_payment_alloc_record ON public.naeem_payment_allocations (daily_record_id);
CREATE INDEX IF NOT EXISTS idx_naeem_payments_date ON public.naeem_payments (payment_date);

-- 5. Trigger for updated_at on naeem_payments
DROP TRIGGER IF EXISTS trg_naeem_payments_updated_at ON public.naeem_payments;
CREATE TRIGGER trg_naeem_payments_updated_at
BEFORE UPDATE ON public.naeem_payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Enable RLS
ALTER TABLE public.naeem_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.naeem_payment_allocations ENABLE ROW LEVEL SECURITY;

-- 7. Policies (idempotent: drop then create)
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_payments;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_payments
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_payment_allocations;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_payment_allocations
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Recreate the get_naeem_opening_balance RPC (uses naeem_payments table)
CREATE OR REPLACE FUNCTION public.get_naeem_opening_balance(p_year INT, p_month INT)
RETURNS TABLE (
    opening_balance NUMERIC,
    is_manual_override BOOLEAN
) AS $$
DECLARE
    v_manual_year INT;
    v_manual_month INT;
    v_manual_balance NUMERIC := 0;
    v_start_date DATE;
    v_end_date DATE;
    v_total_billed NUMERIC := 0;
    v_total_received NUMERIC := 0;
    v_target_date DATE;
    v_row_exists BOOLEAN;
BEGIN
    SELECT nmb.opening_balance, nmb.is_manual_override 
    INTO v_manual_balance, v_row_exists
    FROM public.naeem_monthly_balances nmb
    WHERE nmb.year = p_year AND nmb.month = p_month AND nmb.is_manual_override = TRUE;
    
    IF FOUND THEN
        RETURN QUERY SELECT v_manual_balance, TRUE;
        RETURN;
    END IF;

    SELECT nmb.year, nmb.month, nmb.opening_balance
    INTO v_manual_year, v_manual_month, v_manual_balance
    FROM public.naeem_monthly_balances nmb
    WHERE (nmb.year < p_year OR (nmb.year = p_year AND nmb.month < p_month))
      AND nmb.is_manual_override = TRUE
    ORDER BY nmb.year DESC, nmb.month DESC
    LIMIT 1;

    IF FOUND THEN
        v_start_date := make_date(v_manual_year, v_manual_month, 1);
    ELSE
        v_start_date := '2000-01-01'::DATE;
        v_manual_balance := 0;
    END IF;

    v_target_date := make_date(p_year, p_month, 1);
    v_end_date := v_target_date - INTERVAL '1 day';

    SELECT COALESCE(SUM(r.final_fare), 0)
    INTO v_total_billed
    FROM public.naeem_daily_records r
    LEFT JOIN public.naeem_routes rt ON r.route_id = rt.id
    WHERE r.delivery_date >= v_start_date AND r.delivery_date <= v_end_date
      AND r.status != 'No Order'
      AND LOWER(rt.name) != 'no order';

    SELECT COALESCE(SUM(p.amount), 0)
    INTO v_total_received
    FROM public.naeem_payments p
    WHERE p.payment_date >= v_start_date AND p.payment_date <= v_end_date;

    RETURN QUERY SELECT (v_manual_balance + v_total_billed - v_total_received), FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_naeem_opening_balance(INT, INT) TO authenticated;

-- 9. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 10. Verification query (will show tables in output)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('naeem_payments', 'naeem_payment_allocations');
