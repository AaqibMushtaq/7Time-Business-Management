-- Migration: Allow nullable wholesale_price and retail_price in products table
-- Allows distinguishing unconfigured selling prices (NULL) from explicitly configured zero-price selling methods (0.00)

ALTER TABLE public.products ALTER COLUMN wholesale_price DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN retail_price DROP NOT NULL;

COMMENT ON COLUMN public.products.wholesale_price IS 'Wholesale selling price per unit; NULL if product is not sold in wholesale';
COMMENT ON COLUMN public.products.retail_price IS 'Retail selling price per unit; NULL if product is not sold in retail';
