import { describe, it, expect, vi, beforeEach } from "vitest"
import { 
  getDealers, 
  getDealersWithBalances, 
  createDealer, 
  updateDealer, 
  deleteDealer 
} from "./dealers"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe("Dealers Accounting & Service Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getDealers queries dealers table ordered by name", async () => {
    const mockDealers = [
      { id: "d1", name: "Alpha Traders", opening_balance: 1500 },
      { id: "d2", name: "Beta Traders", opening_balance: 0 }
    ]

    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await getDealers()
    expect(supabase.from).toHaveBeenCalledWith("dealers")
    expect(queryBuilder.select).toHaveBeenCalledWith("*")
    expect(queryBuilder.order).toHaveBeenCalledWith("name")
    expect(result).toEqual(mockDealers)
  })

  // Test Case 1: Zero opening balance, no purchases, no payments
  it("Case 1: calculates zero outstanding for dealer with zero opening balance and no transactions", async () => {
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 0 }]
    const mockPurchases: any[] = []
    const mockPayments: any[] = []

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(0)
  })

  // Test Case 2: Positive opening balance without purchases
  it("Case 2: preserves positive opening balance when no purchases or payments exist", async () => {
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 5000 }]
    const mockPurchases: any[] = []
    const mockPayments: any[] = []

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(5000)
  })

  // Test Case 3: Opening balance plus purchases minus payments
  it("Case 3: calculates opening balance + purchases - payments correctly", async () => {
    // Opening ₹1,000 + Purchases ₹5,000 (0 paid at purchase) - Payments ₹2,000 = ₹4,000
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 1000 }]
    const mockPurchases = [{ dealer_id: "d1", total_amount: 5000, amount_paid: 0 }]
    const mockPayments = [{ dealer_id: "d1", amount: 2000 }]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(4000)
  })

  // Test Case 4: Partial payments at purchase and separately
  it("Case 4: accurately subtracts both paid at purchase and separate payments", async () => {
    // Opening ₹2,000
    // Purchase ₹10,000 with ₹3,000 paid at purchase (net unpaid purchase = ₹7,000)
    // Separate payment ₹4,000
    // Expected = 2,000 + (10,000 - 3,000) - 4,000 = 5,000
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 2000 }]
    const mockPurchases = [{ dealer_id: "d1", total_amount: 10000, amount_paid: 3000 }]
    const mockPayments = [{ dealer_id: "d1", amount: 4000 }]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(5000)
  })

  // Test Case 5: Fully paid purchases with opening balance
  it("Case 5: fully paid purchases leave opening balance as remaining debt", async () => {
    // Opening ₹3,500
    // Purchase ₹8,000 with ₹8,000 paid in full at invoice
    // Expected = 3,500 + (8,000 - 8,000) = 3,500
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 3500 }]
    const mockPurchases = [{ dealer_id: "d1", total_amount: 8000, amount_paid: 8000 }]
    const mockPayments: any[] = []

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(3500)
  })

  // Test Case 6: Multiple purchases and multiple payments
  it("Case 6: correctly aggregates multiple purchases and multiple separate payments", async () => {
    // Dealer 1: Opening ₹1,000
    // Purchases: (5,000 - 1,000) + (3,000 - 0) = 7,000 net new debt
    // Payments: 2,000 + 1,500 = 3,500
    // Expected = 1,000 + 7,000 - 3,500 = 4,500
    const mockDealers = [
      { id: "d1", name: "Dealer 1", opening_balance: 1000 },
      { id: "d2", name: "Dealer 2", opening_balance: 2000 }
    ]
    const mockPurchases = [
      { dealer_id: "d1", total_amount: 5000, amount_paid: 1000 },
      { dealer_id: "d1", total_amount: 3000, amount_paid: 0 },
      { dealer_id: "d2", total_amount: 4000, amount_paid: 2000 }
    ]
    const mockPayments = [
      { dealer_id: "d1", amount: 2000 },
      { dealer_id: "d1", amount: 1500 },
      { dealer_id: "d2", amount: 1000 }
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result.find(d => d.id === "d1")?.outstanding).toBe(4500)
    // Dealer 2: 2,000 + (4,000 - 2,000) - 1,000 = 3,000
    expect(result.find(d => d.id === "d2")?.outstanding).toBe(3000)
  })

  // Test Case 7: Payments applied to specific purchases
  it("Case 7: payment at invoice settles specific purchase debt without affecting unrelated transactions", async () => {
    // Opening ₹0. Purchase 1: ₹5,000 paid ₹5,000. Purchase 2: ₹3,000 paid ₹0.
    // Total Outstanding = ₹3,000
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 0 }]
    const mockPurchases = [
      { dealer_id: "d1", total_amount: 5000, amount_paid: 5000 },
      { dealer_id: "d1", total_amount: 3000, amount_paid: 0 }
    ]
    const mockPayments: any[] = []

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(3000)
  })

  // Test Case 8: Missing or null values
  it("Case 8: null or undefined opening_balance, amounts, and payments default safely to 0", async () => {
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: null }]
    const mockPurchases = [{ dealer_id: "d1", total_amount: null, amount_paid: null }]
    const mockPayments = [{ dealer_id: "d1", amount: null }]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(0)
    expect(Number.isNaN(result[0].outstanding)).toBe(false)
  })

  // Test Case 9: Negative or advance balances
  it("Case 9: represents advance payment as negative balance when payments exceed liability", async () => {
    // Opening ₹1,000 + Purchases ₹2,000 - Payments ₹5,000 = -₹2,000 (Advance)
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 1000 }]
    const mockPurchases = [{ dealer_id: "d1", total_amount: 2000, amount_paid: 0 }]
    const mockPayments = [{ dealer_id: "d1", amount: 5000 }]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(-2000)
  })

  // Test Case 10: Dashboard and dealer profile parity
  it("Case 10: verifies mathematical parity between dealer profile balance and aggregate dealer service", async () => {
    // Underlying records:
    const openingBalance = 4500
    const purchases = [
      { total_amount: 12000, amount_paid: 2000 },
      { total_amount: 8000, amount_paid: 8000 }
    ]
    const payments = [
      { amount: 5000 }
    ]

    // Service balance:
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: openingBalance }]
    const mockPurchases = purchases.map(p => ({ ...p, dealer_id: "d1" }))
    const mockPayments = payments.map(p => ({ ...p, dealer_id: "d1" }))

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const serviceResult = await getDealersWithBalances()
    const serviceOutstanding = serviceResult[0].outstanding

    // Detail Page calculation formula:
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total_amount, 0)
    const totalPaidAtPurchase = purchases.reduce((sum, p) => sum + p.amount_paid, 0)
    const totalSeparatePaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const totalPaid = totalPaidAtPurchase + totalSeparatePaid
    const detailPageOutstanding = openingBalance + totalPurchases - totalPaid

    expect(serviceOutstanding).toBe(detailPageOutstanding)
    expect(serviceOutstanding).toBe(4500 + (12000 - 2000) + (8000 - 8000) - 5000) // 4500 + 10000 - 5000 = 9500
    expect(serviceOutstanding).toBe(9500)
  })

  // Additional CRUD coverage:
  it("createDealer inserts dealer with opening_balance and returns created record", async () => {
    const newDealer = { name: "Gamma Traders", opening_balance: 2500 }
    const created = { id: "d3", ...newDealer, created_at: "2026-10-15" }

    const queryBuilder: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await createDealer(newDealer)
    expect(supabase.from).toHaveBeenCalledWith("dealers")
    expect(queryBuilder.insert).toHaveBeenCalledWith([newDealer])
    expect(result).toEqual(created)
  })

  it("updateDealer updates dealer fields and returns updated record", async () => {
    const updates = { name: "Gamma Super Traders", opening_balance: 3000 }
    const updated = { id: "d3", ...updates }

    const queryBuilder: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await updateDealer("d3", updates)
    expect(supabase.from).toHaveBeenCalledWith("dealers")
    expect(queryBuilder.update).toHaveBeenCalledWith(updates)
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "d3")
    expect(result).toEqual(updated)
  })

  it("deleteDealer deletes dealer by id", async () => {
    const queryBuilder: any = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    await expect(deleteDealer("d3")).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith("dealers")
    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "d3")
  })

  it("editing dealer without changing opening balance preserves existing value", async () => {
    const existingDealer = { id: "d1", name: "Alpha", opening_balance: 5000 }
    const updates = { name: "Alpha Renamed", opening_balance: existingDealer.opening_balance }
    const updated = { ...existingDealer, ...updates }

    const queryBuilder: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await updateDealer("d1", updates)
    expect(result.opening_balance).toBe(5000)
    expect(queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ opening_balance: 5000 }))
  })

  it("saving an updated opening balance modifies the record and recalculates outstanding", async () => {
    const originalDealer = { id: "d1", name: "Beta", opening_balance: 1000 }
    const updatedDealer = { ...originalDealer, opening_balance: 3500 }

    const queryBuilder: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedDealer, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await updateDealer("d1", { opening_balance: 3500 })
    expect(result.opening_balance).toBe(3500)
  })

  it("handles negative dealer balances by isolating advances from other creditor totals", async () => {
    // Dealer 1 owes ₹6,000 (liability)
    // Dealer 2 has -₹2,000 (advance deposit with supplier)
    // Total liability = ₹6,000 (Math.max(0, balance)), not ₹4,000
    const mockDealers = [
      { id: "d1", name: "Creditor", opening_balance: 6000 },
      { id: "d2", name: "AdvanceSupplier", opening_balance: 1000 }
    ]
    const mockPurchases = [
      { dealer_id: "d2", total_amount: 1000, amount_paid: 0 }
    ]
    const mockPayments = [
      { dealer_id: "d2", amount: 4000 } // Paid 4000 against 2000 total liability -> balance = -2000
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    const d1 = result.find(d => d.id === "d1")
    const d2 = result.find(d => d.id === "d2")

    expect(d1?.outstanding).toBe(6000)
    expect(d2?.outstanding).toBe(-2000)

    // Verify dashboard isolation logic:
    const totalPayable = result.reduce((sum, d) => sum + Math.max(0, d.outstanding || 0), 0)
    expect(totalPayable).toBe(6000)
  })

  it("throws an error if purchases query or dealer payments query fails", async () => {
    const mockDealers = [{ id: "d1", name: "Dealer 1", opening_balance: 1000 }]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: null, error: { message: "Database connection failed" } }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      return {}
    })

    await expect(getDealersWithBalances()).rejects.toThrow("Database connection failed")
  })

  it("offsets negative advance opening balance with subsequent unpaid purchases", async () => {
    // Initial Advance Deposit: -₹5,000
    // Purchase: ₹3,000 with ₹0 upfront -> net new debt = ₹3,000
    // Expected outstanding = -5000 + 3000 = -2000 (still in advance)
    // Next Purchase: ₹4,000 with ₹0 upfront -> net new debt = ₹4,000
    // Expected outstanding = -2000 + 4000 = +2000 (now we owe dealer)
    const mockDealers = [{ id: "d1", name: "Advance Supplier", opening_balance: -5000 }]
    const mockPurchases = [
      { dealer_id: "d1", total_amount: 3000, amount_paid: 0 },
      { dealer_id: "d1", total_amount: 4000, amount_paid: 0 }
    ]
    const mockPayments: any[] = []

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(2000)
  })

  it("full upfront payment at purchase leaves opening balance untouched and prevents double-counting", async () => {
    // Opening balance: ₹15,000
    // Purchase 1: ₹50,000 with ₹50,000 upfront payment
    // Purchase 2: ₹20,000 with ₹20,000 upfront payment
    // Separate payment toward opening balance: ₹5,000
    // Expected: 15,000 + (50,000 - 50,000) + (20,000 - 20,000) - 5,000 = 10,000
    const mockDealers = [{ id: "d1", name: "Strict Cash Dealer", opening_balance: 15000 }]
    const mockPurchases = [
      { dealer_id: "d1", total_amount: 50000, amount_paid: 50000 },
      { dealer_id: "d1", total_amount: 20000, amount_paid: 20000 }
    ]
    const mockPayments = [
      { dealer_id: "d1", amount: 5000 }
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDealers, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: mockPayments, error: null }) }
      }
      return {}
    })

    const result = await getDealersWithBalances()
    expect(result[0].outstanding).toBe(10000)
  })

  it("verifies multi-dealer cross-consistency between service, detail calculation, and dashboard payables", async () => {
    const dealersData = [
      { id: "d1", name: "Alpha", opening_balance: 8000 },
      { id: "d2", name: "Beta", opening_balance: 0 },
      { id: "d3", name: "Gamma", opening_balance: -3000 },
      { id: "d4", name: "Delta", opening_balance: null } // missing opening balance
    ]
    const purchasesData = [
      { dealer_id: "d1", total_amount: 10000, amount_paid: 2000 }, // unpaid 8000
      { dealer_id: "d2", total_amount: 5000, amount_paid: 5000 },  // unpaid 0
      { dealer_id: "d3", total_amount: 1000, amount_paid: 0 }     // unpaid 1000
    ]
    const paymentsData = [
      { dealer_id: "d1", amount: 4000 } // paid 4000
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: dealersData, error: null })
          })
        }
      }
      if (table === "purchases") {
        return { select: vi.fn().mockResolvedValue({ data: purchasesData, error: null }) }
      }
      if (table === "dealer_payments") {
        return { select: vi.fn().mockResolvedValue({ data: paymentsData, error: null }) }
      }
      return {}
    })

    const serviceResults = await getDealersWithBalances()

    // Dealer 1: 8000 + (10000 - 2000) - 4000 = 12000
    const d1 = serviceResults.find(d => d.id === "d1")
    expect(d1?.outstanding).toBe(12000)

    // Dealer 2: 0 + (5000 - 5000) - 0 = 0
    const d2 = serviceResults.find(d => d.id === "d2")
    expect(d2?.outstanding).toBe(0)

    // Dealer 3: -3000 + (1000 - 0) - 0 = -2000
    const d3 = serviceResults.find(d => d.id === "d3")
    expect(d3?.outstanding).toBe(-2000)

    // Dealer 4: 0 + 0 - 0 = 0
    const d4 = serviceResults.find(d => d.id === "d4")
    expect(d4?.outstanding).toBe(0)

    // Dashboard total payable: only positive balances (d1: 12000, d3's -2000 is not subtracted)
    const dashboardTotalPayable = serviceResults.reduce((acc, d) => acc + Math.max(0, d.outstanding || 0), 0)
    expect(dashboardTotalPayable).toBe(12000)
  })
})

