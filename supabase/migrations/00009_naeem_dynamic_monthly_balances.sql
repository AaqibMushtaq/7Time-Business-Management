-- Add is_manual_override to monthly balances
ALTER TABLE public.naeem_monthly_balances
ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Create RPC to calculate opening balance dynamically
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
    -- 1. Check if the requested month HAS a manual override
    SELECT nmb.opening_balance, nmb.is_manual_override 
    INTO v_manual_balance, v_row_exists
    FROM public.naeem_monthly_balances nmb
    WHERE nmb.year = p_year AND nmb.month = p_month AND nmb.is_manual_override = TRUE;
    
    IF FOUND THEN
        RETURN QUERY SELECT v_manual_balance, TRUE;
        RETURN;
    END IF;

    -- 2. No manual override. We must calculate automatically.
    -- Find the most recent manual override PRIOR to the requested month.
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
        -- No manual override ever. Start from beginning of time (e.g. 2000-01-01)
        v_start_date := '2000-01-01'::DATE;
        v_manual_balance := 0;
    END IF;

    -- The end date is the LAST day of the month BEFORE the requested month.
    v_target_date := make_date(p_year, p_month, 1);
    v_end_date := v_target_date - INTERVAL '1 day';

    -- 3. Sum Billed
    SELECT COALESCE(SUM(r.final_fare), 0)
    INTO v_total_billed
    FROM public.naeem_daily_records r
    LEFT JOIN public.naeem_routes rt ON r.route_id = rt.id
    WHERE r.delivery_date >= v_start_date AND r.delivery_date <= v_end_date
      AND r.status != 'No Order'
      AND LOWER(rt.name) != 'no order';

    -- 4. Sum Received
    SELECT COALESCE(SUM(p.amount), 0)
    INTO v_total_received
    FROM public.naeem_payments p
    WHERE p.payment_date >= v_start_date AND p.payment_date <= v_end_date;

    -- 5. Calculate final automatic opening balance
    RETURN QUERY SELECT (v_manual_balance + v_total_billed - v_total_received), FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_naeem_opening_balance(INT, INT) TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
