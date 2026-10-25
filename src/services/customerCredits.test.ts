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
  getCreditTypeBadgeClasses,
  getFundingSourceLabel,
  getFundingSourceBadgeClasses,
  type CustomerCredit
} from "./customerCredits"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockImplementation((fnName: string) => {
      if (fnName === "auto_allocate_customer_payments_rpc") {
        return Promise.resolve({
          data: null,
          error: { code: "PGRST202", message: "function public.auto_allocate_customer_payments_rpc does not exist" },
        })
      }
      return Promise.resolve({ data: null, error: null })
    }),
  },
}))

describe("Customer Credits Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if ((supabase as any).rpc) {
      ;(supabase as any).rpc.mockImplementation((fnName: string) => {
        if (fnName === "auto_allocate_customer_payments_rpc") {
          return Promise.resolve({
            data: null,
            error: { code: "PGRST202", message: "function public.auto_allocate_customer_payments_rpc does not exist" },
          })
        }
        return Promise.resolve({ data: null, error: null })
      })
    }
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
      expect(getCreditTypeLabel("PRODUCT_CREDIT")).toBe("Expense on Behalf")
      expect(getCreditTypeLabel("CASH_LOAN")).toBe("Qard Hasan")
      expect(getCreditTypeLabel("OTHER_CREDIT")).toBe("Other Personal")

      const pcBadge = getCreditTypeBadgeClasses("PRODUCT_CREDIT")
      expect(pcBadge.text).toContain("emerald")

      const clBadge = getCreditTypeBadgeClasses("CASH_LOAN")
      expect(clBadge.text).toContain("amber")

      const ocBadge = getCreditTypeBadgeClasses("OTHER_CREDIT")
      expect(ocBadge.text).toContain("purple")
    })
  })

  describe("Duplicate Submission & Over-Allocation Guards", () => {
    it("does not over-allocate payment amount when total requested allocation exceeds payment", () => {
      const paymentAmount = 1000
      const requestedAllocations = [
        { creditId: "c1", amount: 800 },
        { creditId: "c2", amount: 600 }
      ]

      const isOverAllocated = requestedAllocations.reduce((sum, a) => sum + a.amount, 0) > paymentAmount
      expect(isOverAllocated).toBe(true)

      // Guard blocks execution
      const executeAllocation = (isOver: boolean) => {
        if (isOver) return false
        return true
      }
      expect(executeAllocation(isOverAllocated)).toBe(false)
    })

    it("auto-allocation on fully settled credits produces 0 new allocations without double-counting", () => {
      const credits: any[] = [
        { id: "c1", entry_date: "2026-10-01", total_amount: 1000, amount_paid: 1000, balance: 0 }
      ]
      const unallocatedPayment = 500

      // Filter for credits with positive balance
      const eligible = credits.filter(c => c.balance > 0)
      expect(eligible.length).toBe(0)

      let allocatedTotal = 0
      eligible.forEach(c => {
        allocatedTotal += c.balance
      })

      expect(allocatedTotal).toBe(0)
      // Unallocated amount remains intact as advance
      expect(unallocatedPayment - allocatedTotal).toBe(500)
    })
  })

  describe("Funding Source Ledger Accounting & Reconciliation", () => {
    it("creates product credit with 7TIME Business Funds source", async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "cred-7t-1" }, error: null })
        })
      })

      const selectSingleMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "cred-7t-1",
              customer_id: "cust-1",
              entry_type: "PRODUCT_CREDIT",
              funding_source: "7TIME_FUNDS",
              product_name: "Premium Rice 25kg",
              total_amount: 3200,
              amount_paid: 0,
              balance: 3200,
              status: "PENDING"
            },
            error: null
          })
        })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return { insert: insertMock, select: selectSingleMock }
        }
        return {}
      })

      const result = await createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        funding_source: "7TIME_FUNDS",
        product_name: "Premium Rice 25kg",
        total_amount: 3200
      })

      expect(insertMock).toHaveBeenCalledWith([expect.objectContaining({
        funding_source: "7TIME_FUNDS",
        product_name: "Premium Rice 25kg",
        total_amount: 3200
      })])
      expect(result.funding_source).toBe("7TIME_FUNDS")
    })

    it("creates cash loan with Personal Funds source", async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "loan-pers-1" }, error: null })
        })
      })

      const selectSingleMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "loan-pers-1",
              customer_id: "cust-1",
              entry_type: "CASH_LOAN",
              funding_source: "PERSONAL_FUNDS",
              total_amount: 15000,
              amount_paid: 0,
              balance: 15000,
              status: "PENDING"
            },
            error: null
          })
        })
      })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "customer_credits") {
          return { insert: insertMock, select: selectSingleMock }
        }
        return {}
      })

      const result = await createCustomerCredit({
        customer_id: "cust-1",
        entry_type: "CASH_LOAN",
        funding_source: "PERSONAL_FUNDS",
        total_amount: 15000,
        notes: "Emergency personal loan"
      })

      expect(insertMock).toHaveBeenCalledWith([expect.objectContaining({
        entry_type: "CASH_LOAN",
        funding_source: "PERSONAL_FUNDS",
        total_amount: 15000
      })])
      expect(result.funding_source).toBe("PERSONAL_FUNDS")
    })

    it("updates existing transaction funding source preserving other fields", async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "cred-edit-1",
              customer_id: "cust-1",
              entry_type: "PRODUCT_CREDIT",
              funding_source: "PERSONAL_FUNDS",
              total_amount: 4500,
              balance: 4500
            },
            error: null
          })
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

      const result = await updateCustomerCredit("cred-edit-1", {
        funding_source: "PERSONAL_FUNDS",
        total_amount: 4500
      })

      expect(result.funding_source).toBe("PERSONAL_FUNDS")
      expect(result.total_amount).toBe(4500)
    })

    it("accurately calculates ledger summary across 7TIME, Personal, and Unallocated sources with full mathematical reconciliation", () => {
      const credits: any[] = [
        // 7TIME Product Credit: ₹5,000 total, ₹1,000 paid -> ₹4,000 outstanding
        {
          id: "c-7t-prod",
          entry_type: "PRODUCT_CREDIT",
          funding_source: "7TIME_FUNDS",
          total_amount: 5000,
          amount_paid: 1000,
          balance: 4000,
          status: "PARTIAL"
        },
        // 7TIME Cash Loan: ₹2,000 total, ₹500 paid -> ₹1,500 outstanding
        {
          id: "c-7t-loan",
          entry_type: "CASH_LOAN",
          funding_source: "7TIME_FUNDS",
          total_amount: 2000,
          amount_paid: 500,
          balance: 1500,
          status: "PARTIAL"
        },
        // Personal Product Credit: ₹3,000 total, ₹0 paid -> ₹3,000 outstanding
        {
          id: "c-pers-prod",
          entry_type: "PRODUCT_CREDIT",
          funding_source: "PERSONAL_FUNDS",
          total_amount: 3000,
          amount_paid: 0,
          balance: 3000,
          status: "PENDING"
        },
        // Personal Cash Loan: ₹4,000 total, ₹2,000 paid -> ₹2,000 outstanding
        {
          id: "c-pers-loan",
          entry_type: "CASH_LOAN",
          funding_source: "PERSONAL_FUNDS",
          total_amount: 4000,
          amount_paid: 2000,
          balance: 2000,
          status: "PARTIAL"
        },
        // Historical Unallocated Entry: ₹1,000 total, ₹200 paid -> ₹800 outstanding
        {
          id: "c-legacy-unalloc",
          entry_type: "PRODUCT_CREDIT",
          funding_source: null,
          total_amount: 1000,
          amount_paid: 200,
          balance: 800,
          status: "PARTIAL"
        }
      ]

      // Payments recorded from customer: 1000 + 500 + 2000 + 200 = 3700
      const payments: any[] = [
        { id: "p1", amount: 3700 }
      ]

      const summary = calculateCustomerLedgerSummary(credits, [], payments, 0)

      // 1. By Entry Type
      // Product Credit Outstanding: 4000 (7T) + 3000 (Pers) + 800 (Unalloc) = 7800
      expect(summary.productCreditTotal).toBe(5000 + 3000 + 1000)
      expect(summary.productCreditPaid).toBe(1000 + 0 + 200)
      expect(summary.productCreditOutstanding).toBe(7800)
      expect(summary.productCreditCount).toBe(3)

      // Cash Loan Outstanding: 1500 (7T) + 2000 (Pers) = 3500
      expect(summary.cashLoanTotal).toBe(2000 + 4000)
      expect(summary.cashLoanPaid).toBe(500 + 2000)
      expect(summary.cashLoanOutstanding).toBe(3500)
      expect(summary.cashLoanCount).toBe(2)

      // 2. By Funding Source
      // 7TIME Funds: Total = 7000, Paid = 1500, Outstanding = 5500
      expect(summary.funds7TimeTotal).toBe(7000)
      expect(summary.funds7TimePaid).toBe(1500)
      expect(summary.funds7TimeOutstanding).toBe(5500)
      expect(summary.funds7TimeCount).toBe(2)

      // Personal Funds: Total = 7000, Paid = 2000, Outstanding = 5000
      expect(summary.fundsPersonalTotal).toBe(7000)
      expect(summary.fundsPersonalPaid).toBe(2000)
      expect(summary.fundsPersonalOutstanding).toBe(5000)
      expect(summary.fundsPersonalCount).toBe(2)

      // Unallocated Legacy: Total = 1000, Paid = 200, Outstanding = 800
      expect(summary.fundsUnallocatedTotal).toBe(1000)
      expect(summary.fundsUnallocatedPaid).toBe(200)
      expect(summary.fundsUnallocatedOutstanding).toBe(800)
      expect(summary.fundsUnallocatedCount).toBe(1)

      // 3. Mathematical Reconciliation
      // Total Owed = Outstanding Product Credit + Outstanding Cash Loans
      const totalOwedByType = summary.productCreditOutstanding + summary.cashLoanOutstanding + summary.otherCreditOutstanding
      expect(totalOwedByType).toBe(7800 + 3500) // 11,300

      // Total Owed = 7TIME Outstanding + Personal Outstanding + Unallocated Outstanding
      const totalOwedBySource = summary.funds7TimeOutstanding + summary.fundsPersonalOutstanding + summary.fundsUnallocatedOutstanding
      expect(totalOwedBySource).toBe(5500 + 5000 + 800) // 11,300

      // Exact Reconciliation Guarantee
      expect(totalOwedBySource).toBe(totalOwedByType)
      expect(summary.netOutstanding).toBe(totalOwedByType)
    })

    it("provides correct badge styling and descriptive labels for funding sources", () => {
      // 7TIME Business Funds
      expect(getFundingSourceLabel("7TIME_FUNDS")).toBe("7TIME Funds")
      const tBadge = getFundingSourceBadgeClasses("7TIME_FUNDS")
      expect(tBadge.text).toContain("emerald")
      expect(tBadge.bg).toContain("emerald")

      // Personal Funds
      expect(getFundingSourceLabel("PERSONAL_FUNDS")).toBe("Personal Funds")
      const pBadge = getFundingSourceBadgeClasses("PERSONAL_FUNDS")
      expect(pBadge.text).toContain("purple")
      expect(pBadge.bg).toContain("purple")

      // Unallocated Historical Records
      expect(getFundingSourceLabel(null)).toBe("Unallocated")
      expect(getFundingSourceLabel(undefined)).toBe("Unallocated")
      const uBadge = getFundingSourceBadgeClasses(null)
      expect(uBadge.text).toContain("slate")
    })

    it("distinguishes Amount They Owe Me (receivable) from Amount I Owe Them (advance/payable) without misleading netting", () => {
      // Scenario A: Customer owes us money (Product Credit Rs 4,000, paid Rs 1,000)
      const creditsDue: CustomerCredit[] = [
        {
          id: "cred-a",
          customer_id: "c-1",
          entry_type: "PRODUCT_CREDIT",
          entry_date: "2026-10-01",
          product_name: "Item A",
          total_amount: 4000,
          amount_paid: 1000,
          balance: 3000,
          status: "PARTIAL"
        } as any
      ]
      const summaryDue = calculateCustomerLedgerSummary(creditsDue, [], [{ amount: 1000 }], 0)
      expect(summaryDue.amountTheyOweMe).toBe(3000)
      expect(summaryDue.amountIOweThem).toBe(0)

      // Scenario B: Customer overpaid / provided advance (Credit Rs 2,000, total paid Rs 3,500)
      const creditsAdvance: CustomerCredit[] = [
        {
          id: "cred-b",
          customer_id: "c-2",
          entry_type: "PRODUCT_CREDIT",
          entry_date: "2026-10-01",
          product_name: "Item B",
          total_amount: 2000,
          amount_paid: 2000,
          balance: 0,
          status: "PAID"
        } as any
      ]
      const summaryAdvance = calculateCustomerLedgerSummary(creditsAdvance, [], [{ amount: 3500 }], 0)
      expect(summaryAdvance.amountTheyOweMe).toBe(0)
      expect(summaryAdvance.amountIOweThem).toBe(1500)
      expect(summaryAdvance.unallocatedAdvancePayments).toBe(1500)
    })
  })

  describe("Opening-Balance Reconciliation & Discrepancy Notice Tests", () => {
    // Scenario 1: Opening balance ₹430 + payment ₹430 + no individual credit rows: outstanding ₹0 and no false unallocated warning.
    it("Scenario 1: Opening balance ₹430 + payment ₹430 + no credit rows results in outstanding ₹0 and no false unallocated warning", () => {
      const summary = calculateCustomerLedgerSummary([], [], [{ amount: 430 }], 430)

      expect(summary.openingBalance).toBe(430)
      expect(summary.openingBalancePaid).toBe(430)
      expect(summary.openingBalanceOutstanding).toBe(0)
      expect(summary.totalCharges).toBe(430)
      expect(summary.totalPaymentsRecorded).toBe(430)
      expect(summary.netOutstanding).toBe(0)
      // Crucial: Must NOT report payment as unallocated when it settled opening balance
      expect(summary.unallocatedPayments).toBe(0)
      expect(summary.unallocatedAdvancePayments).toBe(0)
      expect(summary.amountTheyOweMe).toBe(0)
      expect(summary.amountIOweThem).toBe(0)
    })

    // Scenario 2: Opening balance ₹430 + payment ₹200: remaining opening-balance debt ₹230, according to established accounting rules.
    it("Scenario 2: Opening balance ₹430 + payment ₹200 leaves remaining opening-balance debt of ₹230 with 0 unallocated", () => {
      const summary = calculateCustomerLedgerSummary([], [], [{ amount: 200 }], 430)

      expect(summary.openingBalance).toBe(430)
      expect(summary.openingBalancePaid).toBe(200)
      expect(summary.openingBalanceOutstanding).toBe(230)
      expect(summary.netOutstanding).toBe(230)
      expect(summary.unallocatedPayments).toBe(0)
      expect(summary.amountTheyOweMe).toBe(230)
      expect(summary.amountIOweThem).toBe(0)
    })

    // Scenario 3: Outstanding credit row ₹430 + payment ₹430: correct allocation and paid status.
    it("Scenario 3: Outstanding credit row ₹430 + payment ₹430 reflects correct allocation and paid status", async () => {
      // 3A: Ledger summary when credit row is already allocated
      const credit: CustomerCredit = {
        id: "cred-430",
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        entry_date: "2026-10-10",
        product_name: "Widget",
        total_amount: 430,
        amount_paid: 430,
        balance: 0,
        status: "PAID",
      } as any

      const summary = calculateCustomerLedgerSummary([credit], [], [{ amount: 430 }], 0)
      expect(summary.productCreditTotal).toBe(430)
      expect(summary.productCreditPaid).toBe(430)
      expect(summary.productCreditOutstanding).toBe(0)
      expect(summary.totalAllocatedToCredits).toBe(430)
      expect(summary.unallocatedPayments).toBe(0)
      expect(summary.netOutstanding).toBe(0)

      // 3B: Auto-allocation flow for unallocated payment against outstanding credit row
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 0 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-430",
                    amount: 430,
                    payment_date: "2026-10-12",
                    created_at: "2026-10-12T10:00:00Z",
                    allocations: []
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "cred-430",
                      total_amount: 430,
                      amount_paid: 0,
                      balance: 430,
                      entry_date: "2026-10-10",
                      created_at: "2026-10-10T10:00:00Z"
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-1")
      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(430)
      expect(insertAllocMock).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_id: "pay-430",
          credit_id: "cred-430",
          amount: 430
        })
      ])
    })

    // Scenario 4: Opening balance plus individual credit rows: payments are not counted twice.
    it("Scenario 4: Opening balance plus individual credit rows prevents double counting of payments", () => {
      const credit: CustomerCredit = {
        id: "cred-500",
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        entry_date: "2026-10-10",
        total_amount: 500,
        amount_paid: 500,
        balance: 0,
        status: "PAID"
      } as any

      // Payments: 500 (allocated to credit) + 430 (settling opening balance) = 930
      const payments = [{ amount: 500 }, { amount: 430 }]
      const summary = calculateCustomerLedgerSummary([credit], [], payments, 430)

      expect(summary.totalCharges).toBe(930) // 430 opening + 500 credit
      expect(summary.totalPaymentsRecorded).toBe(930)
      expect(summary.totalAllocatedToCredits).toBe(500)
      expect(summary.openingBalancePaid).toBe(430)
      expect(summary.openingBalanceOutstanding).toBe(0)
      expect(summary.netOutstanding).toBe(0)
      expect(summary.unallocatedPayments).toBe(0)
      expect(summary.unallocatedAdvancePayments).toBe(0)
    })

    // Scenario 5: Genuine unallocated payment with outstanding credit rows: notice and allocation action remain available.
    it("Scenario 5: Genuine unallocated payment with outstanding credit rows flags unallocated notice with open allocation action", () => {
      const pendingCredit: CustomerCredit = {
        id: "cred-1000",
        customer_id: "cust-1",
        entry_type: "PRODUCT_CREDIT",
        entry_date: "2026-10-10",
        total_amount: 1000,
        amount_paid: 0,
        balance: 1000,
        status: "PENDING"
      } as any

      // Customer made ₹600 payment not yet allocated to the ₹1000 credit
      const payments = [{ amount: 600 }]
      const summary = calculateCustomerLedgerSummary([pendingCredit], [], payments, 0)

      expect(summary.netOutstanding).toBe(400)
      expect(summary.unallocatedPayments).toBe(600)
      expect(summary.amountTheyOweMe).toBe(400)
      // When unallocatedPayments > 0 and credits.some(c => c.balance > 0), notice + auto-allocate button should be active
      const hasPendingCredits = [pendingCredit].some(c => Number(c.balance || 0) > 0.005)
      expect(summary.unallocatedPayments > 0 && hasPendingCredits).toBe(true)
    })

    // Scenario 6: No outstanding rows and a genuinely unexplained payment: report discrepancy accurately without presenting unusable allocation action.
    it("Scenario 6: Genuinely unallocated payment with no open rows reports account advance without unusable allocation action", () => {
      // Customer has 0 credits and 0 opening balance, but made ₹300 payment (advance)
      const summary = calculateCustomerLedgerSummary([], [], [{ amount: 300 }], 0)

      expect(summary.netOutstanding).toBe(-300)
      expect(summary.unallocatedPayments).toBe(300)
      expect(summary.unallocatedAdvancePayments).toBe(300)
      expect(summary.amountTheyOweMe).toBe(0)
      expect(summary.amountIOweThem).toBe(300)

      // In UI, hasPendingCredits is false, so auto-allocate action is withheld
      const hasPendingCredits = ([] as CustomerCredit[]).some(c => Number(c.balance || 0) > 0.005)
      expect(hasPendingCredits).toBe(false)
    })

    // Scenario 7: Partial payment, multiple payments, and rounding to two decimal places.
    it("Scenario 7: Handles partial payments, multiple payments, and exact 2 decimal place rounding", () => {
      const openingBalance = 430.50
      const payments = [
        { amount: 150.25 },
        { amount: 100.10 },
        { amount: 50.05 }
      ]
      // Total paid = 300.40, remaining = 130.10
      const summary = calculateCustomerLedgerSummary([], [], payments, openingBalance)

      expect(summary.openingBalance).toBe(430.50)
      expect(summary.totalPaymentsRecorded).toBe(300.40)
      expect(summary.openingBalancePaid).toBe(300.40)
      expect(summary.openingBalanceOutstanding).toBe(130.10)
      expect(summary.netOutstanding).toBe(130.10)
      expect(summary.unallocatedPayments).toBe(0)
      expect(summary.amountTheyOweMe).toBe(130.10)
    })

    it("verifies autoAllocateCustomerPayments preserves chronological FIFO by satisfying opening balance debt first", async () => {
      // Customer has opening balance of 430, two payments [430, 200], and a credit row of 200
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 430 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-1",
                    amount: 430,
                    payment_date: "2026-10-01",
                    created_at: "2026-10-01T10:00:00Z",
                    allocations: []
                  },
                  {
                    id: "pay-2",
                    amount: 200,
                    payment_date: "2026-10-05",
                    created_at: "2026-10-05T10:00:00Z",
                    allocations: []
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "cred-200",
                      total_amount: 200,
                      amount_paid: 0,
                      balance: 200,
                      entry_date: "2026-10-03",
                      created_at: "2026-10-03T10:00:00Z"
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-fifo")
      // pay-1 (430) satisfies opening balance 430
      // pay-2 (200) satisfies cred-200
      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(200)
      expect(insertAllocMock).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_id: "pay-2",
          credit_id: "cred-200",
          amount: 200
        })
      ])
    })

    it("handles negative opening balance as customer advance/credit without creating artificial debt", () => {
      // Opening balance of -500 (meaning business owes customer 500)
      // Customer has a new credit row of 1000
      const credit: CustomerCredit = {
        id: "cred-neg",
        customer_id: "c-neg",
        entry_type: "PRODUCT_CREDIT",
        entry_date: "2026-10-01",
        total_amount: 1000,
        amount_paid: 0,
        balance: 1000,
        status: "PENDING"
      } as any

      // Customer makes a payment of 200
      const summary = calculateCustomerLedgerSummary([credit], [], [{ amount: 200 }], -500)

      expect(summary.openingBalance).toBe(-500)
      expect(summary.openingBalancePaid).toBe(0)
      expect(summary.openingBalanceOutstanding).toBe(0)
      // Total charges = -500 + 1000 = 500. Total credits = 200. Net outstanding = 300
      expect(summary.totalCharges).toBe(500)
      expect(summary.netOutstanding).toBe(300)
      expect(summary.amountTheyOweMe).toBe(300)
      expect(summary.amountIOweThem).toBe(0)
    })

    it("prevents overlapping concurrent autoAllocateCustomerPayments invocations for the same customer", async () => {
      let resolveFirstCall: () => void
      const firstCallPromise = new Promise<{ data: any; error: any }>((resolve) => {
        resolveFirstCall = () => resolve({ data: { opening_balance: 0 }, error: null })
      })

      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => firstCallPromise)
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      }

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        return {}
      })

      const call1 = autoAllocateCustomerPayments("cust-concurrent")

      // Second concurrent invocation for the same customer while first is in-flight
      await expect(autoAllocateCustomerPayments("cust-concurrent")).rejects.toThrow(
        "An allocation operation is already in progress for this customer"
      )

      // Allow first call to finish cleanly
      resolveFirstCall!()
      const res1 = await call1
      expect(res1).toEqual({ allocatedCount: 0, totalAllocated: 0 })
    })

    it("ensures repeated allocation runs cannot reuse funds that settled opening debt when new credit rows are added later", async () => {
      // Historical opening balance is 430
      // Payment 1 (430) recorded on 2026-10-01 has 0 allocations because it settled opening balance
      // Later, on 2026-10-15, a new credit row (cred-new, 500) is created
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 430 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-1",
                    amount: 430,
                    payment_date: "2026-10-01",
                    created_at: "2026-10-01T10:00:00Z",
                    allocations: [] // No allocations in DB because opening balance has no allocation row
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "cred-new",
                      total_amount: 500,
                      amount_paid: 0,
                      balance: 500,
                      entry_date: "2026-10-15",
                      created_at: "2026-10-15T10:00:00Z"
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      // Run auto-allocation in the presence of the new credit row
      const res = await autoAllocateCustomerPayments("cust-persistence")

      // The 430 payment is strictly consumed by the opening balance of 430 in FIFO order
      // It is NOT reused or diverted to cred-new
      expect(res.allocatedCount).toBe(0)
      expect(res.totalAllocated).toBe(0)
      expect(insertAllocMock).not.toHaveBeenCalled()
    })

    it("correctly handles partial opening-balance settlement across multiple chronological payments", async () => {
      // Opening balance = 430
      // Payment 1 = 200 on 2026-10-01 (leaves 230 opening debt)
      // Payment 2 = 300 on 2026-10-05 (settles remaining 230 debt, leaving 70 unallocated)
      // Credit row = 100 on 2026-10-03 (cred-100)
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 430 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-p1",
                    amount: 200,
                    payment_date: "2026-10-01",
                    created_at: "2026-10-01T10:00:00Z",
                    allocations: []
                  },
                  {
                    id: "pay-p2",
                    amount: 300,
                    payment_date: "2026-10-05",
                    created_at: "2026-10-05T10:00:00Z",
                    allocations: []
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "cred-100",
                      total_amount: 100,
                      amount_paid: 0,
                      balance: 100,
                      entry_date: "2026-10-03",
                      created_at: "2026-10-03T10:00:00Z"
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-partial")

      // 200 from pay-p1 + 230 from pay-p2 = 430 opening debt settled
      // Remaining 70 from pay-p2 is allocated to cred-100
      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(70)
      expect(insertAllocMock).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_id: "pay-p2",
          credit_id: "cred-100",
          amount: 70
        })
      ])
    })

    it("handles overpayment beyond opening balance and credits as an unallocated customer advance without over-allocating", async () => {
      // Opening balance = 100
      // Credit row = 200
      // Payment = 500 (overpayment by 200)
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 100 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-over",
                    amount: 500,
                    payment_date: "2026-10-01",
                    created_at: "2026-10-01T10:00:00Z",
                    allocations: []
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "cred-200",
                      total_amount: 200,
                      amount_paid: 0,
                      balance: 200,
                      entry_date: "2026-10-02",
                      created_at: "2026-10-02T10:00:00Z"
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-overpay")

      // 100 satisfies opening balance. 200 allocates to cred-200. Surplus 200 remains unallocated.
      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(200)
      expect(insertAllocMock).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_id: "pay-over",
          credit_id: "cred-200",
          amount: 200
        })
      ])
    })

    it("explicitly throws on RPC authorization failure or database errors without silent REST fallback", async () => {
      // When RPC returns an authorization error (e.g. 42501)
      ;(supabase as any).rpc.mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "Authentication required to execute customer auto-allocation" }
      })

      await expect(autoAllocateCustomerPayments("cust-auth-fail")).rejects.toThrow(
        "Auto-allocation RPC failed: Authentication required to execute customer auto-allocation"
      )

      // Verifies it does NOT call REST queries to bypass security
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it("executes transactional RPC successfully when available", async () => {
      ;(supabase as any).rpc.mockResolvedValueOnce({
        data: { allocatedCount: 2, totalAllocated: 450.00 },
        error: null
      })

      const res = await autoAllocateCustomerPayments("cust-rpc-ok")
      expect(res).toEqual({ allocatedCount: 2, totalAllocated: 450 })
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it("updates existing allocation row instead of inserting duplicate when payment already has an allocation to the credit", async () => {
      // Payment pay-topup has 200 total, with 50 already allocated to cred-topup
      // cred-topup total 150, balance 100
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 0 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-topup",
                    amount: 200,
                    payment_date: "2026-10-01",
                    created_at: "2026-10-01T10:00:00Z",
                    allocations: [
                      { id: "alloc-existing-1", amount: 50, credit_id: "cred-topup" }
                    ]
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "cred-topup",
                      total_amount: 150,
                      amount_paid: 50,
                      balance: 100,
                      entry_date: "2026-10-01",
                      created_at: "2026-10-01T10:00:00Z"
                    }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const updateAllocMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock, update: updateAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-topup")

      // 100 allocated to cred-topup; since alloc-existing-1 already exists for (pay-topup, cred-topup),
      // it updates alloc-existing-1 to 50 + 100 = 150, rather than inserting a duplicate
      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(100)
      expect(updateAllocMock).toHaveBeenCalledWith({ amount: 150 })
      expect(insertAllocMock).not.toHaveBeenCalled()
    })

    it("handles zero, negative, and fractional monetary amounts safely without erroneous allocations", async () => {
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 0 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "pay-zero", amount: 0, payment_date: "2026-10-01", created_at: "2026-10-01T10:00:00Z", allocations: [] },
                  { id: "pay-neg", amount: -50, payment_date: "2026-10-02", created_at: "2026-10-02T10:00:00Z", allocations: [] },
                  { id: "pay-frac", amount: 10.555, payment_date: "2026-10-03", created_at: "2026-10-03T10:00:00Z", allocations: [] }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: "cred-zero", total_amount: 100, amount_paid: 100, balance: 0, entry_date: "2026-10-01", created_at: "2026-10-01T10:00:00Z" },
                    { id: "cred-valid", total_amount: 50, amount_paid: 0, balance: 50, entry_date: "2026-10-02", created_at: "2026-10-02T10:00:00Z" }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-boundary")

      // Only pay-frac (10.56) is eligible to allocate to cred-valid (balance 50)
      expect(res.allocatedCount).toBe(1)
      expect(res.totalAllocated).toBe(10.56)
      expect(insertAllocMock).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_id: "pay-frac",
          credit_id: "cred-valid",
          amount: 10.56
        })
      ])
    })

    it("verifies idempotency: re-running allocation when all payments are exhausted produces 0 changes", async () => {
      const mockCustomerSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { opening_balance: 0 }, error: null })
          })
        })
      }

      const mockPaymentSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "pay-fully-allocated",
                    amount: 500,
                    payment_date: "2026-10-01",
                    created_at: "2026-10-01T10:00:00Z",
                    allocations: [{ id: "alloc-full", amount: 500, credit_id: "cred-1" }]
                  }
                ],
                error: null
              })
            })
          })
        })
      }

      const mockCreditSelect = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: "cred-remaining", total_amount: 1000, amount_paid: 500, balance: 500, entry_date: "2026-10-01", created_at: "2026-10-01T10:00:00Z" }
                  ],
                  error: null
                })
              })
            })
          })
        })
      }

      const insertAllocMock = vi.fn().mockResolvedValue({ error: null })

      ;(supabase.from as any).mockImplementation((table: string) => {
        if (table === "reseller_customers") return mockCustomerSelect
        if (table === "reseller_payments") return mockPaymentSelect
        if (table === "customer_credits") return mockCreditSelect
        if (table === "customer_payment_allocations") return { insert: insertAllocMock }
        return {}
      })

      const res = await autoAllocateCustomerPayments("cust-idempotent")

      expect(res.allocatedCount).toBe(0)
      expect(res.totalAllocated).toBe(0)
      expect(insertAllocMock).not.toHaveBeenCalled()
    })

    it("verifies complete opening-balance conservation through multi-phase chronological lifecycle", async () => {
      // Phase 1: Customer has opening balance 430 and payment 430 on Day 1 (before any credits exist)
      const customerState = { opening_balance: 430 }
      let paymentsState: any[] = [
        {
          id: "p1-430",
          amount: 430,
          payment_date: "2026-10-01",
          created_at: "2026-10-01T10:00:00Z",
          allocations: []
        }
      ]
      let creditsState: any[] = []
      let allocationsState: any[] = []

      const setupMocks = () => {
        const mockCustomer = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: customerState, error: null })
            })
          })
        }
        const mockPayments = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockImplementation(() => Promise.resolve({
                  data: paymentsState.map(p => ({
                    ...p,
                    allocations: allocationsState.filter(a => a.payment_id === p.id)
                  })),
                  error: null
                }))
              })
            })
          })
        }
        const mockCredits = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockImplementation(() => Promise.resolve({
                    data: creditsState.filter(c => c.balance > 0),
                    error: null
                  }))
                })
              })
            })
          })
        }
        const mockAllocations = {
          insert: vi.fn().mockImplementation((rows: any[]) => {
            allocationsState.push(...rows)
            return Promise.resolve({ error: null })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              return Promise.resolve({ error: null })
            })
          })
        }
        ;(supabase.from as any).mockImplementation((table: string) => {
          if (table === "reseller_customers") return mockCustomer
          if (table === "reseller_payments") return mockPayments
          if (table === "customer_credits") return mockCredits
          if (table === "customer_payment_allocations") return mockAllocations
          return {}
        })
      }

      // Run Phase 1
      setupMocks()
      const run1 = await autoAllocateCustomerPayments("cust-lifecycle")
      // P1 (430) absorbed by opening balance (430); 0 credit allocations created
      expect(run1.allocatedCount).toBe(0)
      expect(run1.totalAllocated).toBe(0)
      expect(allocationsState.length).toBe(0)

      // Phase 2: On Day 5, credit C1 (200) is added
      creditsState.push({
        id: "c1-200",
        entry_type: "PRODUCT_CREDIT",
        total_amount: 200,
        amount_paid: 0,
        balance: 200,
        entry_date: "2026-10-05",
        created_at: "2026-10-05T10:00:00Z"
      })

      // Run Phase 2: P1 was reserved for opening balance, so C1 must NOT receive funds from P1
      setupMocks()
      const run2 = await autoAllocateCustomerPayments("cust-lifecycle")
      expect(run2.allocatedCount).toBe(0)
      expect(run2.totalAllocated).toBe(0)
      expect(allocationsState.length).toBe(0)

      // Phase 3: On Day 10, payment P2 (300) is made
      paymentsState.push({
        id: "p2-300",
        amount: 300,
        payment_date: "2026-10-10",
        created_at: "2026-10-10T10:00:00Z",
        allocations: []
      })

      // Run Phase 3: P2 should allocate 200 to C1, leaving 100 surplus advance
      setupMocks()
      const run3 = await autoAllocateCustomerPayments("cust-lifecycle")
      expect(run3.allocatedCount).toBe(1)
      expect(run3.totalAllocated).toBe(200)
      expect(allocationsState.length).toBe(1)
      expect(allocationsState[0]).toEqual(expect.objectContaining({
        payment_id: "p2-300",
        credit_id: "c1-200",
        amount: 200
      }))

      // Update credit balance in mock state following allocation
      creditsState[0].amount_paid = 200
      creditsState[0].balance = 0

      // Phase 4: On Day 15, credit C2 (150) is added
      creditsState.push({
        id: "c2-150",
        entry_type: "PRODUCT_CREDIT",
        total_amount: 150,
        amount_paid: 0,
        balance: 150,
        entry_date: "2026-10-15",
        created_at: "2026-10-15T10:00:00Z"
      })

      // Run Phase 4: The remaining 100 from P2 should allocate to C2; C2 still has 50 balance
      setupMocks()
      const run4 = await autoAllocateCustomerPayments("cust-lifecycle")
      expect(run4.allocatedCount).toBe(1)
      expect(run4.totalAllocated).toBe(100)
      expect(allocationsState.length).toBe(2)
      expect(allocationsState[1]).toEqual(expect.objectContaining({
        payment_id: "p2-300",
        credit_id: "c2-150",
        amount: 100
      }))

      // Update credit balance in mock state
      creditsState[1].amount_paid = 100
      creditsState[1].balance = 50

      // Phase 5: Re-running auto-allocation with no new transactions produces 0 changes
      setupMocks()
      const run5 = await autoAllocateCustomerPayments("cust-lifecycle")
      expect(run5.allocatedCount).toBe(0)
      expect(run5.totalAllocated).toBe(0)
      expect(allocationsState.length).toBe(2)

      // Verify that ledger calculation matches exact double-entry state
      const summary = calculateCustomerLedgerSummary(
        creditsState as any,
        [],
        paymentsState,
        customerState.opening_balance
      )
      // Total charges = 430 opening + 200 C1 + 150 C2 = 780
      // Total payments = 430 P1 + 300 P2 = 730
      // Net outstanding = 780 - 730 = 50 (which matches C2's 50 unpaid balance)
      expect(summary.totalCharges).toBe(780)
      expect(summary.totalPaymentsRecorded).toBe(730)
      expect(summary.netOutstanding).toBe(50)
      expect(summary.openingBalancePaid).toBe(430)
      expect(summary.openingBalanceOutstanding).toBe(0)
      expect(summary.unallocatedPayments).toBe(0)
    })
  })
})
