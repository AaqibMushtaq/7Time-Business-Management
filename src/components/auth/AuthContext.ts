import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile, Workspace, ModuleKey } from "@/types/auth";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  entitlements: Record<ModuleKey, boolean>;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  workspaces: [],
  currentWorkspace: null,
  entitlements: {} as Record<ModuleKey, boolean>,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  setCurrentWorkspace: () => {},
});
