import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { WorkspaceSelector } from "./WorkspaceSelector"
import * as authHook from "@/components/auth/useAuth"

vi.mock("@/components/auth/useAuth")

describe("WorkspaceSelector (Header and Sidebar)", () => {
  const mockSetCurrentWorkspace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders authoritative workspace name in header variant", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      workspaces: [
        {
          id: "002c4965-cb9c-4f35-ae50-c1552672643e",
          name: "Aaqib Mushtaq's Workspace",
          workspace_type: "PERSONAL",
          owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
        } as any,
      ],
      currentWorkspace: {
        id: "002c4965-cb9c-4f35-ae50-c1552672643e",
        name: "Aaqib Mushtaq's Workspace",
        workspace_type: "PERSONAL",
        owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
      } as any,
      setCurrentWorkspace: mockSetCurrentWorkspace,
      user: null,
      session: null,
      profile: null,
      entitlements: {} as any,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<WorkspaceSelector variant="header" />)

    expect(screen.getByText("Aaqib Mushtaq's Workspace")).toBeInTheDocument()
    expect(screen.getByText("Personal")).toBeInTheDocument()
    expect(screen.queryByText("test's Workspace")).not.toBeInTheDocument()
  })

  it("renders authoritative workspace name in sidebar variant", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      workspaces: [
        {
          id: "002c4965-cb9c-4f35-ae50-c1552672643e",
          name: "Aaqib Mushtaq's Workspace",
          workspace_type: "PERSONAL",
          owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
        } as any,
      ],
      currentWorkspace: {
        id: "002c4965-cb9c-4f35-ae50-c1552672643e",
        name: "Aaqib Mushtaq's Workspace",
        workspace_type: "PERSONAL",
        owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
      } as any,
      setCurrentWorkspace: mockSetCurrentWorkspace,
      user: null,
      session: null,
      profile: null,
      entitlements: {} as any,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<WorkspaceSelector variant="sidebar" />)

    expect(screen.getByText("Aaqib Mushtaq's Workspace")).toBeInTheDocument()
    expect(screen.getByText("Pers")).toBeInTheDocument()
    expect(screen.queryByText("test's Workspace")).not.toBeInTheDocument()
  })

  it("ensures both header and sidebar render the exact same workspace name when rendered together", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      workspaces: [
        {
          id: "002c4965-cb9c-4f35-ae50-c1552672643e",
          name: "Aaqib Mushtaq's Workspace",
          workspace_type: "PERSONAL",
          owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
        } as any,
      ],
      currentWorkspace: {
        id: "002c4965-cb9c-4f35-ae50-c1552672643e",
        name: "Aaqib Mushtaq's Workspace",
        workspace_type: "PERSONAL",
        owner_id: "d45460a3-c7d3-4223-9f24-676a0d8a4c49",
      } as any,
      setCurrentWorkspace: mockSetCurrentWorkspace,
      user: null,
      session: null,
      profile: null,
      entitlements: {} as any,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(
      <div>
        <WorkspaceSelector variant="header" />
        <WorkspaceSelector variant="sidebar" />
      </div>
    )

    const workspaceElements = screen.getAllByText("Aaqib Mushtaq's Workspace")
    expect(workspaceElements).toHaveLength(2)
  })

  it("renders business workspace type badge properly and preserves workspace ID", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      workspaces: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          name: "7TIME Primary Enterprise",
          workspace_type: "BUSINESS",
          owner_id: "admin-id",
        } as any,
      ],
      currentWorkspace: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "7TIME Primary Enterprise",
        workspace_type: "BUSINESS",
        owner_id: "admin-id",
      } as any,
      setCurrentWorkspace: mockSetCurrentWorkspace,
      user: null,
      session: null,
      profile: null,
      entitlements: {} as any,
      isAdmin: true,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<WorkspaceSelector variant="header" />)

    expect(screen.getByText("7TIME Primary Enterprise")).toBeInTheDocument()
    expect(screen.getByText("Business")).toBeInTheDocument()
  })
})

