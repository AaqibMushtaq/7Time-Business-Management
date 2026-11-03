import { useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AuthContext } from "./AuthContext";
import type { UserProfile, Workspace, ModuleKey } from "@/types/auth";
import { formatPersonalWorkspaceName } from "@/lib/workspaceUtils";

const WORKSPACE_STORAGE_KEY = "7time_active_workspace_id";

const hasStoredSession =
  typeof window !== "undefined" &&
  typeof localStorage !== "undefined" &&
  Object.keys(localStorage).some(
    (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
  );

const ALL_MODULES: ModuleKey[] = [
  "personal_ledger",
  "zakat_tracker",
  "dealers",
  "products",
  "price_calculator",
  "purchases",
  "dealer_payments",
  "inventory",
  "wholesale_sales",
  "deliveries",
  "reports",
  "ai_assistant",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [entitlements, setEntitlements] = useState<Record<ModuleKey, boolean>>({} as Record<ModuleKey, boolean>);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(hasStoredSession);

  const fetchUserData = useCallback(async (currentUser: User) => {
    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn("Failed to fetch user profile:", profileErr.message);
      }

      const userProfile = profileData as UserProfile | null;
      setProfile(userProfile);

      const isSuperAdmin = userProfile?.system_role === "SUPER_ADMIN";
      setIsAdmin(isSuperAdmin);

      // Check account active status
      if (userProfile && userProfile.is_active === false) {
        await supabase.auth.signOut();
        alert("Your account has been deactivated by the administrator.");
        return;
      }

      // 2. Fetch User Module Entitlements
      const { data: entData, error: entErr } = await supabase
        .from("user_module_entitlements")
        .select("module_id, is_enabled")
        .eq("user_id", currentUser.id);

      if (entErr) {
        console.warn("Failed to fetch entitlements:", entErr.message);
      }

      const entMap: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>;

      // Initialize all modules to false
      for (const m of ALL_MODULES) {
        entMap[m] = isSuperAdmin ? true : false;
      }

      // Apply explicitly configured entitlements
      if (Array.isArray(entData)) {
        for (const item of entData) {
          if (item.module_id) {
            entMap[item.module_id as ModuleKey] = isSuperAdmin ? true : !!item.is_enabled;
          }
        }
      }

      setEntitlements(entMap);

      // 3. Fetch Enrolled Workspaces
      const { data: memberData, error: memberErr } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, is_active, workspaces(*)")
        .eq("user_id", currentUser.id)
        .eq("is_active", true);

      if (memberErr) {
        console.warn("Failed to fetch workspaces:", memberErr.message);
      }

      const userWorkspaces: Workspace[] = [];
      if (Array.isArray(memberData)) {
        for (const m of memberData) {
          if (m.workspaces && typeof m.workspaces === "object") {
            const ws = { ...(m.workspaces as unknown as Workspace) };
            // Enforce global dynamic personal workspace naming synchronized with owner profile
            if (ws.workspace_type === "PERSONAL" && ws.owner_id === currentUser.id && userProfile) {
              const authoritativeName = formatPersonalWorkspaceName(userProfile.full_name, currentUser.email);
              if (ws.name !== authoritativeName) {
                // Asynchronously synchronize the authoritative database record via Supabase client
                supabase
                  .from("workspaces")
                  .update({ name: authoritativeName })
                  .eq("id", ws.id)
                  .eq("owner_id", currentUser.id)
                  .eq("workspace_type", "PERSONAL")
                  .then(({ error: syncErr }) => {
                    if (syncErr) {
                      console.warn("Personal workspace auto-sync notice:", syncErr.message);
                    }
                  });
                // Update local representation immediately so all consuming components receive the correct name
                ws.name = authoritativeName;
              }
            }
            userWorkspaces.push(ws);
          }
        }
      }

      setWorkspaces(userWorkspaces);
      if (userWorkspaces.length > 0) {
        const storedId = typeof localStorage !== "undefined" ? localStorage.getItem(WORKSPACE_STORAGE_KEY) : null;
        const matched = storedId ? userWorkspaces.find((w) => w.id === storedId) : null;
        const resolved = matched || userWorkspaces[0];
        setCurrentWorkspace(resolved);
        if (typeof localStorage !== "undefined" && resolved) {
          localStorage.setItem(WORKSPACE_STORAGE_KEY, resolved.id);
        }
      } else {
        setCurrentWorkspace(null);
      }
    } catch (err) {
      console.error("Error loading user context:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserData(user);
      await queryClient.invalidateQueries();
    }
  }, [user, fetchUserData, queryClient]);

  useEffect(() => {
    let isMounted = true;

    // Get active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserData(currentUser);
      } else {
        setProfile(null);
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setEntitlements({} as Record<ModuleKey, boolean>);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserData(currentUser);
      } else {
        setProfile(null);
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setEntitlements({} as Record<ModuleKey, boolean>);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const handleSetCurrentWorkspace = useCallback(
    async (workspace: Workspace | null) => {
      if (workspace) {
        const isAuthorized = workspaces.some((w) => w.id === workspace.id) || isAdmin;
        if (!isAuthorized) {
          console.warn("Unauthorized workspace switch rejected:", workspace.id);
          return;
        }
        // Abort in-flight queries from previous workspace to prevent stale data overwrites
        await queryClient.cancelQueries();
        setCurrentWorkspace(workspace);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
        }
        // Invalidate active query cache to immediately refresh authorized workspace data
        queryClient.invalidateQueries();
      } else {
        await queryClient.cancelQueries();
        setCurrentWorkspace(null);
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        }
        queryClient.invalidateQueries();
      }
    },
    [workspaces, isAdmin, queryClient]
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
    queryClient.clear();
    setUser(null);
    setSession(null);
    setProfile(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    setEntitlements({} as Record<ModuleKey, boolean>);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        workspaces,
        currentWorkspace,
        entitlements,
        isAdmin,
        loading,
        signOut,
        refreshProfile,
        setCurrentWorkspace: handleSetCurrentWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
