-- Table: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL DEFAULT '7TIME',
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    date_format TEXT NOT NULL DEFAULT 'DD-MMM-YYYY',
    low_stock_threshold INTEGER NOT NULL DEFAULT 2,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row if it doesn't exist
INSERT INTO app_settings (business_name)
SELECT '7TIME'
WHERE NOT EXISTS (SELECT 1 FROM app_settings);


-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    module_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_id UUID,
    record_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users only" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Add RLS policies for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users only" ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for authenticated users only" ON app_settings FOR UPDATE TO authenticated USING (true);
