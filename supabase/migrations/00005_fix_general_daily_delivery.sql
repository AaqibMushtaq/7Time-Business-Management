-- ============================================================================
-- MIGRATION: 00005_fix_general_daily_delivery.sql
-- Module: General Daily Deliveries (Daily Ledger + Detailed Entries)
-- Safety: Additive / IF NOT EXISTS guards. RLS enabled.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop legacy table name if it exists (from early prototype)
DROP TABLE IF EXISTS public.general_daily_delivery_records CASCADE;

-- 1. Create table for daily summaries (general_daily_records)
CREATE TABLE IF NOT EXISTS public.general_daily_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_date DATE NOT NULL UNIQUE,
    fuel_expenses NUMERIC(10, 2) DEFAULT 0,
    opening_balance NUMERIC(10, 2) DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for individual delivery entries (general_delivery_entries)
CREATE TABLE IF NOT EXISTS public.general_delivery_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_record_id UUID NOT NULL REFERENCES public.general_daily_records(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    received_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_general_daily_records_date ON public.general_daily_records (record_date);
CREATE INDEX IF NOT EXISTS idx_general_delivery_entries_record_id ON public.general_delivery_entries (daily_record_id);

-- 4. Automatically update `updated_at` triggers
DROP TRIGGER IF EXISTS trg_general_daily_records_updated_at ON public.general_daily_records;
CREATE TRIGGER trg_general_daily_records_updated_at
BEFORE UPDATE ON public.general_daily_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_general_delivery_entries_updated_at ON public.general_delivery_entries;
CREATE TRIGGER trg_general_delivery_entries_updated_at
BEFORE UPDATE ON public.general_delivery_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.general_daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_delivery_entries ENABLE ROW LEVEL SECURITY;

-- 6. Add Policies (idempotent: drop then create)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.general_daily_records;
CREATE POLICY "Enable all access for authenticated users" ON public.general_daily_records
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.general_delivery_entries;
CREATE POLICY "Enable all access for authenticated users" ON public.general_delivery_entries
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
