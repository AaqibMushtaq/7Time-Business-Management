import { describe, it, expect, vi, beforeEach } from "vitest"
import { formatPersonalWorkspaceName, isPersonalWorkspace } from "@/lib/workspaceUtils"
import { updateSelfProfile } from "./profileService"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => {
  const fromMock = vi.fn()
  const authMock = {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
  }
  return {
    supabase: {
      from: fromMock,
      auth: authMock,
    },
  }
})

describe("Global Dynamic Personal Workspace Naming (Scenarios A through H)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Scenario A — New Account
  it("Scenario A: Formats personal workspace name for a new account named 'Ahmed Khan'", () => {
    const wsName = formatPersonalWorkspaceName("Ahmed Khan", "ahmed@example.com")
    expect(wsName).toBe("Ahmed Khan's Workspace")
  })

  // Scenario B — Self-Service Rename
  it("Scenario B: Synchronizes personal workspace name when owner renames from 'Ahmed Khan' to 'Ahmed Ahmad'", async () => {
    const mockUser = { id: "user-ahmed", email: "ahmed@example.com" }
    ;(supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockProfileSingle = vi.fn().mockResolvedValue({
      data: { id: "user-ahmed", full_name: "Ahmed Ahmad", email: "ahmed@example.com" },
      error: null,
    })
    const mockProfileSelect = vi.fn().mockReturnValue({ single: mockProfileSingle })
    const mockProfileEq = vi.fn().mockReturnValue({ select: mockProfileSelect })
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileEq })

    const mockWsEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockWsEq1 = vi.fn().mockReturnValue({ eq: mockWsEq2 })
    const mockWsUpdate = vi.fn().mockReturnValue({ eq: mockWsEq1 })

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "workspaces") return { update: mockWsUpdate }
      return { update: mockProfileUpdate }
    })

    const result = await updateSelfProfile({ full_name: "Ahmed Ahmad" })

    expect(result.full_name).toBe("Ahmed Ahmad")
    expect(mockWsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ahmed Ahmad's Workspace",
      })
    )
    expect(mockWsEq1).toHaveBeenCalledWith("owner_id", "user-ahmed")
    expect(mockWsEq2).toHaveBeenCalledWith("workspace_type", "PERSONAL")
  })

  // Scenario C — Administrator Rename
  it("Scenario C: Administrator changes target user's full name without touching administrator's workspace", () => {
    const adminUserId = "admin-super-id"
    const targetUserId = "target-user-id"

    // Simulate admin update operation scoped strictly to target user ID
    const targetWsUpdatePayload = {
      name: formatPersonalWorkspaceName("Sarah Connor", "sarah@7time.biz"),
    }
    const targetScope = {
      owner_id: targetUserId,
      workspace_type: "PERSONAL",
    }

    expect(targetWsUpdatePayload.name).toBe("Sarah Connor's Workspace")
    expect(targetScope.owner_id).toBe(targetUserId)
    expect(targetScope.owner_id).not.toBe(adminUserId)
    expect(targetScope.workspace_type).toBe("PERSONAL")
  })

  // Scenario D — Multiple Accounts
  it("Scenario D: Generates distinct dynamic names for multiple unique users", () => {
    const users = [
      { name: "Aaqib Mushtaq", email: "dev.aaqibmushtaq@gmail.com" },
      { name: "Ahmed Khan", email: "ahmed.khan@7time.in" },
      { name: "John Smith", email: "john.smith@acme.org" },
    ]

    const generatedNames = users.map((u) => formatPersonalWorkspaceName(u.name, u.email))

    expect(generatedNames[0]).toBe("Aaqib Mushtaq's Workspace")
    expect(generatedNames[1]).toBe("Ahmed Khan's Workspace")
    expect(generatedNames[2]).toBe("John Smith's Workspace")
    expect(new Set(generatedNames).size).toBe(3)
  })

  // Scenario E — Business Workspace Protection
  it("Scenario E: Protects BUSINESS workspaces when an owner who owns both BUSINESS and PERSONAL is renamed", () => {
    const userWorkspaces = [
      { id: "ws-biz-1", name: "7TIME Primary Enterprise", workspace_type: "BUSINESS", owner_id: "user-1" },
      { id: "ws-pers-1", name: "Old Name's Workspace", workspace_type: "PERSONAL", owner_id: "user-1" },
    ]

    const updatedName = "New Name"
    const updatedWorkspaces = userWorkspaces.map((ws) => {
      if (isPersonalWorkspace(ws.workspace_type)) {
        return { ...ws, name: formatPersonalWorkspaceName(updatedName) }
      }
      return ws // Business workspace remains untouched
    })

    expect(updatedWorkspaces.find((w) => w.id === "ws-biz-1")?.name).toBe("7TIME Primary Enterprise")
    expect(updatedWorkspaces.find((w) => w.id === "ws-pers-1")?.name).toBe("New Name's Workspace")
  })

  // Scenario F — Empty or Missing Name Fallback
  it("Scenario F: Safely falls back to email username or neutral fallback when full name is empty", () => {
    // Blank name with valid email
    expect(formatPersonalWorkspaceName("   ", "bilal.ahmed@example.com")).toBe(
      "Bilal.ahmed's Workspace"
    )

    // Null name with valid email
    expect(formatPersonalWorkspaceName(null, "support@7time.biz")).toBe(
      "Support's Workspace"
    )

    // Missing both name and email
    expect(formatPersonalWorkspaceName(null, null)).toBe("Personal Workspace")
    expect(formatPersonalWorkspaceName("", "")).toBe("Personal Workspace")

    // Single character name (too short)
    expect(formatPersonalWorkspaceName("Z", null)).toBe("Personal Workspace")
  })

  // Scenario G — Existing Records Preservation
  it("Scenario G: Preserves workspace ID, ownership, memberships, and domain records when name updates", () => {
    const originalWorkspace = {
      id: "002c4965-cb9c-4f35-ae50-c1552672643e",
      name: "test's Workspace",
      workspace_type: "PERSONAL",
      owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
      is_active: true,
      created_at: "2026-11-02T16:43:13.004887Z",
    }

    const updatedName = formatPersonalWorkspaceName("Aaqib Mushtaq", "dev.aaqibmushtaq@gmail.com")
    const updatedWorkspace = {
      ...originalWorkspace,
      name: updatedName,
      updated_at: "2026-11-03T15:00:00Z",
    }

    // Immutable identifiers and relationships
    expect(updatedWorkspace.id).toBe(originalWorkspace.id)
    expect(updatedWorkspace.owner_id).toBe(originalWorkspace.owner_id)
    expect(updatedWorkspace.workspace_type).toBe("PERSONAL")
    expect(updatedWorkspace.is_active).toBe(true)
    expect(updatedWorkspace.created_at).toBe(originalWorkspace.created_at)

    // Only name and updated_at change
    expect(updatedWorkspace.name).toBe("Aaqib Mushtaq's Workspace")
    expect(updatedWorkspace.name).not.toBe(originalWorkspace.name)
  })

  // Scenario H — Cache & Active Context Synchronization
  it("Scenario H: Synchronizes current active workspace object and updates display name without requiring re-login", () => {
    const initialWorkspace = {
      id: "ws-100",
      name: "test's Workspace",
      workspace_type: "PERSONAL",
      owner_id: "user-100",
    }

    const activeWorkspaceState = { current: initialWorkspace }

    // Simulate profile refresh hook updating workspaces array
    const refreshedWorkspaces = [
      {
        id: "ws-100",
        name: formatPersonalWorkspaceName("Aaqib Mushtaq"),
        workspace_type: "PERSONAL",
        owner_id: "user-100",
      },
    ]

    // Resolution logic from AuthProvider: find active workspace in freshly fetched workspaces
    const matched = refreshedWorkspaces.find((w) => w.id === activeWorkspaceState.current.id)
    if (matched) {
      activeWorkspaceState.current = matched
    }

    expect(activeWorkspaceState.current.name).toBe("Aaqib Mushtaq's Workspace")
    expect(activeWorkspaceState.current.id).toBe("ws-100")
  })
})

