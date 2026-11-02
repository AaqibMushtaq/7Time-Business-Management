import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  listManagedUsers,
  createManagedUser,
  toggleUserModule,
  setAccountActiveStatus,
  resetUserPassword,
  deleteManagedUser,
  updateManagedUser,
} from "./adminService"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

describe("adminService API Contract Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("updateManagedUser", () => {
    it("invokes admin-manage-users with action 'update_user' and matching payload", async () => {
      const mockUser = {
        id: "11111111-2222-3333-4444-555555555555",
        full_name: "Basit Bhai",
        email: "basit@example.com",
        phone: "+91 98765 43210",
      }

      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
        },
        error: null,
      })

      const result = await updateManagedUser({
        userId: "11111111-2222-3333-4444-555555555555",
        full_name: "Basit Bhai",
        email: "basit@example.com",
        phone: "+91 98765 43210",
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: {
          action: "update_user",
          user_id: "11111111-2222-3333-4444-555555555555",
          full_name: "Basit Bhai",
          email: "basit@example.com",
          phone: "+91 98765 43210",
        },
      })

      expect(result.success).toBe(true)
      expect(result.user).toEqual(mockUser)
    })

    it("surfaces structured backend error message from data.error", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: {
          error: "An account with this email address already exists.",
        },
        error: null,
      })

      await expect(
        updateManagedUser({
          userId: "11111111-2222-3333-4444-555555555555",
          email: "duplicate@example.com",
        })
      ).rejects.toThrow("An account with this email address already exists.")
    })

    it("extracts structured error JSON from FunctionsHttpError context", async () => {
      const functionsHttpError = {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: vi.fn().mockResolvedValue({
            error: "Full name must be at least 2 characters long.",
          }),
        },
      }

      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: functionsHttpError,
      })

      await expect(
        updateManagedUser({
          userId: "11111111-2222-3333-4444-555555555555",
          full_name: "A",
        })
      ).rejects.toThrow("Full name must be at least 2 characters long.")
    })

    it("falls back to default message if error context cannot be resolved", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: "Edge Function returned a non-2xx status code" },
      })

      await expect(
        updateManagedUser({
          userId: "11111111-2222-3333-4444-555555555555",
          full_name: "Test",
        })
      ).rejects.toThrow("Failed to update user account.")
    })
  })

  describe("listManagedUsers", () => {
    it("invokes admin-manage-users with action 'list_users'", async () => {
      const mockUsers = [{ id: "u1", email: "u1@test.com" }]
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      })

      const res = await listManagedUsers()
      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: { action: "list_users" },
      })
      expect(res).toEqual(mockUsers)
    })
  })

  describe("createManagedUser", () => {
    it("invokes admin-manage-users with action 'create_user'", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true, user: { id: "new-user-1" } },
        error: null,
      })

      const res = await createManagedUser({
        email: "new@example.com",
        password: "password123",
        full_name: "New Operator",
        initial_modules: ["wholesale_sales"],
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: {
          action: "create_user",
          email: "new@example.com",
          password: "password123",
          full_name: "New Operator",
          phone: "",
          initial_modules: ["wholesale_sales"],
        },
      })
      expect(res.success).toBe(true)
    })
  })

  describe("toggleUserModule", () => {
    it("invokes admin-manage-users with action 'toggle_module'", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const res = await toggleUserModule("u1", "personal_ledger", true)
      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: {
          action: "toggle_module",
          user_id: "u1",
          module_id: "personal_ledger",
          is_enabled: true,
        },
      })
      expect(res.success).toBe(true)
    })
  })

  describe("deleteManagedUser", () => {
    it("invokes admin-manage-users with action 'delete_user'", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const res = await deleteManagedUser("u1")
      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: {
          action: "delete_user",
          user_id: "u1",
        },
      })
      expect(res.success).toBe(true)
    })
  })

  describe("setAccountActiveStatus", () => {
    it("invokes admin-manage-users with action 'set_account_status'", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const res = await setAccountActiveStatus("u1", false)
      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: {
          action: "set_account_status",
          user_id: "u1",
          is_active: false,
        },
      })
      expect(res.success).toBe(true)
    })
  })

  describe("resetUserPassword", () => {
    it("invokes admin-manage-users with action 'reset_password'", async () => {
      ;(supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const res = await resetUserPassword("u1", "newPassword123")
      expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-users", {
        body: {
          action: "reset_password",
          user_id: "u1",
          new_password: "newPassword123",
        },
      })
      expect(res.success).toBe(true)
    })
  })
})

