import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUnifiedReceivables } from "./receivables"
import { supabase } from "@/lib/supabase"
import { getnaeemMonthlyBalance } from "@/services/naeemDeliveries"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock("@/services/naeemDeliveries", () => ({
  getnaeemMonthlyBalance: vi.fn(),
}))

describe("getUnifiedReceivables service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getnaeemMonthlyBalance as any).mockResolvedValue({ opening_balance: 1000, is_manual_override: false })
  })

  it("accurately unifies receivables across Wholesale, NAEEM, and General Deliveries without double counting", async () => {
    const mockResellers = [
      { id: "r1", name: "Metro Retailers", phone: "9876543210" },
      { id: "r2", name: "Settled Store", phone: "9876543211" },
    ]

    const mockSales = [
      { id: "s1", customer_id: "r1", total_sale: 25000, amount_received: 10000, sale_date: "2026-10-01" },
      { id: "s2", customer_id: "r2", total_sale: 5000, amount_received: 5000, sale_date: "2026-10-02" },
    ]

    const mockResellerPayments = [
      { id: "rp1", customer_id: "r1", amount: 5000, payment_date: "2026-10-05" },
    ]

    const mockNaeemDeliveries = [
      { id: "nd1", final_fare: 4000, status: "Completed", delivery_date: "2026-10-04" },
      { id: "nd2", final_fare: 0, status: "No Order", delivery_date: "2026-10-05" },
    ]

    const mockNaeemPayments = [
      { id: "np1", amount: 2000, payment_date: "2026-10-06" },
    ]

    const mockGeneralEntries = [
      {
        id: "ge1",
        daily_record_id: "dr1",
        customer_name: "Ahmed Express",
        description: "Bulk shipment",
        amount: 3500,
        received_amount: 1500,
        daily_record: { record_date: "2026-10-07" },
      },
      {
        id: "ge2",
        daily_record_id: "dr2",
        customer_name: "Settled Express",
        description: "Paid order",
        amount: 2000,
        received_amount: 2000,
        daily_record: { record_date: "2026-10-08" },
      },
    ]

    const fromMock = vi.fn().mockImplementation((table: string) => {
      const q: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        then: function (resolve: any) {
          resolve({ data: [] })
        },
      }

      if (table === "reseller_customers") {
        q.order = vi.fn().mockResolvedValue({ data: mockResellers })
        q.then = function (resolve: any) {
          resolve({ data: mockResellers })
        }
      } else if (table === "wholesale_sales") {
        q.limit = vi.fn().mockResolvedValue({ data: mockSales })
        q.then = function (resolve: any) {
          resolve({ data: mockSales })
        }
      } else if (table === "reseller_payments") {
        q.limit = vi.fn().mockResolvedValue({ data: mockResellerPayments })
        q.then = function (resolve: any) {
          resolve({ data: mockResellerPayments })
        }
      } else if (table === "naeem_daily_records") {
        q.order = vi.fn().mockResolvedValue({ data: mockNaeemDeliveries })
        q.then = function (resolve: any) {
          resolve({ data: mockNaeemDeliveries })
        }
      } else if (table === "naeem_payments") {
        q.order = vi.fn().mockResolvedValue({ data: mockNaeemPayments })
        q.then = function (resolve: any) {
          resolve({ data: mockNaeemPayments })
        }
      } else if (table === "general_delivery_entries") {
        q.limit = vi.fn().mockResolvedValue({ data: mockGeneralEntries })
        q.then = function (resolve: any) {
          resolve({ data: mockGeneralEntries })
        }
      }

      return q
    })

    ;(supabase.from as any) = fromMock

    const summary = await getUnifiedReceivables(2026, 10)

    // Reseller r1: 25,000 sales - (10,000 received at sale + 5,000 separate payment) = 10,000 outstanding
    // Reseller r2: 5,000 - 5,000 = 0 (settled, omitted from positive collection debtors)
    expect(summary.wholesaleOutstanding).toBe(10000)

    // NAEEM: 1000 opening + 4000 deliveries - 2000 payments = 3000 outstanding
    expect(summary.naeemOutstanding).toBe(3000)

    // General delivery ge1: 3500 - 1500 = 2000 outstanding
    // General delivery ge2: 2000 - 2000 = 0 (settled, omitted)
    expect(summary.otherOutstanding).toBe(2000)

    // Total: 10000 + 3000 + 2000 = 15000
    expect(summary.totalOutstanding).toBe(15000)
    expect(summary.debtorsCount).toBe(3)

    // Check debtors in descending order
    expect(summary.debtors[0].name).toBe("Metro Retailers")
    expect(summary.debtors[0].outstanding).toBe(10000)
    expect(summary.debtors[0].source).toBe("WHOLESALE_RESELLER")
    expect(summary.debtors[0].lastPaymentDate).toBe("2026-10-05")

    expect(summary.debtors[1].name).toBe("NAEEM Dedicated Route")
    expect(summary.debtors[1].outstanding).toBe(3000)
    expect(summary.debtors[1].source).toBe("NAEEM")
    expect(summary.debtors[1].routePath).toBe("/naeem?action=payment")

    expect(summary.debtors[2].name).toBe("Ahmed Express")
    expect(summary.debtors[2].outstanding).toBe(2000)
    expect(summary.debtors[2].source).toBe("GENERAL_DELIVERY")
  })
})
