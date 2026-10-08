-- Drop the old delivery tables
DROP TABLE IF EXISTS daily_deliveries CASCADE;
DROP TABLE IF EXISTS delivery_routes CASCADE;
DROP TABLE IF EXISTS delivery_customers CASCADE;
DROP TABLE IF EXISTS general_deliveries CASCADE;
DROP TABLE IF EXISTS general_delivery_customers CASCADE;

-- MODULE A: GENERAL DAILY DELIVERY (MONTHLY CALENDAR LEDGER)

CREATE TABLE general_daily_delivery_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_date DATE NOT NULL UNIQUE,
    all_deliveries NUMERIC(10, 2) DEFAULT NULL,
    fuel_expenses NUMERIC(10, 2) DEFAULT NULL,
    net_total NUMERIC(10, 2) GENERATED ALWAYS AS (COALESCE(all_deliveries, 0) - COALESCE(fuel_expenses, 0)) STORED,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MODULE B: naeem UNCLE (DEDICATED DELIVERY OPERATION)

CREATE TABLE naeem_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    standard_fare NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE naeem_daily_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES naeem_routes(id) ON DELETE RESTRICT,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    standard_fare NUMERIC(10, 2) NOT NULL,
    extra_charge NUMERIC(10, 2) NOT NULL DEFAULT 0,
    final_fare NUMERIC(10, 2) NOT NULL,
    cash_received NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial naeem Uncle routes as requested
INSERT INTO naeem_routes (name, standard_fare) VALUES
('Khrew To Sheesha', 500.00),
('Khrew To Lal Chowk', 350.00),
('Khrew To Batwara', 300.00),
('Khrew To Sonwara', 350.00),
('No Order', 0.00);

-- Enable RLS
ALTER TABLE general_daily_delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE naeem_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE naeem_daily_records ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Allow authenticated users full access" ON general_daily_delivery_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON naeem_routes FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON naeem_daily_records FOR ALL TO authenticated USING (true);
