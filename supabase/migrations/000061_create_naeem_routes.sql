-- PERMANENT ROOT-CAUSE FIX: public.naeem_routes
-- Ensures the table matches exactly what the application expects (name, standard_fare, is_active).

-- 1. Create naeem_routes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.naeem_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    standard_fare NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create naeem_daily_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.naeem_daily_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES public.naeem_routes(id) ON DELETE RESTRICT,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    standard_fare NUMERIC(12, 2) NOT NULL,
    extra_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
    final_fare NUMERIC(12, 2) NOT NULL,
    cash_received NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add necessary indexing to support UI search and list operations
CREATE INDEX IF NOT EXISTS idx_naeem_routes_name ON public.naeem_routes (name);
CREATE INDEX IF NOT EXISTS idx_naeem_routes_active ON public.naeem_routes (is_active);
CREATE INDEX IF NOT EXISTS idx_naeem_daily_records_date ON public.naeem_daily_records (delivery_date);

-- 4. Automatically update `updated_at` triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_naeem_routes_updated_at ON public.naeem_routes;
CREATE TRIGGER trg_naeem_routes_updated_at
BEFORE UPDATE ON public.naeem_routes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_naeem_daily_records_updated_at ON public.naeem_daily_records;
CREATE TRIGGER trg_naeem_daily_records_updated_at
BEFORE UPDATE ON public.naeem_daily_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Enable Row Level Security (RLS) matching the project's existing policy structure
ALTER TABLE public.naeem_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.naeem_daily_records ENABLE ROW LEVEL SECURITY;

-- 6. Insert default policy (Allow authenticated users access)
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_routes;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_routes
FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.naeem_daily_records;
CREATE POLICY "Allow authenticated users full access" ON public.naeem_daily_records
FOR ALL TO authenticated USING (true);

-- 7. Notify PostgREST to flush the schema cache
NOTIFY pgrst, 'reload schema';
