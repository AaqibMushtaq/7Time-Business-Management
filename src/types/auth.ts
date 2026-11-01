export type SystemRole = "SUPER_ADMIN" | "ADMIN" | "USER"

export type WorkspaceType = "BUSINESS" | "PERSONAL"
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

export type ModuleCategory = "PERSONAL" | "BUSINESS" | "OTHER"

export type ModuleKey =
  | "personal_ledger"
  | "zakat_tracker"
  | "dealers"
  | "products"
  | "price_calculator"
  | "purchases"
  | "dealer_payments"
  | "inventory"
  | "wholesale_sales"
  | "deliveries"
  | "reports"
  | "ai_assistant"

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  system_role: SystemRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  workspace_type: WorkspaceType
  owner_id: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface ModuleCatalogItem {
  id: ModuleKey
  name: string
  category: ModuleCategory
  description: string | null
  icon_name: string | null
  default_route: string
  sort_order: number
  is_active: boolean
}

export interface UserModuleEntitlement {
  id: string
  user_id: string
  module_id: ModuleKey
  is_enabled: boolean
  granted_by: string | null
  granted_at: string
}

export interface ManagedUserAccount {
  id: string
  email: string
  full_name: string
  system_role: SystemRole
  is_active: boolean
  created_at: string
  last_sign_in_at?: string | null
  entitlements: Array<{
    module_id: ModuleKey
    is_enabled: boolean
  }>
  workspaces: Array<{
    id: string
    name: string
    workspace_type: WorkspaceType
  }>
}
