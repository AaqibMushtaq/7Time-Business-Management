-- Migration: Add category column to products table
-- Allows persisting explicit category classifications (e.g. Honey, Oils, Dry Fruits & Nuts, etc.)

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.products.category IS 'Product business category assignment';
