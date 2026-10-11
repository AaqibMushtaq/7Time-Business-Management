-- Migration: 00003_add_payment_method_wholesale.sql
-- Description: Add payment_method column to wholesale_sales and reload PostgREST schema cache

ALTER TABLE public.wholesale_sales 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Reload PostgREST API schema cache so API clients recognize payment_method immediately
NOTIFY pgrst, 'reload schema';
