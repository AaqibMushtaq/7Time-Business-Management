-- Drop old table if it exists to avoid confusion (data is being migrated conceptually by user if any)
DROP TABLE IF EXISTS general_daily_delivery_records CASCADE;

-- Create new table for daily summaries
CREATE TABLE IF NOT EXISTS general_daily_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_date DATE NOT NULL UNIQUE,
    fuel_expenses NUMERIC(10, 2) DEFAULT 0,
    opening_balance NUMERIC(10, 2) DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create new table for multiple delivery entries
CREATE TABLE IF NOT EXISTS general_delivery_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_record_id UUID NOT NULL REFERENCES general_daily_records(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE general_daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_delivery_entries ENABLE ROW LEVEL SECURITY;

-- Add Policies
CREATE POLICY "Enable all access for authenticated users" ON general_daily_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON general_delivery_entries FOR ALL TO authenticated USING (true);
