import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ProfilePage from "./ProfilePage"
import * as profileService from "@/services/profileService"

const mockRefreshProfile = vi.fn()
const mockSignOut = vi.fn()

const mockUser = {
  id: "usr-456",
  email: "sarah.connor@7time.biz",
  new_email: null as string | null,
}

const mockProfile = {
  id: "usr-456",
  email: "sarah.connor@7time.biz",
  full_name: "Sarah Connor",
  phone: "+91 98765 43210",
  system_role: "USER" as const,
  is_active: true,
  created_at: "2026-02-15T08:30:00Z",
  updated_at: "2026-11-03T09:00:00Z",
}

const mockWorkspace = {
  id: "ws-1",
  name: "HQ Operations",
  workspace_type: "BUSINESS" as const,
  owner_id: "admin-1",
  is_active: true,
}

vi.mock("@/components/auth/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    isAdmin: false,
    currentWorkspace: mockWorkspace,
    workspaces: [mockWorkspace],
    refreshProfile: mockRefreshProfile,
    signOut: mockSignOut,
  }),
}))

vi.mock("@/services/profileService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/profileService")>()
  return {
    ...actual,
    updateSelfProfile: vi.fn(),
    changeSelfPassword: vi.fn(),
    initiateSelfEmailChange: vi.fn(),
  }
})

describe("ProfilePage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.new_email = null
  })

  const renderComponent = (initialRoute = "/settings/profile") => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/settings/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it("renders page header with user initials, name, role badge, and active workspace", () => {
    renderComponent()

    expect(screen.getAllByText("Sarah Connor").length).toBeGreaterThan(0)
    expect(screen.getAllByText("SC").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Standard User").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Active Account").length).toBeGreaterThan(0)
    expect(screen.getAllByText("HQ Operations").length).toBeGreaterThan(0)
    expect(screen.getByText("My Profile & Security")).toBeDefined()
  })

  it("switches tabs between Personal Information and Account Security", async () => {
    renderComponent()

    // Default tab is Personal Information
    expect(screen.getByRole("tab", { name: /personal information/i })).toBeDefined()
    expect(screen.getByLabelText(/full name/i)).toBeDefined()

    // Switch to Account Security
    const securityTab = screen.getByRole("tab", { name: /account security/i })
    fireEvent.click(securityTab)

    expect(await screen.findByText("Account Password")).toBeDefined()
    expect(screen.getByText("Session & Identity Protection")).toBeDefined()
  })

  it("pre-populates personal information and validates full name", async () => {
    renderComponent()

    const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement

    expect(nameInput.value).toBe("Sarah Connor")
    expect(phoneInput.value).toBe("+91 98765 43210")

    // Clear name and submit
    fireEvent.change(nameInput, { target: { value: "   " } })
    const saveButton = screen.getByRole("button", { name: /save changes/i })
    fireEvent.click(saveButton)

    expect(await screen.findByText("Full name is required.")).toBeDefined()
    expect(profileService.updateSelfProfile).not.toHaveBeenCalled()
  })

  it("validates phone number format", async () => {
    renderComponent()

    const phoneInput = screen.getByLabelText(/phone number/i)
    fireEvent.change(phoneInput, { target: { value: "invalid-phone" } })

    const saveButton = screen.getByRole("button", { name: /save changes/i })
    fireEvent.click(saveButton)

    expect(await screen.findByText(/please enter a valid phone number/i)).toBeDefined()
    expect(profileService.updateSelfProfile).not.toHaveBeenCalled()
  })

  it("submits updated personal information and refreshes profile", async () => {
    ;(profileService.updateSelfProfile as any).mockResolvedValue({
      ...mockProfile,
      full_name: "Sarah J. Connor",
      phone: "+91 99999 11111",
    })

    renderComponent()

    const nameInput = screen.getByLabelText(/full name/i)
    const phoneInput = screen.getByLabelText(/phone number/i)

    fireEvent.change(nameInput, { target: { value: "Sarah J. Connor" } })
    fireEvent.change(phoneInput, { target: { value: "+91 99999 11111" } })

    const saveButton = screen.getByRole("button", { name: /save changes/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(profileService.updateSelfProfile).toHaveBeenCalledWith({
        full_name: "Sarah J. Connor",
        phone: "+91 99999 11111",
      })
      expect(mockRefreshProfile).toHaveBeenCalled()
    })

    expect(await screen.findByText(/profile information has been successfully updated/i)).toBeDefined()
  })

  it("opens Change Password dialog and executes password update flow", async () => {
    ;(profileService.changeSelfPassword as any).mockResolvedValue(undefined)

    renderComponent("/settings/profile?tab=security")

    const changePwBtn = await screen.findByRole("button", { name: /change password/i })
    fireEvent.click(changePwBtn)

    expect(await screen.findByText("Change Account Password")).toBeDefined()

    const currentPwInput = screen.getByLabelText(/current password \*/i)
    const newPwInput = screen.getByLabelText(/^new password \*/i)
    const confirmPwInput = screen.getByLabelText(/confirm new password \*/i)

    fireEvent.change(currentPwInput, { target: { value: "OldPassword123" } })
    fireEvent.change(newPwInput, { target: { value: "NewSecure456" } })
    fireEvent.change(confirmPwInput, { target: { value: "NewSecure456" } })

    const submitBtn = screen.getByRole("button", { name: /save new password/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(profileService.changeSelfPassword).toHaveBeenCalledWith("OldPassword123", "NewSecure456")
    })

    expect(await screen.findByText(/your account password has been updated successfully/i)).toBeDefined()
  })

  it("opens Change Email dialog and initiates email verification workflow", async () => {
    ;(profileService.initiateSelfEmailChange as any).mockResolvedValue({
      pendingEmail: "new.sarah@7time.biz",
      requiresConfirmation: true,
      message: "A confirmation link has been sent to new.sarah@7time.biz.",
    })

    renderComponent()

    const changeEmailBtn = screen.getByRole("button", { name: /change email/i })
    fireEvent.click(changeEmailBtn)

    expect(await screen.findByText("Change Email Address")).toBeDefined()

    const currentPwInput = screen.getByLabelText(/current password \*/i)
    const newEmailInput = screen.getByLabelText(/^new email address \*/i)
    const confirmEmailInput = screen.getByLabelText(/confirm new email address \*/i)

    fireEvent.change(currentPwInput, { target: { value: "CorrectSecret1" } })
    fireEvent.change(newEmailInput, { target: { value: "new.sarah@7time.biz" } })
    fireEvent.change(confirmEmailInput, { target: { value: "new.sarah@7time.biz" } })

    const submitBtn = screen.getByRole("button", { name: /send verification email/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(profileService.initiateSelfEmailChange).toHaveBeenCalledWith(
        "CorrectSecret1",
        "new.sarah@7time.biz"
      )
    })

    expect(await screen.findByText(/email verification sent/i)).toBeDefined()
    expect(screen.getByText(/target email:/i)).toBeDefined()
  })

  it("displays account metadata and copyable ID", () => {
    renderComponent()

    expect(screen.getByText("Account Metadata")).toBeDefined()
    expect(screen.getByText("User Account ID")).toBeDefined()
    expect(screen.getByTitle("usr-456")).toBeDefined()
    expect(screen.getByText("Administrative Boundaries")).toBeDefined()
  })
})
