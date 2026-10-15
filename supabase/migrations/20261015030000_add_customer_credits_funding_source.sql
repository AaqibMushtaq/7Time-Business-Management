-- Migration: 20261015030000_add_customer_credits_funding_source.sql
-- Description: Add funding_source column to customer_credits to track 7TIME Business Funds vs Personal Funds

ALTER TABLE public.customer_credits 
ADD COLUMN IF NOT EXISTS funding_source TEXT CHECK (funding_source IN ('7TIME_FUNDS', 'PERSONAL_FUNDS'));

CREATE INDEX IF NOT EXISTS idx_customer_credits_funding_source ON public.customer_credits (funding_source);

COMMENT ON COLUMN public.customer_credits.funding_source IS 'Origin of credit funds: 7TIME_FUNDS (business money), PERSONAL_FUNDS (personal proprietor capital), or NULL (historical unallocated).';

NOTIFY pgrst, 'reload schema';
