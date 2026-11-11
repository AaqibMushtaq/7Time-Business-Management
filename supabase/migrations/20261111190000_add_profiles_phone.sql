-- ============================================================================
-- MIGRATION: 20261111190000_add_profiles_phone.sql
-- Module: 7TIME Profile & WhatsApp PDF Sharing Integration
-- Scope: Add optional phone column to public.profiles
--
-- Details:
--   Enables authenticated users to persist their contact phone number
--   for WhatsApp PDF sharing and workspace communications.
--   Additive and idempotent DDL statement.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'phone'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
END $$;

