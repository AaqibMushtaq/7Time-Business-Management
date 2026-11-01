import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useModuleAccess } from "./useModuleAccess"
import * as AuthHook from "@/components/auth/useAuth"

vi.mock("@/components/auth/useAuth")

describe("useModuleAccess Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("grants all modules and root route when user is SUPER_ADMIN", () => {
    vi.spyOn(AuthHook, "useAuth").mockReturnValue({
      user: { id: "admin-id", email: "admin@7time.com" } as any,
      profile: { id: "admin-id", system_role: "SUPER_ADMIN", is_active: true } as any,
      isAdmin: true,
      loading: false,
      entitlements: {} as any,
      workspaces: [],
      currentWorkspace: null,
      session: null,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    })

    const { result } = renderHook(() => useModuleAccess())

    expect(result.current.isAdmin).toBe(true)
    expect(result.current.hasModule("purchases")).toBe(true)
    expect(result.current.hasModule("personal_ledger")).toBe(true)
    expect(result.current.hasModule("zakat_tracker")).toBe(true)
    expect(result.current.hasAnyModule).toBe(true)
    expect(result.current.getDefaultRoute()).toBe("/")
  })

  it("evaluates specific entitlements for standard user", () => {
    vi.spyOn(AuthHook, "useAuth").mockReturnValue({
      user: { id: "user-1", email: "personal@7time.com" } as any,
      profile: { id: "user-1", system_role: "USER", is_active: true } as any,
      isAdmin: false,
      loading: false,
      entitlements: {
        personal_ledger: true,
        zakat_tracker: false,
        purchases: false,
      } as any,
      workspaces: [],
      currentWorkspace: null,
      session: null,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    })

    const { result } = renderHook(() => useModuleAccess())

    expect(result.current.isAdmin).toBe(false)
    expect(result.current.hasModule("personal_ledger")).toBe(true)
    expect(result.current.hasModule("purchases")).toBe(false)
    expect(result.current.hasModule("zakat_tracker")).toBe(false)
    expect(result.current.hasAnyModule).toBe(true)
    expect(result.current.enabledModules).toEqual(["personal_ledger"])
    expect(result.current.getDefaultRoute()).toBe("/local-customers")
  })

  it("correctly identifies zero-entitlement user and resolves no-access route", () => {
    vi.spyOn(AuthHook, "useAuth").mockReturnValue({
      user: { id: "user-2", email: "empty@7time.com" } as any,
      profile: { id: "user-2", system_role: "USER", is_active: true } as any,
      isAdmin: false,
      loading: false,
      entitlements: {} as any,
      workspaces: [],
      currentWorkspace: null,
      session: null,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    })

    const { result } = renderHook(() => useModuleAccess())

    expect(result.current.isAdmin).toBe(false)
    expect(result.current.hasAnyModule).toBe(false)
    expect(result.current.enabledModules).toEqual([])
    expect(result.current.hasModule("dealers")).toBe(false)
    expect(result.current.getDefaultRoute()).toBe("/no-access")
  })

  it("handles unauthenticated or isolated component test contexts safely without crashing", () => {
    vi.spyOn(AuthHook, "useAuth").mockReturnValue({
      user: null,
      profile: null,
      isAdmin: false,
      loading: true,
      entitlements: {} as any,
      workspaces: [],
      currentWorkspace: null,
      session: null,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    })

    const { result } = renderHook(() => useModuleAccess())

    expect(result.current.loading).toBe(false) // does not block when user is null
    expect(result.current.hasAnyModule).toBe(true)
    expect(result.current.hasModule("wholesale_sales")).toBe(true)
  })
})

