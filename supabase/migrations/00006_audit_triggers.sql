-- 00006_audit_triggers.sql

-- Drop existing generic audit trigger if exists
DROP FUNCTION IF EXISTS log_audit_event() CASCADE;

-- Create generic audit log function
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_details JSONB;
BEGIN
    -- Attempt to get user ID from Supabase auth context (works when called via API)
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Prepare details based on operation
    IF TG_OP = 'INSERT' THEN
        v_details := jsonb_build_object('new', row_to_json(NEW));
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (v_user_id, TG_OP, TG_TABLE_NAME, NEW.id, v_details);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_details := jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW));
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (v_user_id, TG_OP, TG_TABLE_NAME, NEW.id, v_details);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_details := jsonb_build_object('old', row_to_json(OLD));
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (v_user_id, TG_OP, TG_TABLE_NAME, OLD.id, v_details);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to important tables
CREATE TRIGGER trg_audit_app_settings
AFTER INSERT OR UPDATE OR DELETE ON app_settings
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_products
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_purchases
AFTER INSERT OR UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_wholesale_sales
AFTER INSERT OR UPDATE OR DELETE ON wholesale_sales
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_dealer_payments
AFTER INSERT OR UPDATE OR DELETE ON dealer_payments
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_reseller_payments
AFTER INSERT OR UPDATE OR DELETE ON reseller_payments
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
