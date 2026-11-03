/**
 * 7TIME Multi-Account Workspace Utilities
 * Centralized, deterministic logic for personal workspace naming, validation, and synchronization.
 */

/**
 * Safely formats a personal workspace name following 7TIME platform conventions:
 * Expected format: `{current_full_name}'s Workspace`
 *
 * Rules:
 * - Uses clean, trimmed full name if available and at least 2 characters.
 * - If full name is absent or whitespace, falls back to formatted email username (local part).
 * - If email is absent or invalid, falls back to neutral "Personal Workspace".
 * - Never returns undefined, null, empty string, or duplicated apostrophes.
 */
export function formatPersonalWorkspaceName(
  fullName?: string | null,
  email?: string | null
): string {
  const cleanName = fullName?.trim()
  if (cleanName && cleanName.length >= 2) {
    // Avoid double apostrophe if name already ends with 's Workspace (case-insensitive)
    if (cleanName.toLowerCase().endsWith("'s workspace")) {
      return cleanName
    }
    // If the name ends with 's (e.g. "James's"), keep standard English or format
    return `${cleanName}'s Workspace`
  }

  const cleanEmail = email?.trim()
  if (cleanEmail && cleanEmail.includes("@")) {
    const localPart = cleanEmail.split("@")[0]?.trim()
    if (localPart && localPart.length >= 2) {
      // Capitalize first character of localPart for clean visual presentation
      const formatted = localPart.charAt(0).toUpperCase() + localPart.slice(1)
      return `${formatted}'s Workspace`
    }
  }

  return "Personal Workspace"
}

/**
 * Checks whether a workspace is a personal workspace that should track its owner's name.
 */
export function isPersonalWorkspace(workspaceType?: string | null): boolean {
  return workspaceType?.toUpperCase() === "PERSONAL"
}

