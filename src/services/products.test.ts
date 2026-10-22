import { describe, it, expect, vi, beforeEach } from "vitest"
import { getProductUsage, deleteProduct, createProduct, updateProduct } from "./products"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

describe("products service - data integrity & referential safety", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getProductUsage", () => {
    it("returns inUse: false when product has zero purchases and zero wholesale sales", async () => {
      const mockEq = vi.fn().mockImplementation(() => {
        return Promise.resolve({ count: 0, error: null })
      })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as any).mockReturnValue({ select: mockSelect })

      const usage = await getProductUsage("prod-1")
      expect(usage).toEqual({
        inUse: false,
        purchaseCount: 0,
        wholesaleSalesCount: 0,
      })
    })

    it("returns inUse: true when product is referenced in purchases or wholesale sales", async () => {
      ;(supabase.from as any).mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              if (table === "purchases") return Promise.resolve({ count: 3, error: null })
              if (table === "wholesale_sales") return Promise.resolve({ count: 1, error: null })
              return Promise.resolve({ count: 0, error: null })
            }),
          }),
        }
      })

      const usage = await getProductUsage("prod-2")
      expect(usage.inUse).toBe(true)
      expect(usage.purchaseCount).toBe(3)
      expect(usage.wholesaleSalesCount).toBe(1)
    })
  })

  describe("deleteProduct", () => {
    it("blocks deletion and throws an explanatory error when product has historical records", async () => {
      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "purchases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
            }),
          }
        }
        if (table === "wholesale_sales") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      })

      await expect(deleteProduct("prod-3")).rejects.toThrow(
        /Cannot delete product because it is referenced by 2 purchase order\(s\)/
      )

      // Ensure .delete() was never called on products table
      expect(supabase.from).not.toHaveBeenCalledWith("products")
    })

    it("successfully deletes the product when it is not referenced in any transactions", async () => {
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "purchases" || table === "wholesale_sales") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }
        }
        if (table === "products") {
          return {
            delete: mockDelete,
          }
        }
        return {}
      })

      await expect(deleteProduct("prod-clean")).resolves.toBeUndefined()
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteEq).toHaveBeenCalledWith("id", "prod-clean")
    })
  })

  describe("createProduct & updateProduct", () => {
    it("persists a newly created product through Supabase insert", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "p-new", name: "Green Tea", buying_cost: 200 },
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      ;(supabase.from as any).mockReturnValue({ insert: mockInsert })

      const newProduct = await createProduct({
        dealer_id: "d-1",
        name: "Green Tea",
        unit: "Box",
        buying_cost: 200,
        wholesale_price: 250,
        retail_price: 300,
        stock_quantity: 0,
      })

      expect(newProduct.id).toBe("p-new")
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ name: "Green Tea", buying_cost: 200 }),
      ])
    })

    it("updates product properties without modifying unedited fields", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "p-1", name: "Updated Name", wholesale_price: 280 },
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as any).mockReturnValue({ update: mockUpdate })

      const updated = await updateProduct("p-1", {
        name: "Updated Name",
        wholesale_price: 280,
      })

      expect(updated.name).toBe("Updated Name")
      expect(mockUpdate).toHaveBeenCalledWith({
        name: "Updated Name",
        wholesale_price: 280,
      })
      expect(mockEq).toHaveBeenCalledWith("id", "p-1")
    })
  })
})
