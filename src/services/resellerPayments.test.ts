import { describe, it, expect, vi, beforeEach } from "vitest"
import { 
  getResellerPayments, 
  getResellerPaymentsByCustomer, 
  createResellerPayment 
} from "./resellerPayments"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe("Reseller Payments Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getResellerPayments queries all payments ordered by payment_date desc", async () => {
    const mockPayments = [
      { id: "p1", customer_id: "c1", payment_date: "2026-10-10", amount: 500, payment_method: "CASH" }
    ]

    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockPayments, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await getResellerPayments()
    expect(supabase.from).toHaveBeenCalledWith("reseller_payments")
    expect(queryBuilder.order).toHaveBeenCalledWith("payment_date", { ascending: false })
    expect(result).toEqual(mockPayments)
  })

  it("getResellerPaymentsByCustomer queries payments filtered by customer_id", async () => {
    const mockPayments = [
      { id: "p2", customer_id: "c-target", payment_date: "2026-10-11", amount: 1200, payment_method: "UPI" }
    ]

    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockPayments, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await getResellerPaymentsByCustomer("c-target")
    expect(supabase.from).toHaveBeenCalledWith("reseller_payments")
    expect(queryBuilder.eq).toHaveBeenCalledWith("customer_id", "c-target")
    expect(queryBuilder.order).toHaveBeenCalledWith("payment_date", { ascending: false })
    expect(result).toEqual(mockPayments)
  })

  it("createResellerPayment inserts new payment record into reseller_payments", async () => {
    const paymentPayload = {
      customer_id: "c1",
      payment_date: "2026-10-11",
      amount: 750,
      payment_method: "BANK_TRANSFER",
      reference: "UTR-88219",
      notes: "Advance payment"
    }

    const savedPayment = {
      id: "p-new",
      ...paymentPayload,
      created_at: "2026-10-11T12:00:00Z"
    }

    const queryBuilder: any = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: savedPayment, error: null })
    }

    ;(supabase.from as any).mockReturnValue(queryBuilder)

    const result = await createResellerPayment(paymentPayload)
    expect(supabase.from).toHaveBeenCalledWith("reseller_payments")
    expect(queryBuilder.insert).toHaveBeenCalledWith([paymentPayload])
    expect(result).toEqual(savedPayment)
  })
})
