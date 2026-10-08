CREATE TABLE IF NOT EXISTS public.naeem_monthly_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT naeem_monthly_balances_month_check
        CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT naeem_monthly_balances_year_check
        CHECK (year BETWEEN 2000 AND 2100),
    CONSTRAINT naeem_monthly_balances_opening_balance_check
        CHECK (opening_balance >= 0),
    CONSTRAINT naeem_monthly_balances_year_month_unique
        UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_naeem_monthly_balances_year_month
ON public.naeem_monthly_balances (year, month);

-- Enable RLS
ALTER TABLE public.naeem_monthly_balances ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_monthly_balances;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_monthly_balances
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add updated_at trigger (using existing set_updated_at function)
DROP TRIGGER IF EXISTS naeem_monthly_balances_updated_at ON public.naeem_monthly_balances;
CREATE TRIGGER naeem_monthly_balances_updated_at 
BEFORE UPDATE ON public.naeem_monthly_balances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
