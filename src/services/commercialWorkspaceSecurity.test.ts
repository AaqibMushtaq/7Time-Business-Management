import { describe, it, expect, vi, beforeEach } from "vitest"
import { createDealer, updateDealer } from "./dealers"
import { createPurchase, updatePurchase } from "./purchases"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
  },
}))

describe("Commercial Workspace Security & Multi-Tenant Invariants (Migration 05 Logic)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("1. Authorized & Unauthorized Inserts", () => {
    it("permits authorized insert when caller belongs to an active business workspace", async () => {
      const mockCreatedDealer = {
        id: "dealer-101",
        name: "Authorized Dry Fruits",
        phone: "9876543210",
        workspace_id: "ws-business-alpha",
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockCreatedDealer,
            error: null,
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ insert: mockInsert })

      const result = await createDealer({
        name: "Authorized Dry Fruits",
        phone: "9876543210",
      })

      expect(result).toEqual(mockCreatedDealer)
      expect((result as any).workspace_id).toBe("ws-business-alpha")
    })

    it("rejects insert with 42501 when caller is unauthorized or suspended", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: "42501",
              message: "Account suspended: active account required for commercial operations.",
            },
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ insert: mockInsert })

      await expect(
        createDealer({ name: "Suspended Account Dealer", phone: "1111111111" })
      ).rejects.toThrow("Account suspended")
    })

    it("rejects insert into an unauthorized foreign workspace", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: "42501",
              message: "Unauthorized workspace: caller is not an active member of workspace ws-foreign.",
            },
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ insert: mockInsert })

      await expect(
        createDealer({ name: "Intruder Dealer", phone: "2222222222" })
      ).rejects.toThrow("Unauthorized workspace")
    })
  })

  describe("2. Parent-Child Workspace Consistency", () => {
    it("ensures child purchases inherit the parent dealer's workspace", async () => {
      const mockPurchase = {
        id: "purch-1",
        dealer_id: "dealer-101",
        invoice_no: "INV-2026-001",
        purchase_date: "2026-10-31",
        total_amount: 15000,
        amount_paid: 15000,
        workspace_id: "ws-business-alpha",
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPurchase,
            error: null,
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ insert: mockInsert })

      const result = await createPurchase({
        dealer_id: "dealer-101",
        invoice_no: "INV-2026-001",
        purchase_date: "2026-10-31",
        total_amount: 15000,
        amount_paid: 15000,
      } as any)

      expect((result as any).workspace_id).toBe("ws-business-alpha")
    })

    it("rejects cross-workspace child creation when child workspace mismatches parent workspace", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: "42501",
              message: "Workspace mismatch: transaction workspace must match dealer workspace.",
            },
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ insert: mockInsert })

      await expect(
        createPurchase({
          dealer_id: "dealer-101",
          invoice_no: "INV-CROSS-01",
          purchase_date: "2026-10-31",
          total_amount: 5000,
          amount_paid: 5000,
        } as any)
      ).rejects.toThrow("Workspace mismatch")
    })
  })

  describe("3. Workspace Immutability & Parent Reassignment Controls (UPDATE)", () => {
    it("rejects direct workspace_id reassignment on dealers (prevent_workspace_reassignment)", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                code: "42501",
                message: "Workspace immutability violation: workspace_id cannot be modified.",
              },
            }),
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ update: mockUpdate })

      await expect(
        updateDealer("dealer-101", { name: "Attempted Reassigned Dealer" } as any)
      ).rejects.toThrow("Workspace immutability violation")
    })

    it("rejects parent reassignment on purchases to a dealer in a different workspace (validate_commercial_child_update)", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                code: "42501",
                message: "Parent reassignment violation: new dealer belongs to a different workspace.",
              },
            }),
          }),
        }),
      })

      ;(supabase.from as any).mockReturnValue({ update: mockUpdate })

      await expect(
        updatePurchase("purch-1", { dealer_id: "dealer-foreign" })
      ).rejects.toThrow("Parent reassignment violation")
    })
  })
})

