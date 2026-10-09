-- Migration: Add contact fields to dealers table
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS notes TEXT;
