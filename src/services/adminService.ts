import { supabase } from "@/lib/supabase"
import type { ManagedUserAccount, ModuleKey } from "@/types/auth"

export async function listManagedUsers(): Promise<ManagedUserAccount[]> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action: "list_users" },
  })

  if (error) {
    throw new Error(error.message || "Failed to load user accounts.")
  }

  return data?.users || []
}

export interface CreateUserInput {
  email: string
  password: string
  full_name?: string
  initial_modules?: ModuleKey[]
}

export async function createManagedUser(input: CreateUserInput): Promise<{ success: boolean; user: any }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "create_user",
      email: input.email.trim(),
      password: input.password,
      full_name: input.full_name?.trim() || "",
      initial_modules: input.initial_modules || [],
    },
  })

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Failed to create user account.")
  }

  return data
}

export async function toggleUserModule(
  userId: string,
  moduleId: ModuleKey,
  isEnabled: boolean
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "toggle_module",
      user_id: userId,
      module_id: moduleId,
      is_enabled: isEnabled,
    },
  })

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Failed to update module permission.")
  }

  return data
}

export async function setAccountActiveStatus(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "set_account_status",
      user_id: userId,
      is_active: isActive,
    },
  })

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Failed to update account status.")
  }

  return data
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "reset_password",
      user_id: userId,
      new_password: newPassword,
    },
  })

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Failed to reset password.")
  }

  return data
}
