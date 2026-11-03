import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  isValidEmail,
  isValidPhone,
  validatePasswordPolicy,
  updateSelfProfile,
  verifyCurrentPassword,
  changeSelfPassword,
  initiateSelfEmailChange,
} from "./profileService"
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

describe("profileService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Validation Utilities", () => {
    it("validates emails correctly", () => {
      expect(isValidEmail("user@example.com")).toBe(true)
      expect(isValidEmail("john.doe+work@7time.biz")).toBe(true)
      expect(isValidEmail("not-an-email")).toBe(false)
      expect(isValidEmail("")).toBe(false)
      expect(isValidEmail("test@.com")).toBe(false)
    })

    it("validates phones correctly", () => {
      expect(isValidPhone("")).toBe(true)
      expect(isValidPhone("+91 9876543210")).toBe(true)
      expect(isValidPhone("123-456-7890")).toBe(true)
      expect(isValidPhone("invalid")).toBe(false)
      expect(isValidPhone("123")).toBe(false)
    })

    it("enforces password policy", () => {
      expect(validatePasswordPolicy("weak").isValid).toBe(false)
      expect(validatePasswordPolicy("onlyletters").isValid).toBe(false)
      expect(validatePasswordPolicy("12345678").isValid).toBe(false)
      expect(validatePasswordPolicy("Valid1234").isValid).toBe(true)
    })
  })

  describe("updateSelfProfile", () => {
    it("rejects empty full name", async () => {
      await expect(updateSelfProfile({ full_name: "   " })).rejects.toThrow("Full name is required.")
    })

    it("rejects invalid phone number", async () => {
      await expect(
        updateSelfProfile({ full_name: "Jane Doe", phone: "abc" })
      ).rejects.toThrow("Please enter a valid phone number")
    })

    it("updates profile successfully when authenticated", async () => {
      const mockUser = { id: "user-123", email: "user@7time.com" }
      ;(supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "user-123",
          email: "user@7time.com",
          full_name: "Jane Doe",
          phone: "+91 9876543210",
          system_role: "USER",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-11-03T00:00:00Z",
        },
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

      const mockWsEq2 = vi.fn().mockResolvedValue({ error: null })
      const mockWsEq1 = vi.fn().mockReturnValue({ eq: mockWsEq2 })
      const mockWsUpdate = vi.fn().mockReturnValue({ eq: mockWsEq1 })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "workspaces") {
          return { update: mockWsUpdate }
        }
        return { update: mockUpdate }
      })

      const result = await updateSelfProfile({
        full_name: "  Jane Doe  ",
        phone: "+91 9876543210",
      })

      expect(supabase.auth.getUser).toHaveBeenCalled()
      expect(supabase.from).toHaveBeenCalledWith("profiles")
      expect(supabase.from).toHaveBeenCalledWith("workspaces")
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Jane Doe",
          phone: "+91 9876543210",
        })
      )
      expect(mockEq).toHaveBeenCalledWith("id", "user-123")
      expect(mockWsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Jane Doe's Workspace",
        })
      )
      expect(mockWsEq1).toHaveBeenCalledWith("owner_id", "user-123")
      expect(mockWsEq2).toHaveBeenCalledWith("workspace_type", "PERSONAL")
      expect(result.full_name).toBe("Jane Doe")
    })
  })

  describe("verifyCurrentPassword", () => {
    it("throws error if current password is empty", async () => {
      await expect(verifyCurrentPassword("")).rejects.toThrow("Current password is required.")
    })

    it("returns true on successful credentials verification", async () => {
      ;(supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: "u-1", email: "user@7time.com" } },
        error: null,
      })
      ;(supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: {},
        error: null,
      })

      const verified = await verifyCurrentPassword("CorrectSecret123")
      expect(verified).toBe(true)
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "user@7time.com",
        password: "CorrectSecret123",
      })
    })

    it("throws error on incorrect current password", async () => {
      ;(supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: "u-1", email: "user@7time.com" } },
        error: null,
      })
      ;(supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: null,
        error: { message: "Invalid login credentials" },
      })

      await expect(verifyCurrentPassword("WrongPw123")).rejects.toThrow(
        "Incorrect current password. Please enter your valid current password to proceed."
      )
    })
  })

  describe("changeSelfPassword", () => {
    it("enforces password policy before reauthentication", async () => {
      await expect(changeSelfPassword("OldPass123", "short")).rejects.toThrow(
        "Password must be at least 8 characters long."
      )
    })

    it("rejects identical new password", async () => {
      await expect(changeSelfPassword("SamePassword1", "SamePassword1")).rejects.toThrow(
        "New password must be different from your current password."
      )
    })

    it("verifies current password and updates password successfully", async () => {
      ;(supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: "u-1", email: "user@7time.com" } },
        error: null,
      })
      ;(supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: {},
        error: null,
      })
      ;(supabase.auth.updateUser as any).mockResolvedValue({
        data: { user: { id: "u-1" } },
        error: null,
      })

      await changeSelfPassword("OldSecret123", "NewSecret456")

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "user@7time.com",
        password: "OldSecret123",
      })
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: "NewSecret456",
      })
    })
  })

  describe("initiateSelfEmailChange", () => {
    it("validates new email format", async () => {
      await expect(initiateSelfEmailChange("OldSecret123", "invalid-email")).rejects.toThrow(
        "Please enter a valid email address."
      )
    })

    it("rejects same email as current", async () => {
      ;(supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: "u-1", email: "same@7time.com" } },
        error: null,
      })
      await expect(initiateSelfEmailChange("OldSecret123", "same@7time.com")).rejects.toThrow(
        "New email address must be different from your current email address."
      )
    })

    it("reauthenticates current password and reports pending confirmation", async () => {
      ;(supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: "u-1", email: "old@7time.com" } },
        error: null,
      })
      ;(supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: {},
        error: null,
      })
      ;(supabase.auth.updateUser as any).mockResolvedValue({
        data: {
          user: {
            id: "u-1",
            email: "old@7time.com",
            new_email: "new@7time.com",
          },
        },
        error: null,
      })

      const res = await initiateSelfEmailChange("OldSecret123", "new@7time.com")
      expect(res.requiresConfirmation).toBe(true)
      expect(res.pendingEmail).toBe("new@7time.com")
      expect(res.message).toContain("confirmation link has been sent to new@7time.com")
    })
  })
})

