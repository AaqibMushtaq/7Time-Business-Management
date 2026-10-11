-- Migration: 00011_enhance_wholesale_stock_trigger.sql
-- Description: Ensure update_stock_on_sale safely handles product switching, edits, and stock reconciliation

CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.product_id = NEW.product_id THEN
            UPDATE products SET stock_quantity = stock_quantity + OLD.quantity - NEW.quantity WHERE id = NEW.product_id;
        ELSE
            UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
            UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_on_sale ON wholesale_sales;
CREATE TRIGGER trg_update_stock_on_sale
AFTER INSERT OR UPDATE OR DELETE ON wholesale_sales
FOR EACH ROW EXECUTE FUNCTION update_stock_on_sale();

NOTIFY pgrst, 'reload schema';
