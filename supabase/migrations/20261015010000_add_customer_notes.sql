-- Migration: 20261015010000_add_customer_notes.sql
-- Description: Add notes column to reseller_customers table

ALTER TABLE IF EXISTS public.reseller_customers 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
