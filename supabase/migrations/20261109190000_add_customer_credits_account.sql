-- Migration: 20261109190000_add_customer_credits_account.sql
-- Description: Add structured account column to customer_credits for explicit paid-from account tracking.
-- Preserves compatibility with existing records (nullable). Does not alter historical notes or invent data.

ALTER TABLE public.customer_credits 
ADD COLUMN IF NOT EXISTS account TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_credits_account ON public.customer_credits (account);

COMMENT ON COLUMN public.customer_credits.account IS 'Specific payment account or method from which expense/credit was disbursed (e.g., Cash, HDFC Bank, Google Pay, etc.), or NULL for historical records.';

NOTIFY pgrst, 'reload schema';

