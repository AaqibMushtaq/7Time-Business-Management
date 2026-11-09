-- Migration: 20261109210000_add_customer_credits_shopkeeper_and_location.sql
-- Description: Add structured shopkeeper_name and purchase_location columns to customer_credits.
-- Preserves backward compatibility with all historical records (nullable).
-- Status: PREPARED LOCALLY (PENDING EXPLICIT USER AUTHORIZATION BEFORE REMOTE PRODUCTION ROLLOUT)

ALTER TABLE public.customer_credits 
ADD COLUMN IF NOT EXISTS shopkeeper_name TEXT,
ADD COLUMN IF NOT EXISTS purchase_location TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_credits_shopkeeper ON public.customer_credits (shopkeeper_name);
CREATE INDEX IF NOT EXISTS idx_customer_credits_purchase_location ON public.customer_credits (purchase_location);

COMMENT ON COLUMN public.customer_credits.shopkeeper_name IS 'Shopkeeper, merchant, supplier, or person who received payment for expense on behalf, or NULL for historical/loan records.';
COMMENT ON COLUMN public.customer_credits.purchase_location IS 'Physical market, area, shopping complex, or town where the purchase took place, or NULL if unspecified.';

NOTIFY pgrst, 'reload schema';
