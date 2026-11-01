-- ============================================================================
-- 7TIME SECURITY FUNCTIONS CORRECTION SCRIPT
-- File: 7TIME_SECURITY_FUNCTIONS_CORRECTION.sql
-- Status: PREPARED OFFLINE — DO NOT APPLY WITHOUT EXPLICIT AUTHORIZATION
-- Target Supabase Project: haofuuvwciqsambgeqyn
-- Scope: Hardens SECURITY DEFINER functions has_workspace_access & is_super_admin
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: public.has_workspace_access(p_workspace_id UUID)
-- ----------------------------------------------------------------------------
-- Corrects:
-- - Sets fixed search_path = public, pg_temp to prevent schema hijacking
-- - Enforces caller authentication (rejects null auth.uid())
-- - Rejects suspended user profiles (is_active = false)
-- - Bypasses membership check ONLY for verified active SUPER_ADMIN
-- - Enforces active workspace membership (wm.is_active = true) in active workspace (w.is_active = true)
-- - Prevents caller privilege escalation via p_workspace_id parameter spoofing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_access(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_active BOOLEAN;
    v_role TEXT;
BEGIN
    -- Guard 1: Null workspace ID cannot be accessed under any circumstance
    IF p_workspace_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Guard 2: Require valid authenticated caller context
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Guard 3: Fetch caller profile active status and system role
    -- Uses schema-qualified table name under fixed search_path
    SELECT is_active, system_role INTO v_is_active, v_role
    FROM public.profiles
    WHERE id = v_user_id;

    -- Suspended or non-existent profiles are unconditionally denied
    IF v_is_active IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- Super Admin has universal operational access to all enterprise workspaces
    IF v_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Guard 4: Standard user must be an active member of an active workspace
    RETURN EXISTS (
        SELECT 1 
        FROM public.workspace_members wm
        JOIN public.workspaces w ON w.id = wm.workspace_id
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = v_user_id
          AND wm.is_active = true
          AND w.is_active = true
    );
END;
$$;

-- Enforce postgres ownership
ALTER FUNCTION public.has_workspace_access(UUID) OWNER TO postgres;

-- Minimal execution privileges: revoke public and anon, grant only to authenticated & service_role
REVOKE ALL ON FUNCTION public.has_workspace_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_workspace_access(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID) TO service_role;


-- ----------------------------------------------------------------------------
-- 2. FUNCTION: public.is_super_admin()
-- ----------------------------------------------------------------------------
-- Corrects:
-- - Sets fixed search_path = public, pg_temp to prevent schema hijacking
-- - Enforces caller authentication (rejects null auth.uid())
-- - Rejects suspended user profiles (is_active = false)
-- - Enforces exact role equality: system_role = 'SUPER_ADMIN'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles
        WHERE id = v_user_id
          AND system_role = 'SUPER_ADMIN'
          AND is_active = true
    );
END;
$$;

ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

