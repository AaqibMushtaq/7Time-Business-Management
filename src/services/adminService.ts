import { supabase } from "@/lib/supabase"
import type { ManagedUserAccount, ModuleKey } from "@/types/auth"

/**
 * Robust helper to extract clear, actionable error messages from Supabase Functions.
 * Reads response body from FunctionsHttpError context when available.
 */
async function resolveErrorMessage(error: any, data: any, defaultMessage: string): Promise<string> {
  if (data?.error && typeof data.error === "string") {
    return data.error
  }
  if (error) {
    if (error.context) {
      try {
        if (typeof error.context.json === "function") {
          const clone = typeof error.context.clone === "function" ? error.context.clone() : error.context
          const body = await clone.json()
          if (body?.error && typeof body.error === "string") {
            return body.error
          }
          if (body?.message && typeof body.message === "string") {
            return body.message
          }
        }
      } catch {
        try {
          if (typeof error.context.text === "function") {
            const clone = typeof error.context.clone === "function" ? error.context.clone() : error.context
            const text = await clone.text()
            if (text && text.length > 0 && text.length < 300) {
              return text
            }
          }
        } catch {
          // Fallback if text extraction fails
        }
      }
    }
    if (error.message && typeof error.message === "string" && !error.message.includes("non-2xx")) {
      return error.message
    }
  }
  return defaultMessage
}

export async function listManagedUsers(): Promise<ManagedUserAccount[]> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action: "list_users" },
  })

  if (error || data?.error) {
    const msg = await resolveErrorMessage(error, data, "Failed to load user accounts.")
    throw new Error(msg)
  }

  return data?.users || []
}

export interface CreateUserInput {
  email: string
  password: string
  full_name?: string
  phone?: string
  initial_modules?: ModuleKey[]
}

export async function createManagedUser(input: CreateUserInput): Promise<{ success: boolean; user: any }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "create_user",
      email: input.email.trim(),
      password: input.password,
      full_name: input.full_name?.trim() || "",
      phone: input.phone?.trim() || "",
      initial_modules: input.initial_modules || [],
    },
  })

  if (error || data?.error) {
    const msg = await resolveErrorMessage(error, data, "Failed to create user account.")
    throw new Error(msg)
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
    const msg = await resolveErrorMessage(error, data, "Failed to update module entitlement.")
    throw new Error(msg)
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
    const msg = await resolveErrorMessage(error, data, "Failed to update account status.")
    throw new Error(msg)
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
    const msg = await resolveErrorMessage(error, data, "Failed to reset password.")
    throw new Error(msg)
  }

  return data
}

export async function deleteManagedUser(
  userId: string
): Promise<{ success: boolean; user_id?: string }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "delete_user",
      user_id: userId,
    },
  })

  if (error || data?.error) {
    const msg = await resolveErrorMessage(error, data, "Failed to delete user account.")
    throw new Error(msg)
  }

  return data
}

export interface UpdateUserInput {
  userId: string
  full_name?: string
  email?: string
  phone?: string
}

export async function updateManagedUser(
  input: UpdateUserInput
): Promise<{ success: boolean; user?: any }> {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: {
      action: "update_user",
      user_id: input.userId,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
    },
  })

  if (error || data?.error) {
    const msg = await resolveErrorMessage(error, data, "Failed to update user account.")
    throw new Error(msg)
  }

  return data
}
