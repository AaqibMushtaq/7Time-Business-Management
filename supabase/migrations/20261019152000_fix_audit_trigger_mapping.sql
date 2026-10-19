-- ============================================================================
-- MIGRATION: 20261019152000_fix_audit_trigger_mapping.sql
-- Module: System Audit & Compliance Domain
-- Safety: Additive column migration + trigger function alignment.
--         Guarantees both schema column sets (module_name/record_id/record_details
--         and entity_type/entity_id/details) are populated identically, ensuring
--         zero data loss and full compatibility with existing UI components.
-- ============================================================================

-- 1. Ensure all audit column variants exist idempotently on public.audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS module_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_details JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- 2. Backfill existing rows in a single consolidated pass to minimize table locking and WAL writes
UPDATE public.audit_logs 
SET 
    module_name = COALESCE(module_name, entity_type),
    entity_type = COALESCE(entity_type, module_name),
    record_details = COALESCE(record_details, details),
    details = COALESCE(details, record_details),
    record_id = COALESCE(record_id, entity_id),
    entity_id = COALESCE(entity_id, record_id)
WHERE 
    (module_name IS NULL AND entity_type IS NOT NULL) OR
    (entity_type IS NULL AND module_name IS NOT NULL) OR
    (record_details IS NULL AND details IS NOT NULL) OR
    (details IS NULL AND record_details IS NOT NULL) OR
    (record_id IS NULL AND entity_id IS NOT NULL) OR
    (entity_id IS NULL AND record_id IS NOT NULL);

-- 3. Replace log_audit_event() to populate all columns atomically
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_details JSONB;
    v_target_id UUID;
BEGIN
    -- Attempt to get user ID from Supabase auth context
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Prepare details and identify target record ID based on operation
    IF TG_OP = 'INSERT' THEN
        v_details := jsonb_build_object('new', row_to_json(NEW));
        v_target_id := NEW.id;
        
        INSERT INTO audit_logs (
            user_id,
            action,
            module_name,
            entity_type,
            record_id,
            entity_id,
            record_details,
            details
        )
        VALUES (
            v_user_id,
            TG_OP,
            TG_TABLE_NAME,
            TG_TABLE_NAME,
            v_target_id,
            v_target_id,
            v_details,
            v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_details := jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW));
        v_target_id := NEW.id;
        
        INSERT INTO audit_logs (
            user_id,
            action,
            module_name,
            entity_type,
            record_id,
            entity_id,
            record_details,
            details
        )
        VALUES (
            v_user_id,
            TG_OP,
            TG_TABLE_NAME,
            TG_TABLE_NAME,
            v_target_id,
            v_target_id,
            v_details,
            v_details
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_details := jsonb_build_object('old', row_to_json(OLD));
        v_target_id := OLD.id;
        
        INSERT INTO audit_logs (
            user_id,
            action,
            module_name,
            entity_type,
            record_id,
            entity_id,
            record_details,
            details
        )
        VALUES (
            v_user_id,
            TG_OP,
            TG_TABLE_NAME,
            TG_TABLE_NAME,
            v_target_id,
            v_target_id,
            v_details,
            v_details
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
