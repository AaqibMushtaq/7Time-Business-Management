-- NAEEM PAYMENTS MANUAL LEDGER

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

CREATE TABLE IF NOT EXISTS public.naeem_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.naeem_payments(id) ON DELETE CASCADE,
    daily_record_id UUID NOT NULL REFERENCES public.naeem_daily_records(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient allocation lookups
CREATE INDEX IF NOT EXISTS idx_naeem_payment_alloc_payment ON public.naeem_payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_naeem_payment_alloc_record ON public.naeem_payment_allocations (daily_record_id);
CREATE INDEX IF NOT EXISTS idx_naeem_payments_date ON public.naeem_payments (payment_date);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_naeem_payments_updated_at ON public.naeem_payments;
CREATE TRIGGER trg_naeem_payments_updated_at
BEFORE UPDATE ON public.naeem_payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE public.naeem_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.naeem_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Default authenticated policies
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_payments;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_payments
FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_payment_allocations;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_payment_allocations
FOR ALL TO authenticated USING (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
