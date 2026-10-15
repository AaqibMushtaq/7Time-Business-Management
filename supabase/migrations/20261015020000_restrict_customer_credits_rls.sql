-- Migration: 20261015020000_restrict_customer_credits_rls.sql
-- Description: Security Hardening — Remove unrestricted anonymous access and revoke table privileges from anon
-- Affects: public.customer_credits, public.customer_payment_allocations
-- Safety: Preserves all existing data, foreign keys, triggers, and authenticated policies

BEGIN;

-- 1. Drop permissive anonymous policies
DROP POLICY IF EXISTS "Allow anon users full access" ON public.customer_credits;
DROP POLICY IF EXISTS "Allow anon users full access" ON public.customer_payment_allocations;

-- 2. Revoke all table-level privileges from the anon role (Defense-in-Depth)
REVOKE ALL PRIVILEGES ON TABLE public.customer_credits FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.customer_payment_allocations FROM anon;

-- 3. Confirm RLS remains strictly enabled on both tables
ALTER TABLE IF EXISTS public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_payment_allocations ENABLE ROW LEVEL SECURITY;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
