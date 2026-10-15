import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createCustomerCredit,
  updateCustomerCredit,
  deleteCustomerCredit,
  recordMultiEntryPayment,
  reallocateExistingPayment,
  autoAllocateCustomerPayments,
  calculateCustomerLedgerSummary,
  getCreditTypeLabel,
  getCreditTypeBadgeClasses
} from "./customerCredits"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe("Customer Credits Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Validation & Creation", () => {
    it("successfully creates a Product Credit with product name, quantity, unit, rate, total, paid, and balance", async () => {
      const mockCreated = {
        id: "cred-1",
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        entry_date: "2026-10-15",
        product_name: "Cooking Oil 5L",
        category: "Edible Oils",
        quantity: 10,
        unit: "tins",
        rate_per_unit: 500,
        total_amount: 5000,
        amount_paid: 1000,
        balance: 4000,
        status: "PARTIAL",
        notes: "First batch",
      }

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "cred-1" }, error: null })
        })
      })

      const paymentInsertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "pay-1" }, error: null })
        })
      })

      const allocInsertMock = vi.fn().mockResolvedValue({ error: null })

      const selectSingleMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockCreated, error: null })
        })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return {
            insert: insertMock,
            select: selectSingleMock
          }
        }
        if (table === "reseller_payments") {
          return { insert: paymentInsertMock }
        }
        if (table === "customer_payment_allocations") {
          return { insert: allocInsertMock }
        }
        return {}
      })

      const result = await createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        product_name: "Cooking Oil 5L",
        category: "Edible Oils",
        quantity: 10,
        unit: "tins",
        rate_per_unit: 500,
        total_amount: 5000,
        initial_payment_amount: 1000,
        notes: "First batch"
      })

      expect(supabase.from).toHaveBeenCalledWith("customer_credits")
      expect(insertMock).toHaveBeenCalledWith([expect.objectContaining({
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        product_name: "Cooking Oil 5L",
        category: "Edible Oils",
        quantity: 10,
        unit: "tins",
        rate_per_unit: 500,
        total_amount: 5000
      })])
      expect(result.product_name).toBe("Cooking Oil 5L")
      expect(result.balance).toBe(4000)
    })

    it("requires product_name for PRODUCT_CREDIT and throws error if missing", async () => {
      await expect(createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        product_name: "",
        total_amount: 1000
      })).rejects.toThrow("Product name is required for Product Credit.")
    })

    it("successfully creates a Cash Loan WITHOUT requiring a product name or creating fake products", async () => {
      const mockCreated = {
        id: "loan-1",
        customer_id: "cust-1",
        entry_type: "CASH_LOAN",
        entry_date: "2026-10-15",
        product_id: null,
        product_name: null,
        total_amount: 15000,
        amount_paid: 0,
        balance: 15000,
        status: "PENDING",
        notes: "Emergency cash support"
      }

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "loan-1" }, error: null })
        })
      })

      const selectSingleMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockCreated, error: null })
        })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return {
            insert: insertMock,
            select: selectSingleMock
          }
        }
        return {}
      })

      const result = await createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "CASH_LOAN",
        total_amount: 15000,
        notes: "Emergency cash support"
      })

      expect(insertMock).toHaveBeenCalledWith([expect.objectContaining({
        entry_type: "CASH_LOAN",
        product_name: null,
        product_id: null,
        total_amount: 15000
      })])
      expect(result.product_name).toBeNull()
      expect(result.total_amount).toBe(15000)
      expect(result.balance).toBe(15000)
    })

    it("requires description for OTHER_CREDIT and creates entry successfully", async () => {
      await expect(createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "OTHER_CREDIT",
        description: "",
        total_amount: 2500
      })).rejects.toThrow("Description is required for Other Credit.")

      const mockOther = {
        id: "other-1",
        customer_id: "cust-1",
        entry_type: "OTHER_CREDIT",
        description: "Delivery truck repair reimbursement",
        total_amount: 2500,
        amount_paid: 0,
        balance: 2500,
        status: "PENDING"
      }

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "other-1" }, error: null })
              })
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockOther, error: null })
              })
            })
          }
        }
        return {}
      })

      const res = await createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "OTHER_CREDIT",
        description: "Delivery truck repair reimbursement",
        total_amount: 2500
      })

      expect(res.description).toBe("Delivery truck repair reimbursement")
      expect(res.total_amount).toBe(2500)
    })
  })

  describe("Editing & Deleting Credit Entries", () => {
    it("successfully edits product credit details including quantity, rate, total, and notes", async () => {
      const mockUpdated = {
        id: "cred-1",
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        product_name: "Cooking Oil 15L",
        quantity: 5,
        unit: "tins",
        rate_per_unit: 1400,
        total_amount: 7000,
        notes: "Updated batch size"
      }

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
        })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return {
            update: updateMock,
            select: selectMock
          }
        }
        return {}
      })

      const res = await updateCustomerCredit("cred-1", {
        product_name: "Cooking Oil 15L",
        quantity: 5,
        rate_per_unit: 1400,
        total_amount: 7000,
        notes: "Updated batch size"
      })

      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        product_name: "Cooking Oil 15L",
        quantity: 5,
        rate_per_unit: 1400,
        total_amount: 7000,
        notes: "Updated batch size"
      }))
      expect(res.product_name).toBe("Cooking Oil 15L")
      expect(res.total_amount).toBe(7000)
    })

    it("rejects editing with invalid or empty required fields", async () => {
      await expect(updateCustomerCredit("cred-1", {
        entry_type: "PRODUCT_CREDIT",
        product_name: ""
      })).rejects.toThrow("Product name is required")

      await expect(updateCustomerCredit("cred-1", {
        entry_type: "OTHER_CREDIT",
        description: ""
      })).rejects.toThrow("Description is required")

      await expect(updateCustomerCredit("cred-1", {
        total_amount: -50
      })).rejects.toThrow("Total amount must be greater than zero")
    })

    it("successfully deletes a credit entry", async () => {
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return { delete: deleteMock }
        }
        return {}
      })

      await deleteCustomerCredit("cred-1")
      expect(deleteMock).toHaveBeenCalled()
    })
  })

  describe("Multi-Entry Payment Allocation & Repayments", () => {
    it("records a single payment covering multiple entries with explicit allocations and advances", async () => {
      const mockPayment = {
        id: "pay-100",
        customer_id: "cust-1",
        payment_date: "2026-10-15",
        amount: 2000,
      }

      const insertPayMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPayment, error: null })
        })
      })

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_payments") {
          return { insert: insertPayMock }
        }
        if (table === "customer_payment_allocations") {
          return { insert: insertAllocMock }
        }
        return {}
      })

      // Customer owes:
      // Product Credit cred-1: owes 1000 -> allocate 800
      // Cash Loan loan-1: owes 600 -> allocate 600
      // Remaining 600 -> customer advance
      const result = await recordMultiEntryPayment({
        customerId: "cust-1",
        totalAmount: 2000,
        paymentDate: "2026-10-15",
        paymentMethod: "BANK_TRANSFER",
        reference: "TXN-9988",
        allocations: [
          { creditId: "cred-1", amount: 800, notes: "Partial for oil" },
          { creditId: "loan-1", amount: 600, notes: "Full repayment for loan" }
        ]
      })

      expect(insertPayMock).toHaveBeenCalledWith([expect.objectContaining({
        customer_id: "cust-1",
        amount: 2000,
        payment_method: "BANK_TRANSFER",
        reference: "TXN-9988"
      })])

      expect(insertAllocMock).toHaveBeenCalledWith([
        { payment_id: "pay-100", credit_id: "cred-1", amount: 800, notes: "Partial for oil" },
        { payment_id: "pay-100", credit_id: "loan-1", amount: 600, notes: "Full repayment for loan" }
      ])

      expect(result.totalAmount).toBe(2000)
      expect(result.allocatedAmount).toBe(1400)
      expect(result.advanceAmount).toBe(600)
    })

    it("rejects multi-entry allocation when allocated sum exceeds payment amount", async () => {
      await expect(recordMultiEntryPayment({
        customerId: "cust-1",
        totalAmount: 1000,
        paymentDate: "2026-10-15",
        allocations: [
          { creditId: "cred-1", amount: 700 },
          { creditId: "cred-2", amount: 500 } // sum = 1200 > 1000
        ]
      })).rejects.toThrow("cannot exceed payment amount")
    })

    it("reallocates an existing payment by safely replacing previous allocations", async () => {
      // 1. Existing payment has 1 prior allocation to cred-1
      const selectAllocationsMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ credit_id: "cred-1" }],
          error: null
        })
      })

      const deleteAllocationsMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      const insertAllocationsMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_payments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "pay-100", amount: 1000 },
                  error: null
                })
              })
            })
          }
        }
        if (table === "customer_payment_allocations") {
          return {
            select: selectAllocationsMock,
            delete: deleteAllocationsMock,
            insert: insertAllocationsMock
          }
        }
        if (table === "customer_credits") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "cred-2", total_amount: 1000 },
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        return {}
      })

      await reallocateExistingPayment("pay-100", [
        { creditId: "cred-2", amount: 500, notes: "Moved to cred-2" }
      ])

      expect(deleteAllocationsMock).toHaveBeenCalled()
      expect(insertAllocationsMock).toHaveBeenCalledWith([
        { payment_id: "pay-100", credit_id: "cred-2", amount: 500, notes: "Moved to cred-2" }
      ])
    })

    it("auto-allocates unallocated payments to pending credits in chronological FIFO order", async () => {
      const pendingCredits = [
        { id: "cred-diaper", total_amount: 1920, amount_paid: 0, balance: 1920, entry_date: "2026-10-10" },
        { id: "cred-dates", total_amount: 350, amount_paid: 0, balance: 350, entry_date: "2026-10-12" }
      ]

      const unallocatedPayments = [
        {
          id: "pay-ummer-1",
          amount: 1725,
          customer_payment_allocations: [] // 0 allocations -> entire 1725 unallocated
        }
      ]

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: pendingCredits, error: null })
                  })
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === "reseller_payments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: unallocatedPayments, error: null })
                })
              })
            })
          }
        }
        if (table === "customer_payment_allocations") {
          return {
            insert: insertAllocMock,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ amount: 1725 }], error: null })
            })
          }
        }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-ummer")

      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(1725)
      expect(insertAllocMock).toHaveBeenCalledWith([
        {
          payment_id: "pay-ummer-1",
          credit_id: "cred-diaper",
          amount: 1725,
          notes: "Auto-allocated payment"
        }
      ])
    })
  })

  describe("Ledger Calculation & Distinction", () => {
    it("calculates exact customer totals distinguishing Product Credit, Cash Loans, Other Credit, Wholesale, and Advances", () => {
      const credits: any[] = [
        // Product credits: 2 items taken
        {
          id: "pc1",
          entry_type: "PRODUCT_CREDIT",
          product_name: "Cooking Oil",
          total_amount: 5000,
          amount_paid: 2000,
          balance: 3000,
          status: "PARTIAL"
        },
        {
          id: "pc2",
          entry_type: "PRODUCT_CREDIT",
          product_name: "Basmati Rice",
          total_amount: 4000,
          amount_paid: 4000,
          balance: 0,
          status: "PAID"
        },
        // Cash Loan: 1 loan
        {
          id: "cl1",
          entry_type: "CASH_LOAN",
          total_amount: 10000,
          amount_paid: 3000,
          balance: 7000,
          status: "PARTIAL"
        },
        // Other Credit: 1 service
        {
          id: "oc1",
          entry_type: "OTHER_CREDIT",
          description: "Packaging service",
          total_amount: 1500,
          amount_paid: 500,
          balance: 1000,
          status: "PARTIAL"
        }
      ]

      const sales: any[] = [
        { total_sale: 8000, amount_received: 3000 } // balance 5000
      ]

      // Separate payments:
      // 2000 (for pc1) + 4000 (for pc2) + 3000 (for cl1) + 500 (for oc1) = 9500 allocated
      // Plus 1000 unallocated payment made by customer
      const payments: any[] = [
        { amount: 2000 },
        { amount: 4000 },
        { amount: 3000 },
        { amount: 500 },
        { amount: 1000 } // unallocated advance payment
      ]

      const openingBalance = 500

      const summary = calculateCustomerLedgerSummary(credits, sales, payments, openingBalance)

      // 1. Product Credit breakdown
      expect(summary.productCreditTotal).toBe(9000)
      expect(summary.productCreditPaid).toBe(6000)
      expect(summary.productCreditOutstanding).toBe(3000)
      expect(summary.productCreditCount).toBe(2)

      // 2. Cash Loan breakdown
      expect(summary.cashLoanTotal).toBe(10000)
      expect(summary.cashLoanPaid).toBe(3000)
      expect(summary.cashLoanOutstanding).toBe(7000)
      expect(summary.cashLoanCount).toBe(1)

      // 3. Other Credit breakdown
      expect(summary.otherCreditTotal).toBe(1500)
      expect(summary.otherCreditPaid).toBe(500)
      expect(summary.otherCreditOutstanding).toBe(1000)
      expect(summary.otherCreditCount).toBe(1)

      // 4. Wholesale Sales breakdown
      expect(summary.wholesaleSalesTotal).toBe(8000)
      expect(summary.wholesaleSalesPaid).toBe(3000)
      expect(summary.wholesaleSalesOutstanding).toBe(5000)

      // 5. Total Debits (Charges):
      // 500 (opening) + 8000 (sales) + 9000 (product credits) + 10000 (cash loan) + 1500 (other credit) = 29000
      expect(summary.totalCharges).toBe(29000)

      // 6. Total Credits (Payments):
      // 3000 (sale upfront) + 10500 (separate payments) = 13500
      expect(summary.totalCredits).toBe(13500)

      // 7. Net Total Outstanding:
      // 29000 - 13500 = 15500
      // Notice: 3000 (pc) + 7000 (cl) + 1000 (oc) + 5000 (sales) + 500 (opening) - 1000 (advance) = 15500!
      expect(summary.netOutstanding).toBe(15500)
    })

    it("identifies and reconciles the screenshot discrepancy: product total 2,270, payments 1,725, net 545, with unallocated payments accounted for", () => {
      // Replicate the exact situation from the user prompt & screenshot:
      // Two credit entries:
      // 1. diaper: qty 4 @ 480 = 1920
      // 2. dates: qty 1 @ 350 = 350
      // Sum = 2270
      const initialCredits: any[] = [
        {
          id: "c1",
          entry_type: "PRODUCT_CREDIT",
          product_name: "diaper",
          quantity: 4,
          rate_per_unit: 480,
          total_amount: 1920,
          amount_paid: 0, // Initially 0 paid because allocations weren't linked
          balance: 1920,
          status: "PENDING"
        },
        {
          id: "c2",
          entry_type: "PRODUCT_CREDIT",
          product_name: "dates",
          quantity: 1,
          rate_per_unit: 350,
          total_amount: 350,
          amount_paid: 0, // Initially 0 paid
          balance: 350,
          status: "PENDING"
        }
      ]

      // Payment recorded: 1725, but allocations were missing
      const payments: any[] = [
        { id: "p1", amount: 1725, payment_date: "2026-10-14" }
      ]

      // Step 1: Check summary before allocation
      const summaryBefore = calculateCustomerLedgerSummary(initialCredits, [], payments, 0)
      expect(summaryBefore.productCreditTotal).toBe(2270)
      expect(summaryBefore.totalCredits).toBe(1725)
      expect(summaryBefore.netOutstanding).toBe(545) // 2270 - 1725 = 545
      // Item level paid sum is 0
      expect(summaryBefore.productCreditPaid).toBe(0)
      // Discrepancy detector correctly surfaces 1725 unallocated payments
      expect(summaryBefore.unallocatedPayments).toBe(1725)

      // Step 2: Now simulate after auto-allocating the 1725 payment FIFO to the oldest entry (c1 diaper)
      const reconciledCredits: any[] = [
        {
          id: "c1",
          entry_type: "PRODUCT_CREDIT",
          product_name: "diaper",
          quantity: 4,
          rate_per_unit: 480,
          total_amount: 1920,
          amount_paid: 1725, // 1725 allocated
          balance: 195,      // 1920 - 1725 = 195
          status: "PARTIAL"
        },
        {
          id: "c2",
          entry_type: "PRODUCT_CREDIT",
          product_name: "dates",
          quantity: 1,
          rate_per_unit: 350,
          total_amount: 350,
          amount_paid: 0,
          balance: 350,
          status: "PENDING"
        }
      ]

      const summaryAfter = calculateCustomerLedgerSummary(reconciledCredits, [], payments, 0)
      expect(summaryAfter.productCreditTotal).toBe(2270)
      expect(summaryAfter.productCreditPaid).toBe(1725)
      expect(summaryAfter.productCreditOutstanding).toBe(545)
      expect(summaryAfter.netOutstanding).toBe(545)
      expect(summaryAfter.unallocatedPayments).toBe(0)
      // The row balances (195 + 350) now sum to EXACTLY the net outstanding 545!
      expect(reconciledCredits[0].balance + reconciledCredits[1].balance).toBe(summaryAfter.netOutstanding)
    })
  })

  describe("UI Labels & Badges", () => {
    it("returns correct user-facing labels and badge styles distinguishing credit types", () => {
      expect(getCreditTypeLabel("PRODUCT_CREDIT")).toBe("Product Credit")
      expect(getCreditTypeLabel("CASH_LOAN")).toBe("Cash Loan")
      expect(getCreditTypeLabel("OTHER_CREDIT")).toBe("Other Credit")

      const pcBadge = getCreditTypeBadgeClasses("PRODUCT_CREDIT")
      expect(pcBadge.text).toContain("emerald")

      const clBadge = getCreditTypeBadgeClasses("CASH_LOAN")
      expect(clBadge.text).toContain("amber")

      const ocBadge = getCreditTypeBadgeClasses("OTHER_CREDIT")
      expect(ocBadge.text).toContain("purple")
    })
  })
})
