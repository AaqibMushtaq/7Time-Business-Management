import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/types/auth"
import { formatPersonalWorkspaceName } from "@/lib/workspaceUtils"

export interface UpdateProfileParams {
  full_name: string
  phone?: string | null
}

export interface EmailChangeResult {
  pendingEmail?: string
  requiresConfirmation: boolean
  message: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/

/**
 * Validates a phone number format if provided.
 */
export function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim()
  if (!trimmed) return true
  return PHONE_REGEX.test(trimmed)
}

/**
 * Validates email address format.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Validates password strength according to application policy:
 * - At least 8 characters
 * - At least one letter and at least one number
 */
export function validatePasswordPolicy(password: string): { isValid: boolean; message?: string } {
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long." }
  }
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return { isValid: false, message: "Password must contain at least one letter and one number." }
  }
  return { isValid: true }
}

/**
 * Updates the authenticated user's own profile (full_name and phone).
 * Security: Enforced via Supabase RLS (profiles_update_policy: auth.uid() = id).
 */
export async function updateSelfProfile(params: UpdateProfileParams): Promise<UserProfile> {
  const trimmedName = params.full_name?.trim()
  if (!trimmedName) {
    throw new Error("Full name is required.")
  }

  const trimmedPhone = params.phone?.trim() || null
  if (trimmedPhone && !isValidPhone(trimmedPhone)) {
    throw new Error("Please enter a valid phone number (e.g. +91 98765 43210).")
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    throw new Error("Active authenticated session is required to update profile.")
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: trimmedName,
      phone: trimmedPhone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message || "Failed to update profile.")
  }

  // Synchronize owner's PERSONAL workspace name
  const newWsName = formatPersonalWorkspaceName(trimmedName, user.email)
  const { error: wsError } = await supabase
    .from("workspaces")
    .update({
      name: newWsName,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", user.id)
    .eq("workspace_type", "PERSONAL")

  if (wsError) {
    console.warn("Failed to synchronize personal workspace name:", wsError.message)
  }

  return data as UserProfile
}

/**
 * Verifies current password by reauthenticating with Supabase Auth.
 * Does not store or log plaintext credentials.
 */
export async function verifyCurrentPassword(currentPassword: string): Promise<boolean> {
  if (!currentPassword) {
    throw new Error("Current password is required.")
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user || !user.email) {
    throw new Error("Active authenticated session is required.")
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (error) {
    throw new Error("Incorrect current password. Please enter your valid current password to proceed.")
  }

  return true
}

/**
 * Changes the current user's password after verifying their current password.
 */
export async function changeSelfPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!currentPassword) {
    throw new Error("Current password is required.")
  }

  const policy = validatePasswordPolicy(newPassword)
  if (!policy.isValid) {
    throw new Error(policy.message || "New password does not meet security requirements.")
  }

  if (currentPassword === newPassword) {
    throw new Error("New password must be different from your current password.")
  }

  // 1. Reauthenticate current user
  await verifyCurrentPassword(currentPassword)

  // 2. Apply new password via Supabase Auth
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    throw new Error(error.message || "Failed to update password.")
  }
}

/**
 * Initiates an email change flow for the authenticated user after reauthenticating.
 * Adheres to Supabase Auth confirmation settings without premature profile email mutations.
 */
export async function initiateSelfEmailChange(
  currentPassword: string,
  newEmail: string
): Promise<EmailChangeResult> {
  if (!currentPassword) {
    throw new Error("Current password is required to change your email address.")
  }

  const trimmedEmail = newEmail.trim().toLowerCase()
  if (!isValidEmail(trimmedEmail)) {
    throw new Error("Please enter a valid email address.")
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user || !user.email) {
    throw new Error("Active authenticated session is required.")
  }

  if (user.email.toLowerCase() === trimmedEmail) {
    throw new Error("New email address must be different from your current email address.")
  }

  // 1. Reauthenticate current user with current password
  await verifyCurrentPassword(currentPassword)

  // 2. Initiate email update via Supabase Auth
  const { data, error } = await supabase.auth.updateUser({
    email: trimmedEmail,
  })

  if (error) {
    throw new Error(error.message || "Failed to initiate email change.")
  }

  // 3. Inspect confirmation status
  const pendingEmail = data.user?.new_email
  if (pendingEmail) {
    return {
      pendingEmail,
      requiresConfirmation: true,
      message: `A confirmation link has been sent to ${pendingEmail}. Please check your inbox and confirm the link to finalize your new email address. Your current login email remains active until confirmed.`,
    }
  }

  // If Supabase immediately updated the email (e.g. email change confirmation disabled)
  if (data.user?.email && data.user.email.toLowerCase() === trimmedEmail) {
    // Keep profiles table email in sync
    await supabase
      .from("profiles")
      .update({
        email: data.user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    return {
      requiresConfirmation: false,
      message: "Email address updated successfully.",
    }
  }

  return {
    requiresConfirmation: true,
    message: `Verification email sent to ${trimmedEmail}. Please check your inbox to complete the change.`,
  }
}

