-- ============================================================================
-- MIGRATION: 20261019150000_enhance_purchase_stock_trigger.sql
-- Module: Supplier & Purchasing Domain (Inventory Sync)
-- Safety: Idempotent replacement of update_stock_on_purchase trigger function.
--         Correctly handles INSERT, UPDATE (same product), UPDATE (product switch),
--         and DELETE operations to eliminate phantom stock leakage.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_stock_on_purchase()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE products 
        SET stock_quantity = stock_quantity + NEW.quantity_bought 
        WHERE id = NEW.product_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.product_id = NEW.product_id THEN
            -- Same product: adjust stock by net difference
            UPDATE products 
            SET stock_quantity = stock_quantity - OLD.quantity_bought + NEW.quantity_bought 
            WHERE id = NEW.product_id;
        ELSE
            -- Product changed: revert stock on old product and apply to new product
            UPDATE products 
            SET stock_quantity = stock_quantity - OLD.quantity_bought 
            WHERE id = OLD.product_id;
            
            UPDATE products 
            SET stock_quantity = stock_quantity + NEW.quantity_bought 
            WHERE id = NEW.product_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products 
        SET stock_quantity = stock_quantity - OLD.quantity_bought 
        WHERE id = OLD.product_id;
    END IF;
    
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_stock_on_purchase ON public.purchases;
CREATE TRIGGER trg_update_stock_on_purchase
AFTER INSERT OR UPDATE OR DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_purchase();

NOTIFY pgrst, 'reload schema';
