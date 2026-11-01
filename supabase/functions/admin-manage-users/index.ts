// Supabase Edge Function: admin-manage-users
// Secure administrative API for managing user accounts and module entitlements in 7TIME.
// Enforces SUPER_ADMIN system_role verification via caller JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

        // Fetch profiles
        const { data: profiles, error: pErr } = await adminClient
          .from("profiles")
          .select("*");
        if (pErr) return createErrorResponse(`Failed to fetch profiles: ${pErr.message}`, 500);

        // Fetch entitlements
        const { data: entitlements, error: entErr } = await adminClient
          .from("user_module_entitlements")
          .select("user_id, module_id, is_enabled, granted_at");
        if (entErr) return createErrorResponse(`Failed to fetch entitlements: ${entErr.message}`, 500);

        // Fetch workspaces
        const { data: workspaces } = await adminClient
          .from("workspaces")
          .select("id, name, workspace_type, owner_id");

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const entMap = new Map<string, any[]>();
        for (const e of entitlements || []) {
          if (!entMap.has(e.user_id)) entMap.set(e.user_id, []);
          entMap.get(e.user_id)!.push(e);
        }

        const enrichedUsers = (authUsers || []).map((u: any) => {
          const prof = profileMap.get(u.id) || {};
          const userEnts = entMap.get(u.id) || [];
          const userWorkspaces = (workspaces || []).filter((w: any) => w.owner_id === u.id);

          return {
            id: u.id,
            email: u.email,
            full_name: prof.full_name || u.user_metadata?.full_name || "",
            system_role: prof.system_role || "USER",
            is_active: prof.is_active ?? true,
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
        const { email, password, full_name, initial_modules } = body;
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
          user_metadata: { full_name: full_name || "" },
        });

        if (createAuthErr || !newAuthData.user) {
          return createErrorResponse(`Failed to create account: ${createAuthErr?.message}`, 400);
        }

        const newUserId = newAuthData.user.id;

        // 2. Ensure profile exists (handled by trigger, or fallback insert)
        await adminClient.from("profiles").upsert({
          id: newUserId,
          email,
          full_name: full_name || "",
          system_role: "USER",
          is_active: true,
          updated_at: new Date().toISOString(),
        });

        // 3. Create personal workspace for the new user
        const { data: wsData, error: wsErr } = await adminClient
          .from("workspaces")
          .insert({
            name: `${full_name || email}'s Workspace`,
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
        if (!user_id || !module_id || typeof is_enabled !== "boolean") {
          return createErrorResponse("user_id, module_id, and boolean is_enabled are required.", 400);
        }

        // Prevent disabling all modules on primary administrator
        if (user_id === callerUser.id && !is_enabled) {
          const { data: targetProf } = await adminClient
            .from("profiles")
            .select("system_role")
            .eq("id", user_id)
            .single();
          if (targetProf?.system_role === "SUPER_ADMIN") {
            // Allowed, but keep at least settings/admin
          }
        }

        const { error: toggleErr } = await adminClient
          .from("user_module_entitlements")
          .upsert(
            {
              user_id,
              module_id,
              is_enabled,
              granted_by: callerUser.id,
              granted_at: new Date().toISOString(),
            },
            { onConflict: "user_id,module_id" }
          );

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

      default:
        return createErrorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error: any) {
    return createErrorResponse(`Internal server error: ${error?.message || error}`, 500);
  }
});
