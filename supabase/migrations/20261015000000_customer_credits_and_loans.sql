-- Migration: 20261015000000_customer_credits_and_loans.sql
-- Description: Support Product Credit, Cash Loans, and Other Credit with partial repayments and payment allocations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: customer_credits
CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.reseller_customers(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('PRODUCT_CREDIT', 'CASH_LOAN', 'OTHER_CREDIT')),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    category TEXT,
    quantity NUMERIC(12, 2) DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    rate_per_unit NUMERIC(12, 2) DEFAULT 0,
    description TEXT,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_customer_credit_requirements CHECK (
        (entry_type = 'PRODUCT_CREDIT' AND product_name IS NOT NULL AND length(trim(product_name)) > 0) OR
        (entry_type = 'CASH_LOAN') OR
        (entry_type = 'OTHER_CREDIT' AND description IS NOT NULL AND length(trim(description)) > 0)
    )
);

-- 2. Table: customer_payment_allocations
CREATE TABLE IF NOT EXISTS public.customer_payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.reseller_payments(id) ON DELETE CASCADE,
    credit_id UUID NOT NULL REFERENCES public.customer_credits(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payment_credit_allocation UNIQUE (payment_id, credit_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON public.customer_credits (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_entry_type ON public.customer_credits (entry_type);
CREATE INDEX IF NOT EXISTS idx_customer_credits_entry_date ON public.customer_credits (entry_date);
CREATE INDEX IF NOT EXISTS idx_customer_credits_status ON public.customer_credits (status);
CREATE INDEX IF NOT EXISTS idx_customer_payment_allocations_payment_id ON public.customer_payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_allocations_credit_id ON public.customer_payment_allocations (credit_id);

-- 4. Trigger Function: set_customer_credit_defaults
CREATE OR REPLACE FUNCTION set_customer_credit_defaults()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance := GREATEST(0, NEW.total_amount - NEW.amount_paid);
    NEW.status := CASE 
        WHEN NEW.amount_paid >= NEW.total_amount THEN 'PAID'
        WHEN NEW.amount_paid > 0 THEN 'PARTIAL'
        ELSE 'PENDING'
    END;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_credit_defaults ON public.customer_credits;
CREATE TRIGGER trg_customer_credit_defaults
BEFORE INSERT OR UPDATE ON public.customer_credits
FOR EACH ROW EXECUTE FUNCTION set_customer_credit_defaults();

-- 5. Trigger Function: sync_customer_credit_balance
CREATE OR REPLACE FUNCTION sync_customer_credit_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_credit_id UUID;
    v_total_allocated NUMERIC(12, 2);
    v_total_amount NUMERIC(12, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_credit_id := OLD.credit_id;
    ELSE
        v_credit_id := NEW.credit_id;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_allocated
    FROM public.customer_payment_allocations
    WHERE credit_id = v_credit_id;

    SELECT total_amount INTO v_total_amount
    FROM public.customer_credits
    WHERE id = v_credit_id;

    IF v_total_amount IS NOT NULL THEN
        UPDATE public.customer_credits
        SET 
            amount_paid = v_total_allocated,
            balance = GREATEST(0, v_total_amount - v_total_allocated),
            status = CASE 
                WHEN v_total_allocated >= v_total_amount THEN 'PAID'
                WHEN v_total_allocated > 0 THEN 'PARTIAL'
                ELSE 'PENDING'
            END,
            updated_at = NOW()
        WHERE id = v_credit_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_credit_balance ON public.customer_payment_allocations;
CREATE TRIGGER trg_sync_customer_credit_balance
AFTER INSERT OR UPDATE OR DELETE ON public.customer_payment_allocations
FOR EACH ROW EXECUTE FUNCTION sync_customer_credit_balance();

-- 6. Trigger Function: update_stock_on_customer_credit
CREATE OR REPLACE FUNCTION update_stock_on_customer_credit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.product_id IS NOT NULL AND NEW.quantity IS NOT NULL THEN
            UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Revert old stock if product was linked
        IF OLD.product_id IS NOT NULL AND OLD.quantity IS NOT NULL THEN
            UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
        END IF;
        -- Apply new stock if product is linked
        IF NEW.product_id IS NOT NULL AND NEW.quantity IS NOT NULL THEN
            UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.product_id IS NOT NULL AND OLD.quantity IS NOT NULL THEN
            UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_on_customer_credit ON public.customer_credits;
CREATE TRIGGER trg_update_stock_on_customer_credit
AFTER INSERT OR UPDATE OR DELETE ON public.customer_credits
FOR EACH ROW EXECUTE FUNCTION update_stock_on_customer_credit();

-- 7. RLS Configuration
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.customer_credits;
CREATE POLICY "Allow authenticated users full access" ON public.customer_credits
FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon users full access" ON public.customer_credits;
CREATE POLICY "Allow anon users full access" ON public.customer_credits
FOR ALL TO anon USING (true);

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.customer_payment_allocations;
CREATE POLICY "Allow authenticated users full access" ON public.customer_payment_allocations
FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon users full access" ON public.customer_payment_allocations;
CREATE POLICY "Allow anon users full access" ON public.customer_payment_allocations
FOR ALL TO anon USING (true);

-- 8. Audit Log Integration (if log_audit_event exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') THEN
        DROP TRIGGER IF EXISTS trg_audit_customer_credits ON public.customer_credits;
        CREATE TRIGGER trg_audit_customer_credits
        AFTER INSERT OR UPDATE OR DELETE ON public.customer_credits
        FOR EACH ROW EXECUTE FUNCTION log_audit_event();

        DROP TRIGGER IF EXISTS trg_audit_customer_payment_allocations ON public.customer_payment_allocations;
        CREATE TRIGGER trg_audit_customer_payment_allocations
        AFTER INSERT OR UPDATE OR DELETE ON public.customer_payment_allocations
        FOR EACH ROW EXECUTE FUNCTION log_audit_event();
    END IF;
END $$;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
