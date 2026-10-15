import { describe, it, expect, vi, beforeEach } from "vitest"
import { 
  getResellers, 
  getResellersWithBalances, 
  createReseller, 
  updateReseller, 
  deleteReseller 
} from "./resellers"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe("Resellers Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getResellers queries reseller_customers table ordered by name", async () => {
    const mockData = [
      { id: "r1", name: "Alpha", phone: "111", address: "Loc 1" },
      { id: "r2", name: "Beta", phone: "222", address: "Loc 2" }
    ]

    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await getResellers()
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(queryBuilder.order).toHaveBeenCalledWith("name")
    expect(result).toEqual(mockData)
  })

  it("getResellersWithBalances calculates accurate total_sales, total_received, and outstanding receivable", async () => {
    const mockResellers = [
      { id: "r1", name: "Customer 1", phone: "111", address: "Add 1" },
      { id: "r2", name: "Customer 2", phone: "222", address: "Add 2" }
    ]

    // Sales:
    // r1: sale 1000 with 300 paid (balance 700), sale 500 with 500 paid (balance 0). Total sale = 1500, paid at sale = 800
    // r2: sale 2000 with 0 paid. Total sale = 2000, paid at sale = 0
    const mockSales = [
      { customer_id: "r1", total_sale: 1000, amount_received: 300 },
      { customer_id: "r1", total_sale: 500, amount_received: 500 },
      { customer_id: "r2", total_sale: 2000, amount_received: 0 }
    ]

    // Separate payments:
    // r1: 400 separate payment. Total received for r1 = 800 + 400 = 1200. Outstanding = 1500 - 1200 = 300
    // r2: 500 separate payment. Total received for r2 = 0 + 500 = 500. Outstanding = 2000 - 500 = 1500
    const mockPayments = [
      { customer_id: "r1", amount: 400 },
      { customer_id: "r2", amount: 500 }
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "reseller_customers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockResellers, error: null })
          })
        }
      }
      if (table === "wholesale_sales") {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockSales, error: null })
          })
        }
      }
      if (table === "reseller_payments") {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockPayments, error: null })
          })
        }
      }
      if (table === "customer_credits") {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }
    })

    const result = await getResellersWithBalances()

    expect(result).toHaveLength(2)

    const r1 = result.find(r => r.id === "r1")!
    expect(r1.total_sales).toBe(1500)
    expect(r1.total_received).toBe(1200)
    expect(r1.outstanding).toBe(300)

    const r2 = result.find(r => r.id === "r2")!
    expect(r2.total_sales).toBe(2000)
    expect(r2.total_received).toBe(500)
    expect(r2.outstanding).toBe(1500)
  })

  it("getResellersWithBalances calculates accurate funding source breakdowns and total owed", async () => {
    const mockResellers = [
      { id: "r1", name: "Local Customer 1", phone: "111", address: "Market" }
    ]

    const mockCredits = [
      { customer_id: "r1", entry_type: "PRODUCT_CREDIT", funding_source: "7TIME_FUNDS", balance: 800 },
      { customer_id: "r1", entry_type: "CASH_LOAN", funding_source: "PERSONAL_FUNDS", balance: 400 },
      { customer_id: "r1", entry_type: "PRODUCT_CREDIT", funding_source: null, balance: 200 }
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "reseller_customers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockResellers, error: null })
          })
        }
      }
      if (table === "customer_credits") {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockCredits, error: null })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }
    })

    const result = await getResellersWithBalances()
    const r1 = result.find(r => r.id === "r1")!

    expect(r1.funds_7time_outstanding).toBe(800)
    expect(r1.funds_personal_outstanding).toBe(400)
    expect(r1.funds_unallocated_outstanding).toBe(200)
    expect(r1.product_credit_outstanding).toBe(1000) // 800 + 200
    expect(r1.cash_loan_outstanding).toBe(400)
    expect(r1.total_owed).toBe(1400)
    expect(r1.funds_7time_outstanding + r1.funds_personal_outstanding + r1.funds_unallocated_outstanding).toBe(r1.total_owed)
  })

  it("createReseller inserts customer into reseller_customers", async () => {
    const newCustomer = { name: "Gamma Reseller", phone: "333", address: "Market 3" }
    const savedCustomer = { id: "r3", ...newCustomer, created_at: "2026-10-11" }

    const queryBuilder: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: savedCustomer, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await createReseller(newCustomer)
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(queryBuilder.insert).toHaveBeenCalledWith([newCustomer])
    expect(result).toEqual(savedCustomer)
  })

  it("updateReseller updates existing customer", async () => {
    const updates = { phone: "999" }
    const updatedCustomer = { id: "r1", name: "Alpha", phone: "999", address: "Loc 1" }

    const queryBuilder: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedCustomer, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await updateReseller("r1", updates)
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(queryBuilder.update).toHaveBeenCalledWith(updates)
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "r1")
    expect(result).toEqual(updatedCustomer)
  })

  it("deleteReseller deletes customer from table", async () => {
    const queryBuilder: any = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    await deleteReseller("r1")
    expect(supabase.from).toHaveBeenCalledWith("reseller_customers")
    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "r1")
  })
})
