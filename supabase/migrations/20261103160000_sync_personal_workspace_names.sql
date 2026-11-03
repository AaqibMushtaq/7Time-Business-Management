-- ============================================================================
-- 7TIME Multi-Account Architecture Migration
-- 20261103160000_sync_personal_workspace_names.sql
--
-- Objective:
-- Enforce global dynamic personal workspace naming synchronized with owner's full_name.
-- 1. Creates trigger function public.sync_personal_workspace_name()
-- 2. Attaches AFTER UPDATE trigger on public.profiles(full_name)
-- 3. Safely reconciles existing stale PERSONAL workspaces
--
-- Security:
-- - Scoped strictly to workspace_type = 'PERSONAL'
-- - Never renames BUSINESS workspaces
-- - Never alters workspace IDs, owner_id, memberships, or accounting data
-- - SECURITY DEFINER with fixed search_path = public
-- ============================================================================

-- 1. Trigger Function
CREATE OR REPLACE FUNCTION public.sync_personal_workspace_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_name TEXT;
    v_clean_email TEXT;
    v_new_ws_name TEXT;
BEGIN
    -- Only act when full_name actually changes and is distinct
    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
        v_clean_name := TRIM(COALESCE(NEW.full_name, ''));
        v_clean_email := TRIM(COALESCE(NEW.email, ''));

        IF LENGTH(v_clean_name) >= 2 THEN
            -- Check if name already has 's Workspace suffix to prevent duplication
            IF LOWER(v_clean_name) LIKE '%''s workspace' THEN
                v_new_ws_name := v_clean_name;
            ELSE
                v_new_ws_name := v_clean_name || '''s Workspace';
            END IF;
        ELSIF LENGTH(v_clean_email) > 0 AND POSITION('@' IN v_clean_email) > 1 THEN
            v_new_ws_name := INITCAP(SPLIT_PART(v_clean_email, '@', 1)) || '''s Workspace';
        ELSE
            v_new_ws_name := 'Personal Workspace';
        END IF;

        -- Update ONLY the owner's PERSONAL workspaces.
        -- NEVER touch BUSINESS workspaces.
        -- NEVER alter owner_id, id, is_active, or memberships.
        UPDATE public.workspaces
        SET name = v_new_ws_name,
            updated_at = NOW()
        WHERE owner_id = NEW.id
          AND workspace_type = 'PERSONAL'
          AND name <> v_new_ws_name;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Trigger on public.profiles
DROP TRIGGER IF EXISTS trg_sync_personal_workspace_name ON public.profiles;

CREATE TRIGGER trg_sync_personal_workspace_name
AFTER UPDATE OF full_name ON public.profiles
FOR EACH ROW
WHEN (OLD.full_name IS DISTINCT FROM NEW.full_name)
EXECUTE FUNCTION public.sync_personal_workspace_name();

-- 3. Existing Personal Workspace Reconciliation (Audit Safe)
UPDATE public.workspaces w
SET name = CASE 
        WHEN LENGTH(TRIM(COALESCE(p.full_name, ''))) >= 2 THEN 
            CASE 
                WHEN LOWER(TRIM(p.full_name)) LIKE '%''s workspace' THEN TRIM(p.full_name)
                ELSE TRIM(p.full_name) || '''s Workspace'
            END
        WHEN LENGTH(TRIM(COALESCE(p.email, ''))) > 0 AND POSITION('@' IN p.email) > 1 THEN 
            INITCAP(SPLIT_PART(p.email, '@', 1)) || '''s Workspace'
        ELSE 'Personal Workspace'
    END,
    updated_at = NOW()
FROM public.profiles p
WHERE w.owner_id = p.id
  AND w.workspace_type = 'PERSONAL'
  AND w.name <> (
      CASE 
          WHEN LENGTH(TRIM(COALESCE(p.full_name, ''))) >= 2 THEN 
              CASE 
                  WHEN LOWER(TRIM(p.full_name)) LIKE '%''s workspace' THEN TRIM(p.full_name)
                  ELSE TRIM(p.full_name) || '''s Workspace'
              END
          WHEN LENGTH(TRIM(COALESCE(p.email, ''))) > 0 AND POSITION('@' IN p.email) > 1 THEN 
              INITCAP(SPLIT_PART(p.email, '@', 1)) || '''s Workspace'
          ELSE 'Personal Workspace'
      END
  );

