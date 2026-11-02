import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { ModuleRouteGuard } from "./ModuleRouteGuard"
import * as ModuleAccessHook from "@/hooks/useModuleAccess"

vi.mock("@/hooks/useModuleAccess")

describe("ModuleRouteGuard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders loader spinner when permissions are loading", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "u1", email: "test@7time.com" } as any,
      profile: { id: "u1", is_active: true } as any,
      isAdmin: false,
      loading: true,
      entitlements: {} as any,
      hasModule: vi.fn().mockReturnValue(false),
      enabledModules: [],
      hasAnyModule: false,
      hasBusinessModules: false,
      hasPersonalModules: false,
      getDefaultRoute: () => "/local-customers",
    } as any)

    render(
      <MemoryRouter>
        <ModuleRouteGuard module="purchases">
          <div>Protected Content</div>
        </ModuleRouteGuard>
      </MemoryRouter>
    )

    expect(screen.getByText(/Verifying Permissions/i)).toBeDefined()
    expect(screen.queryByText("Protected Content")).toBeNull()
  })

  it("displays Account Suspended when profile is inactive", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "u1", email: "suspended@7time.com" } as any,
      profile: { id: "u1", is_active: false } as any,
      isAdmin: false,
      loading: false,
      entitlements: {} as any,
      hasModule: vi.fn().mockReturnValue(false),
      enabledModules: [],
      hasAnyModule: false,
      hasBusinessModules: false,
      hasPersonalModules: false,
      getDefaultRoute: () => "/local-customers",
    } as any)

    render(
      <MemoryRouter>
        <ModuleRouteGuard module="purchases">
          <div>Protected Content</div>
        </ModuleRouteGuard>
      </MemoryRouter>
    )

    expect(screen.getByText("Account Suspended")).toBeDefined()
    expect(screen.getByText(/Your account has been deactivated/i)).toBeDefined()
    expect(screen.queryByText("Protected Content")).toBeNull()
  })

  it("displays No Modules Assigned Yet when user has 0 enabled modules", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "u1", email: "newuser@7time.com" } as any,
      profile: { id: "u1", email: "newuser@7time.com", is_active: true } as any,
      isAdmin: false,
      loading: false,
      entitlements: {} as any,
      hasModule: vi.fn().mockReturnValue(false),
      enabledModules: [],
      hasAnyModule: false,
      hasBusinessModules: false,
      hasPersonalModules: false,
      getDefaultRoute: () => "/no-access",
    } as any)

    render(
      <MemoryRouter>
        <ModuleRouteGuard module="purchases">
          <div>Protected Content</div>
        </ModuleRouteGuard>
      </MemoryRouter>
    )

    expect(screen.getByText("No Modules Assigned Yet")).toBeDefined()
    expect(screen.getByText(/Account: newuser@7time.com/i)).toBeDefined()
    expect(screen.queryByText("Protected Content")).toBeNull()
  })

  it("redirects to default accessible route when user lacks specific module entitlement", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "u1", email: "personal@7time.com" } as any,
      profile: { id: "u1", is_active: true } as any,
      isAdmin: false,
      loading: false,
      entitlements: { personal_ledger: true } as any,
      hasModule: (key: string) => key === "personal_ledger",
      enabledModules: ["personal_ledger"],
      hasAnyModule: true,
      hasBusinessModules: false,
      hasPersonalModules: true,
      getDefaultRoute: () => "/local-customers",
    } as any)

    render(
      <MemoryRouter initialEntries={["/purchases"]}>
        <Routes>
          <Route
            path="/purchases"
            element={
              <ModuleRouteGuard module="purchases">
                <div>Purchases Content</div>
              </ModuleRouteGuard>
            }
          />
          <Route path="/local-customers" element={<div>Personal Ledger Fallback</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText("Personal Ledger Fallback")).toBeDefined()
    expect(screen.queryByText("Purchases Content")).toBeNull()
  })

  it("renders children when module entitlement is verified", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "u1", email: "buyer@7time.com" } as any,
      profile: { id: "u1", is_active: true } as any,
      isAdmin: false,
      loading: false,
      entitlements: { purchases: true } as any,
      hasModule: (key: string) => key === "purchases",
      enabledModules: ["purchases"],
      hasAnyModule: true,
      hasBusinessModules: true,
      hasPersonalModules: false,
      getDefaultRoute: () => "/purchases",
    } as any)

    render(
      <MemoryRouter>
        <ModuleRouteGuard module="purchases">
          <div>Authorized Purchases View</div>
        </ModuleRouteGuard>
      </MemoryRouter>
    )

    expect(screen.getByText("Authorized Purchases View")).toBeDefined()
  })

  it("blocks non-admin users from adminOnly routes and redirects to default route", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "u2", email: "staff@7time.com" } as any,
      profile: { id: "u2", is_active: true } as any,
      isAdmin: false,
      loading: false,
      entitlements: { products: true } as any,
      hasModule: (key: string) => key === "products",
      enabledModules: ["products"],
      hasAnyModule: true,
      hasBusinessModules: true,
      hasPersonalModules: false,
      getDefaultRoute: () => "/products",
    } as any)

    render(
      <MemoryRouter initialEntries={["/settings/accounts"]}>
        <Routes>
          <Route
            path="/settings/accounts"
            element={
              <ModuleRouteGuard adminOnly>
                <div>Accounts Admin Console</div>
              </ModuleRouteGuard>
            }
          />
          <Route path="/products" element={<div>Products Route Fallback</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText("Products Route Fallback")).toBeDefined()
    expect(screen.queryByText("Accounts Admin Console")).toBeNull()
  })

  it("renders adminOnly route children when user is verified administrator", () => {
    vi.spyOn(ModuleAccessHook, "useModuleAccess").mockReturnValue({
      user: { id: "admin-1", email: "admin@7time.com" } as any,
      profile: { id: "admin-1", is_active: true, system_role: "SUPER_ADMIN" } as any,
      isAdmin: true,
      loading: false,
      entitlements: {} as any,
      hasModule: () => true,
      enabledModules: [],
      hasAnyModule: true,
      hasBusinessModules: true,
      hasPersonalModules: true,
      getDefaultRoute: () => "/",
    } as any)

    render(
      <MemoryRouter>
        <ModuleRouteGuard adminOnly>
          <div>Accounts Admin Console</div>
        </ModuleRouteGuard>
      </MemoryRouter>
    )

    expect(screen.getByText("Accounts Admin Console")).toBeDefined()
  })
})

