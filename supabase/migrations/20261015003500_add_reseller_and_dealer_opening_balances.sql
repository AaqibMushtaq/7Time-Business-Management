-- Migration: Ensure opening_balance exists on reseller_customers and dealers tables
-- Fixes missing column in deployed database without altering or resetting existing financial records

ALTER TABLE IF EXISTS public.reseller_customers 
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.dealers 
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
