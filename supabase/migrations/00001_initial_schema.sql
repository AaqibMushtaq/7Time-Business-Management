-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: dealers
CREATE TABLE dealers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    buying_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    wholesale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    retail_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity_bought NUMERIC(10, 2) NOT NULL,
    buying_rate NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: dealer_payments
CREATE TABLE dealer_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: reseller_customers
CREATE TABLE reseller_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: wholesale_sales
CREATE TABLE wholesale_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES reseller_customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(10, 2) NOT NULL,
    buying_cost NUMERIC(10, 2) NOT NULL,
    wholesale_price NUMERIC(10, 2) NOT NULL,
    total_sale NUMERIC(10, 2) NOT NULL,
    amount_received NUMERIC(10, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    profit NUMERIC(10, 2) NOT NULL,
    payment_status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: reseller_payments
CREATE TABLE reseller_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES reseller_customers(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: delivery_customers
CREATE TABLE delivery_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: delivery_routes
CREATE TABLE delivery_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    fare NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: daily_deliveries
CREATE TABLE daily_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES delivery_customers(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fare NUMERIC(10, 2) NOT NULL,
    cash_received NUMERIC(10, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Triggers

-- 1. Purchases increase stock
CREATE OR REPLACE FUNCTION update_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE products SET stock_quantity = stock_quantity + NEW.quantity_bought WHERE id = NEW.product_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE products SET stock_quantity = stock_quantity - OLD.quantity_bought + NEW.quantity_bought WHERE id = NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products SET stock_quantity = stock_quantity - OLD.quantity_bought WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_on_purchase
AFTER INSERT OR UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION update_stock_on_purchase();

-- 2. Wholesale sales decrease stock
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE products SET stock_quantity = stock_quantity + OLD.quantity - NEW.quantity WHERE id = NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_on_sale
AFTER INSERT OR UPDATE OR DELETE ON wholesale_sales
FOR EACH ROW EXECUTE FUNCTION update_stock_on_sale();

-- Enable RLS and create basic policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: We will add specific RLS policies (e.g. true for authenticated) in a subsequent step if needed, or allow all authenticated users for now
CREATE POLICY "Allow authenticated users full access" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON dealers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON purchases FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON dealer_payments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON reseller_customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON wholesale_sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON reseller_payments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON delivery_customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON delivery_routes FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON daily_deliveries FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON audit_logs FOR ALL TO authenticated USING (true);
