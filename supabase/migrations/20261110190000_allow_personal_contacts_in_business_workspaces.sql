-- Migration: 20261110190000_allow_personal_contacts_in_business_workspaces.sql
-- Description: Allow personal contacts (contact_type = 'PERSONAL') to be created in BUSINESS workspaces.
-- Domain Architecture:
--   - Workspace type ('BUSINESS', 'PERSONAL') denotes workspace organization.
--   - Contact type ('BUSINESS', 'PERSONAL') denotes entity classification:
--       * BUSINESS contacts: Wholesale commercial customers, strictly restricted to BUSINESS workspaces.
--       * PERSONAL contacts: Personal Ledger contacts, permitted in both PERSONAL and BUSINESS workspaces.
--   - Preserves workspace isolation, member authorization, and RLS policies.
-- Status: PREPARED LOCALLY (PENDING EXPLICIT USER AUTHORIZATION BEFORE REMOTE PRODUCTION ROLLOUT)

CREATE OR REPLACE FUNCTION public.resolve_reseller_customer_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_is_user_active BOOLEAN := false;
    v_ws_type TEXT;
    v_ws_active BOOLEAN;
    v_matched_count INT;
    v_resolved_ws_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Service role / background maintenance
    IF v_user_id IS NULL THEN
        IF NEW.workspace_id IS NOT NULL THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Authentication required: caller identity cannot be verified and no workspace_id provided.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Verify caller profile
    SELECT is_active, (system_role = 'SUPER_ADMIN')
    INTO v_is_user_active, v_is_super_admin
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_user_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Account suspended: active account required for customer management.'
            USING ERRCODE = '42501';
    END IF;

    -- Normalize contact_type: default to BUSINESS if null/empty
    IF NEW.contact_type IS NULL OR NEW.contact_type = '' THEN
        NEW.contact_type := 'BUSINESS';
    END IF;

    -- Validate contact_type enum
    IF NEW.contact_type NOT IN ('BUSINESS', 'PERSONAL') THEN
        RAISE EXCEPTION 'Invalid contact_type: must be BUSINESS or PERSONAL.'
            USING ERRCODE = '42501';
    END IF;

    -- Case A: Explicit workspace_id provided
    IF NEW.workspace_id IS NOT NULL THEN
        SELECT workspace_type, is_active
        INTO v_ws_type, v_ws_active
        FROM public.workspaces
        WHERE id = NEW.workspace_id;

        IF v_ws_type IS NULL THEN
            RAISE EXCEPTION 'Invalid workspace: specified workspace does not exist.'
                USING ERRCODE = '42501';
        END IF;

        IF v_ws_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Workspace inactive: cannot add customers to a deactivated workspace.'
                USING ERRCODE = '42501';
        END IF;

        -- Business contacts require a BUSINESS workspace (cannot be created in PERSONAL workspace).
        -- Personal contacts are permitted in both PERSONAL and BUSINESS workspaces.
        IF NEW.contact_type = 'BUSINESS' AND v_ws_type <> 'BUSINESS' THEN
            RAISE EXCEPTION 'Workspace type mismatch: customer contact_type is BUSINESS but workspace is %.', v_ws_type
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_is_super_admin THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = NEW.workspace_id
                  AND wm.user_id = v_user_id
                  AND wm.is_active = true
            ) THEN
                RAISE EXCEPTION 'Unauthorized workspace: caller is not an active member of workspace %.', NEW.workspace_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- Case B: Unspecified workspace_id -> resolve based on contact_type
    IF NEW.contact_type = 'BUSINESS' THEN
        SELECT COUNT(DISTINCT w.id)
        INTO v_matched_count
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = v_user_id
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'BUSINESS';

        IF v_matched_count = 0 THEN
            RAISE EXCEPTION 'No authorized BUSINESS workspace: caller is not an active member of any business workspace.'
                USING ERRCODE = '42501';
        END IF;

        IF v_matched_count > 1 THEN
            RAISE EXCEPTION 'Ambiguous BUSINESS workspace membership: caller belongs to multiple active business workspaces. Explicit workspace_id is required.'
                USING ERRCODE = '42501';
        END IF;

        SELECT w.id
        INTO v_resolved_ws_id
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = v_user_id
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'BUSINESS'
        LIMIT 1;

        NEW.workspace_id := v_resolved_ws_id;
        RETURN NEW;
    ELSE
        -- contact_type = 'PERSONAL'
        -- 1. Prefer caller's active PERSONAL workspace if one exists
        SELECT COUNT(DISTINCT w.id)
        INTO v_matched_count
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = v_user_id
          AND wm.is_active = true
          AND w.is_active = true
          AND w.workspace_type = 'PERSONAL';

        IF v_matched_count = 1 THEN
            SELECT w.id
            INTO v_resolved_ws_id
            FROM public.workspaces w
            JOIN public.workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = v_user_id
              AND wm.is_active = true
              AND w.is_active = true
              AND w.workspace_type = 'PERSONAL'
            LIMIT 1;

            NEW.workspace_id := v_resolved_ws_id;
            RETURN NEW;
        ELSIF v_matched_count > 1 THEN
            RAISE EXCEPTION 'Ambiguous PERSONAL workspace membership: caller belongs to multiple active personal workspaces. Explicit workspace_id is required.'
                USING ERRCODE = '42501';
        END IF;

        -- 2. If caller has no personal workspace, check total active workspaces
        SELECT COUNT(DISTINCT w.id)
        INTO v_matched_count
        FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = v_user_id
          AND wm.is_active = true
          AND w.is_active = true;

        IF v_matched_count = 0 THEN
            RAISE EXCEPTION 'No authorized workspace: caller is not an active member of any workspace.'
                USING ERRCODE = '42501';
        ELSIF v_matched_count = 1 THEN
            SELECT w.id
            INTO v_resolved_ws_id
            FROM public.workspaces w
            JOIN public.workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = v_user_id
              AND wm.is_active = true
              AND w.is_active = true
            LIMIT 1;

            NEW.workspace_id := v_resolved_ws_id;
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Ambiguous workspace membership: caller has no personal workspace and belongs to multiple active workspaces. Explicit workspace_id is required.'
                USING ERRCODE = '42501';
        END IF;
    END IF;
END;
$$;

ALTER FUNCTION public.resolve_reseller_customer_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_reseller_customer_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_reseller_customer_workspace() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_resolve_reseller_customer_workspace ON public.reseller_customers;
CREATE TRIGGER trg_resolve_reseller_customer_workspace
BEFORE INSERT ON public.reseller_customers
FOR EACH ROW
EXECUTE FUNCTION public.resolve_reseller_customer_workspace();

NOTIFY pgrst, 'reload schema';

