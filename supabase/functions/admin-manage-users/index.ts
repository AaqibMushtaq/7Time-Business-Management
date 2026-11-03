// Supabase Edge Function: admin-manage-users
// Secure administrative API for managing user accounts and module entitlements in 7TIME.
// Enforces SUPER_ADMIN system_role verification via caller JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Accurate interfaces matching the 7TIME database schema
export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  system_role: "SUPER_ADMIN" | "ADMIN" | "USER" | string;
  is_active: boolean;
  phone?: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  workspace_type: string;
  owner_id: string;
}

export interface EntitlementRecord {
  user_id: string;
  module_id: string;
  is_enabled: boolean;
  granted_at: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function createJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createErrorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatPersonalWorkspaceName(fullName?: string | null, email?: string | null): string {
  const cleanName = fullName?.trim();
  if (cleanName && cleanName.length >= 2) {
    if (cleanName.toLowerCase().endsWith("'s workspace")) {
      return cleanName;
    }
    return `${cleanName}'s Workspace`;
  }

  const cleanEmail = email?.trim();
  if (cleanEmail && cleanEmail.includes("@")) {
    const localPart = cleanEmail.split("@")[0]?.trim();
    if (localPart && localPart.length >= 2) {
      const formatted = localPart.charAt(0).toUpperCase() + localPart.slice(1);
      return `${formatted}'s Workspace`;
    }
  }

  return "Personal Workspace";
}

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // 2. Extract Authorization JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Unauthorized. Missing authorization token.", 401);
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return createErrorResponse("Server configuration error: missing Supabase credentials.", 500);
    }

    // Client scoped to caller for identity verification
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser(jwt);
    if (callerError || !callerUser) {
      return createErrorResponse(`Authentication failed: ${callerError?.message || "Invalid session"}`, 401);
    }

    // Privileged admin client with service_role key
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3. Verify that caller is active SUPER_ADMIN in public.profiles
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, system_role, is_active")
      .eq("id", callerUser.id)
      .single();

    if (profileErr || !callerProfile) {
      return createErrorResponse("Access denied. Caller profile not found.", 403);
    }

    if (!callerProfile.is_active || callerProfile.system_role !== "SUPER_ADMIN") {
      return createErrorResponse("Forbidden. Only active Super Administrators may perform this action.", 403);
    }

    // 4. Parse request payload
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    switch (action) {
      // ----------------------------------------------------------------------
      // ACTION: list_users
      // ----------------------------------------------------------------------
      case "list_users": {
        // Fetch auth users
        const { data: { users: authUsers }, error: authErr } = await adminClient.auth.admin.listUsers({
          perPage: 100,
        });
        if (authErr) return createErrorResponse(`Failed to list users: ${authErr.message}`, 500);

        // Fetch profiles - selecting columns verified to exist in the database schema
        const { data: profiles, error: pErr } = await adminClient
          .from("profiles")
          .select("id, email, full_name, system_role, is_active");
        if (pErr) return createErrorResponse(`Failed to fetch profiles: ${pErr.message}`, 500);

        // Fetch entitlements
        const { data: entitlements, error: entErr } = await adminClient
          .from("user_module_entitlements")
          .select("user_id, module_id, is_enabled, granted_at");
        if (entErr) return createErrorResponse(`Failed to fetch entitlements: ${entErr.message}`, 500);

        // Fetch workspaces
        const { data: workspaces, error: wsErr } = await adminClient
          .from("workspaces")
          .select("id, name, workspace_type, owner_id");
        if (wsErr) return createErrorResponse(`Failed to fetch workspaces: ${wsErr.message}`, 500);

        // Build typed lookup maps for resilient mapping
        const profileMap = new Map<string, ProfileRecord>();
        if (profiles && Array.isArray(profiles)) {
          for (const p of profiles as ProfileRecord[]) {
            profileMap.set(p.id, p);
          }
        }

        const entMap = new Map<string, EntitlementRecord[]>();
        if (entitlements && Array.isArray(entitlements)) {
          for (const e of entitlements as EntitlementRecord[]) {
            if (!entMap.has(e.user_id)) entMap.set(e.user_id, []);
            entMap.get(e.user_id)!.push(e);
          }
        }

        const workspaceList: WorkspaceRecord[] = Array.isArray(workspaces)
          ? (workspaces as WorkspaceRecord[])
          : [];

        const enrichedUsers = (authUsers || []).map((u) => {
          const prof = profileMap.get(u.id);
          const userEnts = entMap.get(u.id) || [];
          const userWorkspaces = workspaceList.filter((w) => w.owner_id === u.id);

          return {
            id: u.id,
            email: prof?.email || u.email || "",
            phone: prof?.phone || u.phone || u.user_metadata?.phone || "",
            full_name: prof?.full_name || u.user_metadata?.full_name || "",
            system_role: prof?.system_role || "USER",
            is_active: prof?.is_active ?? true,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            entitlements: userEnts,
            workspaces: userWorkspaces,
          };
        });

        return createJsonResponse({ users: enrichedUsers });
      }

      // ----------------------------------------------------------------------
      // ACTION: create_user
      // ----------------------------------------------------------------------
      case "create_user": {
        const { email, password, full_name, phone, initial_modules } = body;
        if (!email || !password) {
          return createErrorResponse("Email and password are required.", 400);
        }
        if (password.length < 8) {
          return createErrorResponse("Password must be at least 8 characters long.", 400);
        }

        // 1. Create auth user with auto-confirmed email
        const { data: newAuthData, error: createAuthErr } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          phone: phone?.trim() || undefined,
          user_metadata: { full_name: full_name || "", phone: phone?.trim() || "" },
        });

        if (createAuthErr || !newAuthData.user) {
          return createErrorResponse(`Failed to create account: ${createAuthErr?.message}`, 400);
        }

        const newUserId = newAuthData.user.id;

        // 2. Ensure profile exists (handled by trigger, or fallback insert)
        const newProfPayload: Record<string, any> = {
          id: newUserId,
          email,
          full_name: full_name || "",
          system_role: "USER",
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        if (phone?.trim()) {
          newProfPayload.phone = phone.trim();
        }
        await adminClient.from("profiles").upsert(newProfPayload);

        // 3. Create personal workspace for the new user with dynamic naming
        const personalWsName = formatPersonalWorkspaceName(full_name, email);
        const { data: wsData, error: wsErr } = await adminClient
          .from("workspaces")
          .insert({
            name: personalWsName,
            workspace_type: "PERSONAL",
            owner_id: newUserId,
            is_active: true,
          })
          .select("id")
          .single();

        if (wsErr) {
          console.error("Failed to create personal workspace for user:", wsErr);
        }

        if (wsData?.id) {
          await adminClient.from("workspace_members").insert({
            workspace_id: wsData.id,
            user_id: newUserId,
            role: "OWNER",
            is_active: true,
          });
        }

        // 4. Initialize module entitlements (Zero-module default unless specified by admin)
        const { data: catalogModules } = await adminClient
          .from("module_catalog")
          .select("id");

        const selectedModules = new Set(Array.isArray(initial_modules) ? initial_modules : []);
        const entitlementInserts = (catalogModules || []).map((m: any) => ({
          user_id: newUserId,
          module_id: m.id,
          is_enabled: selectedModules.has(m.id),
          granted_by: callerUser.id,
          granted_at: new Date().toISOString(),
        }));

        if (entitlementInserts.length > 0) {
          await adminClient.from("user_module_entitlements").upsert(entitlementInserts, {
            onConflict: "user_id,module_id",
          });
        }

        return createJsonResponse({
          success: true,
          user: {
            id: newUserId,
            email,
            full_name: full_name || "",
            system_role: "USER",
            is_active: true,
          },
        });
      }

      // ----------------------------------------------------------------------
      // ACTION: toggle_module
      // ----------------------------------------------------------------------
      case "toggle_module": {
        const { user_id, module_id, is_enabled } = body;
        if (!user_id || typeof user_id !== "string" || !module_id || typeof module_id !== "string" || typeof is_enabled !== "boolean") {
          return createErrorResponse("user_id (string), module_id (string), and boolean is_enabled are required.", 400);
        }

        // Prevent disabling all modules on primary administrator or Super Admin
        if (user_id === callerUser.id && !is_enabled) {
          return createErrorResponse("Super Administrator accounts permanently retain all module entitlements.", 400);
        }

        const { data: targetProf } = await adminClient
          .from("profiles")
          .select("system_role")
          .eq("id", user_id)
          .maybeSingle();

        if (targetProf?.system_role === "SUPER_ADMIN" && !is_enabled) {
          return createErrorResponse("Super Administrator accounts permanently retain all module entitlements.", 400);
        }

        // Check if an existing entitlement row exists for this user and module
        const { data: existingEnt, error: fetchEntErr } = await adminClient
          .from("user_module_entitlements")
          .select("id")
          .eq("user_id", user_id)
          .eq("module_id", module_id)
          .maybeSingle();

        if (fetchEntErr) {
          console.error("Error checking existing entitlement:", fetchEntErr);
        }

        let toggleErr = null;
        if (existingEnt?.id) {
          const { error: updateErr } = await adminClient
            .from("user_module_entitlements")
            .update({
              is_enabled,
              granted_by: callerUser.id,
              granted_at: new Date().toISOString(),
            })
            .eq("id", existingEnt.id);
          toggleErr = updateErr;
        } else {
          const { error: insertErr } = await adminClient
            .from("user_module_entitlements")
            .insert({
              user_id,
              module_id,
              is_enabled,
              granted_by: callerUser.id,
              granted_at: new Date().toISOString(),
            });
          toggleErr = insertErr;
        }

        if (toggleErr) {
          return createErrorResponse(`Failed to update entitlement: ${toggleErr.message}`, 500);
        }

        return createJsonResponse({ success: true, user_id, module_id, is_enabled });
      }

      // ----------------------------------------------------------------------
      // ACTION: set_account_status
      // ----------------------------------------------------------------------
      case "set_account_status": {
        const { user_id, is_active } = body;
        if (!user_id || typeof is_active !== "boolean") {
          return createErrorResponse("user_id and boolean is_active are required.", 400);
        }

        // Prevent suspending oneself
        if (user_id === callerUser.id) {
          return createErrorResponse("You cannot suspend your own administrator account.", 400);
        }

        // Update profile status
        const { error: pErr } = await adminClient
          .from("profiles")
          .update({ is_active, updated_at: new Date().toISOString() })
          .eq("id", user_id);

        if (pErr) return createErrorResponse(`Failed to update profile status: ${pErr.message}`, 500);

        // Ban or unban auth token in Supabase Auth
        const banDuration = is_active ? "none" : "876600h"; // 100 years ban if suspended
        await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: banDuration,
        });

        return createJsonResponse({ success: true, user_id, is_active });
      }

      // ----------------------------------------------------------------------
      // ACTION: reset_password
      // ----------------------------------------------------------------------
      case "reset_password": {
        const { user_id, new_password } = body;
        if (!user_id || !new_password || new_password.length < 8) {
          return createErrorResponse("user_id and new_password (min 8 chars) are required.", 400);
        }

        const { error: pwErr } = await adminClient.auth.admin.updateUserById(user_id, {
          password: new_password,
        });

        if (pwErr) return createErrorResponse(`Failed to reset password: ${pwErr.message}`, 400);

        return createJsonResponse({ success: true, user_id });
      }

      // ----------------------------------------------------------------------
      // ACTION: update_user / edit_user
      // ----------------------------------------------------------------------
      case "edit_user":
      case "update_user": {
        const { user_id, full_name, email, phone } = body;

        // 1. Validate target user ID (must be valid UUID)
        if (
          !user_id ||
          typeof user_id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)
        ) {
          return createErrorResponse("Valid UUID user_id is required.", 400);
        }

        // 2. Confirm target account exists
        const { data: targetProfile, error: profErr } = await adminClient
          .from("profiles")
          .select("id, system_role, email, full_name")
          .eq("id", user_id)
          .maybeSingle();

        if (profErr || !targetProfile) {
          return createErrorResponse("Target user profile not found.", 404);
        }

        // 3. Validate full_name
        let cleanName: string | undefined = undefined;
        if (full_name !== undefined) {
          if (typeof full_name !== "string" || full_name.trim().length < 2) {
            return createErrorResponse("Full name must be at least 2 characters long.", 400);
          }
          if (full_name.trim().length > 100) {
            return createErrorResponse("Full name cannot exceed 100 characters.", 400);
          }
          cleanName = full_name.trim();
        }

        // 4. Validate email and check duplicates
        let cleanEmail: string | undefined = undefined;
        if (email !== undefined) {
          if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return createErrorResponse("A valid email address is required.", 400);
          }
          const normalizedEmail = email.trim().toLowerCase();
          if (normalizedEmail !== targetProfile.email?.toLowerCase()) {
            // Check for duplicate in profiles table
            const { data: dupProfile } = await adminClient
              .from("profiles")
              .select("id")
              .eq("email", normalizedEmail)
              .neq("id", user_id)
              .maybeSingle();

            if (dupProfile) {
              return createErrorResponse("An account with this email address already exists.", 409);
            }
            cleanEmail = normalizedEmail;
          }
        }

        // 5. Clean phone input (optional)
        let cleanPhone: string | null | undefined = undefined;
        if (phone !== undefined) {
          if (typeof phone === "string") {
            cleanPhone = phone.trim() || null;
          } else if (phone === null) {
            cleanPhone = null;
          } else {
            return createErrorResponse("Phone must be a valid string or null.", 400);
          }
        }

        // 6. Update Supabase Auth user (email and user_metadata)
        const { data: authUserData } = await adminClient.auth.admin.getUserById(user_id);
        const currentMeta = authUserData?.user?.user_metadata || {};

        const authUpdates: Record<string, any> = {
          user_metadata: {
            ...currentMeta,
            ...(cleanName !== undefined ? { full_name: cleanName } : {}),
            ...(cleanPhone !== undefined ? { phone: cleanPhone } : {}),
          },
        };

        if (cleanEmail) {
          authUpdates.email = cleanEmail;
          authUpdates.email_confirm = true;
        }

        const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(
          user_id,
          authUpdates
        );

        if (authUpdateErr) {
          const isDup =
            authUpdateErr.message?.toLowerCase().includes("already") ||
            authUpdateErr.message?.toLowerCase().includes("unique") ||
            (authUpdateErr as any).status === 422;
          return createErrorResponse(
            isDup
              ? "An account with this email address already exists."
              : `Failed to update auth credentials: ${authUpdateErr.message}`,
            isDup ? 409 : 400
          );
        }

        // 7. Verify whether column 'phone' exists on public.profiles before attempting update
        let hasPhoneCol = false;
        try {
          const { error: colErr } = await adminClient
            .from("profiles")
            .select("phone")
            .limit(0);
          hasPhoneCol = !colErr;
        } catch {
          hasPhoneCol = false;
        }

        // 8. Update public.profiles table (strictly updating only supported profile fields)
        const profileUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (cleanName !== undefined) profileUpdates.full_name = cleanName;
        if (cleanEmail !== undefined) profileUpdates.email = cleanEmail;
        if (hasPhoneCol && cleanPhone !== undefined) {
          profileUpdates.phone = cleanPhone;
        }

        const { error: profUpdateErr } = await adminClient
          .from("profiles")
          .update(profileUpdates)
          .eq("id", user_id);

        if (profUpdateErr) {
          return createErrorResponse(`Failed to update profile: ${profUpdateErr.message}`, 500);
        }

        // 8b. Synchronize target user's personal workspace name (never touch business workspaces or other users' workspaces)
        if (cleanName !== undefined && cleanName.length >= 2) {
          const syncWsName = formatPersonalWorkspaceName(cleanName, cleanEmail || targetProfile.email);
          await adminClient
            .from("workspaces")
            .update({
              name: syncWsName,
              updated_at: new Date().toISOString(),
            })
            .eq("owner_id", user_id)
            .eq("workspace_type", "PERSONAL");
        }

        // 9. Return consistent structured response without altering role, memberships, or entitlements
        return createJsonResponse({
          success: true,
          user: {
            id: user_id,
            email: cleanEmail || targetProfile.email,
            full_name: cleanName !== undefined ? cleanName : targetProfile.full_name,
            phone:
              cleanPhone !== undefined
                ? cleanPhone
                : hasPhoneCol
                ? (targetProfile as any).phone
                : currentMeta.phone || null,
          },
        });
      }

      // ----------------------------------------------------------------------
      // ACTION: delete_user / delete_account
      // ----------------------------------------------------------------------
      case "delete_account":
      case "delete_user": {
        const { user_id } = body;
        if (!user_id) {
          return createErrorResponse("user_id is required.", 400);
        }

        // 1. Prevent deleting own administrator account
        if (user_id === callerUser.id) {
          return createErrorResponse("You cannot delete your own administrator account.", 400);
        }

        // 2. Prevent deleting an Enterprise Super Administrator
        const { data: targetProfile, error: profFetchErr } = await adminClient
          .from("profiles")
          .select("id, email, system_role")
          .eq("id", user_id)
          .maybeSingle();

        if (profFetchErr) {
          return createErrorResponse(`Failed to verify target account: ${profFetchErr.message}`, 500);
        }

        if (targetProfile?.system_role === "SUPER_ADMIN") {
          return createErrorResponse("Cannot delete an Enterprise Super Administrator account. Demote the user first.", 400);
        }

        // 3. Handle workspaces owned by target user to prevent ON DELETE RESTRICT constraint violations
        const { data: ownedWorkspaces, error: wsFetchErr } = await adminClient
          .from("workspaces")
          .select("id, name, workspace_type")
          .eq("owner_id", user_id);

        if (wsFetchErr) {
          console.error("Error fetching owned workspaces:", wsFetchErr);
        }

        for (const ws of ownedWorkspaces || []) {
          // Check if workspace contains domain accounting records before deleting
          const [creditsRes, salesRes, purchasesRes, generalRecsRes, naeemRecsRes] = await Promise.all([
            adminClient.from("customer_credits").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
            adminClient.from("wholesale_sales").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
            adminClient.from("purchases").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
            adminClient.from("general_daily_records").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
            adminClient.from("naeem_daily_records").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
          ]);

          const hasData =
            (creditsRes.count || 0) > 0 ||
            (salesRes.count || 0) > 0 ||
            (purchasesRes.count || 0) > 0 ||
            (generalRecsRes.count || 0) > 0 ||
            (naeemRecsRes.count || 0) > 0;

          if (!hasData) {
            // Delete empty workspace and its member relations
            await adminClient.from("workspace_members").delete().eq("workspace_id", ws.id);
            await adminClient.from("workspaces").delete().eq("id", ws.id);
          } else {
            // Reassign workspace ownership to administering Super Admin to preserve company records
            await adminClient
              .from("workspaces")
              .update({ owner_id: callerUser.id, updated_at: new Date().toISOString() })
              .eq("id", ws.id);
          }
        }

        // 4. Remove all workspace memberships for this user
        await adminClient.from("workspace_members").delete().eq("user_id", user_id);

        // 5. Remove all user module entitlements
        await adminClient.from("user_module_entitlements").delete().eq("user_id", user_id);

        // 6. Delete user profile
        const { error: delProfErr } = await adminClient.from("profiles").delete().eq("id", user_id);
        if (delProfErr) {
          console.error("Warning: Profile delete error:", delProfErr);
        }

        // 7. Delete authentication record from Supabase Auth
        const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(user_id);
        if (delAuthErr) {
          return createErrorResponse(`Failed to delete user account: ${delAuthErr.message}`, 500);
        }

        return createJsonResponse({ success: true, user_id });
      }

      default:
        return createErrorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error: any) {
    return createErrorResponse(`Internal server error: ${error?.message || error}`, 500);
  }
});
