import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { UserProfileDropdown } from "./UserProfileDropdown"

describe("UserProfileDropdown Component", () => {
  const mockSignOut = vi.fn()

  const defaultProps = {
    userEmail: "testuser@7time.com",
    newEmail: null,
    profile: {
      id: "u-1",
      email: "testuser@7time.com",
      full_name: "Test User",
      phone: "+91 9999988888",
      system_role: "USER" as const,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-11-03T00:00:00Z",
    },
    isAdmin: false,
    signOut: mockSignOut,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders user initials and display name trigger button", () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown {...defaultProps} />
      </MemoryRouter>
    )

    const button = screen.getByRole("button", { name: /user account and profile menu/i })
    expect(button).toBeDefined()
    expect(screen.getByText("TU")).toBeDefined() // Initials of Test User
    expect(screen.getByText("Test User")).toBeDefined()
    expect(screen.getByText("Standard User")).toBeDefined()
  })

  it("opens dropdown menu on click with My Profile, Account Security, and Sign Out options", () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown {...defaultProps} />
      </MemoryRouter>
    )

    const button = screen.getByRole("button", { name: /user account and profile menu/i })
    fireEvent.click(button)

    expect(screen.getByRole("menu")).toBeDefined()
    expect(screen.getByText("My Profile")).toBeDefined()
    expect(screen.getByText("Account Security")).toBeDefined()
    expect(screen.getByText("Sign Out")).toBeDefined()
    // Standard user does NOT see Enterprise Accounts
    expect(screen.queryByText("Enterprise Accounts")).toBeNull()
  })

  it("shows Enterprise Accounts link when user is admin", () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown {...defaultProps} isAdmin={true} />
      </MemoryRouter>
    )

    const button = screen.getByRole("button", { name: /user account and profile menu/i })
    fireEvent.click(button)

    expect(screen.getByText("Enterprise Accounts")).toBeDefined()
  })

  it("calls signOut when Sign Out is clicked", () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown {...defaultProps} />
      </MemoryRouter>
    )

    const button = screen.getByRole("button", { name: /user account and profile menu/i })
    fireEvent.click(button)

    const signOutBtn = screen.getByText("Sign Out")
    fireEvent.click(signOutBtn)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it("closes dropdown menu on Escape key press", () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown {...defaultProps} />
      </MemoryRouter>
    )

    const button = screen.getByRole("button", { name: /user account and profile menu/i })
    fireEvent.click(button)
    expect(screen.getByRole("menu")).toBeDefined()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("displays pending email indicator when newEmail is present", () => {
    render(
      <MemoryRouter>
        <UserProfileDropdown {...defaultProps} newEmail="pending@7time.com" />
      </MemoryRouter>
    )

    const button = screen.getByRole("button", { name: /user account and profile menu/i })
    fireEvent.click(button)

    expect(screen.getByText(/Confirm pending: pending@7time\.com/i)).toBeDefined()
  })
})

