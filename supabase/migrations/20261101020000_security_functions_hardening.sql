-- ============================================================================
-- MIGRATION: 20261101020000_security_functions_hardening.sql
-- Module: 7TIME Multi-Account Workspace Architecture — Security Functions Remediation
-- Status: PREPARED OFFLINE FOR CONTROLLED FORWARD-ONLY APPLICATION
-- Preconditions: Requires 20261101000000_multi_account_core.sql and 20261101010000_harden_rls_policies.sql
-- Scope: 
--   1. Replaces public.has_workspace_access with fixed search_path = public, pg_temp,
--      caller authentication enforcement, profile active checks, and postgres ownership.
--   2. Replaces public.is_super_admin with fixed search_path = public, pg_temp,
--      caller authentication enforcement, profile active checks, and postgres ownership.
--   3. Restricts EXECUTE permissions to authenticated and service_role only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRECONDITION VERIFICATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE EXCEPTION 'Precondition Failed: public.profiles table does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'system_role') THEN
        RAISE EXCEPTION 'Precondition Failed: public.profiles.system_role column does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active') THEN
        RAISE EXCEPTION 'Precondition Failed: public.profiles.is_active column does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
        RAISE EXCEPTION 'Precondition Failed: public.workspaces table does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_members') THEN
        RAISE EXCEPTION 'Precondition Failed: public.workspace_members table does not exist.';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. HARDENED FUNCTION: public.has_workspace_access(p_workspace_id UUID)
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

    -- Guard 3: Fetch caller profile active status and system role under fixed search_path
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
-- 3. HARDENED FUNCTION: public.is_super_admin()
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


-- ----------------------------------------------------------------------------
-- 4. POST-FLIGHT VALIDATION ASSERTION
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_has_access_owner TEXT;
    v_is_super_owner TEXT;
BEGIN
    SELECT r.rolname INTO v_has_access_owner
    FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.proname = 'has_workspace_access' AND p.pronargs = 1;

    SELECT r.rolname INTO v_is_super_owner
    FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.proname = 'is_super_admin' AND p.pronargs = 0;

    IF v_has_access_owner != 'postgres' THEN
        RAISE EXCEPTION 'Post-flight Failed: has_workspace_access owner is %, expected postgres', v_has_access_owner;
    END IF;

    IF v_is_super_owner != 'postgres' THEN
        RAISE EXCEPTION 'Post-flight Failed: is_super_admin owner is %, expected postgres', v_is_super_owner;
    END IF;
END $$;

