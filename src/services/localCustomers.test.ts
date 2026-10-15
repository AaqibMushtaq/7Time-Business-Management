import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getLocalCustomers,
  getLocalCustomersWithBalances,
  createLocalCustomer,
  updateLocalCustomer,
  deleteLocalCustomer,
  type LocalCustomer
} from "./localCustomers"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe("Local Customers Domain Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getLocalCustomers queries underlying table ordered by name", async () => {
    const mockCustomers: LocalCustomer[] = [
      { id: "1", name: "Alpha Customer", phone: "123", address: "Market" }
    ]

    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockCustomers, error: null })
      })
    })

    const result = await getLocalCustomers()
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(result).toEqual(mockCustomers)
  })

  it("getLocalCustomersWithBalances calls underlying storage queries", async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "reseller_customers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: "c1", name: "Alpha", opening_balance: 100 }], error: null })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }
    })

    const result = await getLocalCustomersWithBalances()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Alpha")
    expect(result[0].amount_they_owe_me).toBe(100)
    expect(result[0].amount_i_owe_them).toBe(0)
  })

  it("createLocalCustomer inserts new customer into underlying storage", async () => {
    const newCustomer = { name: "New Person", phone: "555", address: "Lane 1" }
    const created = { id: "p1", ...newCustomer }

    ;(supabase.from as any).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null })
        })
      })
    })

    const result = await createLocalCustomer(newCustomer as any)
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(result.id).toBe("p1")
  })

  it("updateLocalCustomer updates customer record in underlying storage", async () => {
    const updated = { id: "p1", name: "Updated Person", phone: "555" }
    ;(supabase.from as any).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updated, error: null })
          })
        })
      })
    })

    const result = await updateLocalCustomer("p1", { name: "Updated Person" })
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(result.name).toBe("Updated Person")
  })

  it("deleteLocalCustomer deletes customer from underlying storage", async () => {
    ;(supabase.from as any).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    })

    await deleteLocalCustomer("p1")
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
  })
})
