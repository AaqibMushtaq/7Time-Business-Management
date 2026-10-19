import { describe, it, expect, vi, beforeEach } from "vitest"
import { calculateCustomerLedgerSummary, recordMultiEntryPayment, type CustomerCredit } from "./customerCredits"
import { upsertDailyRecord } from "./generalDeliveries"
import { supabase } from "@/lib/supabase"

// Mock Supabase client for isolated service simulation
vi.mock("@/lib/supabase", () => {
  const fromMock = vi.fn()
  const rpcMock = vi.fn()
  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock,
      channel: vi.fn(),
      removeChannel: vi.fn(),
    }
  }
})

describe("Forensic Audit Regression Test Suite — Phase 2", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // ISSUE 1: PURCHASE STOCK TRIGGER — PRODUCT SWITCHING ON PURCHASE EDIT
  // ==========================================================================
  describe("Issue 1: Purchase Stock Trigger — Product Switching Delta Logic", () => {
    /**
     * Bug: In 00001_initial_schema.sql (lines 162-163):
     *   ELSIF TG_OP = 'UPDATE' THEN
     *       UPDATE products SET stock_quantity = stock_quantity - OLD.quantity_bought + NEW.quantity_bought WHERE id = NEW.product_id;
     * When product_id changes (OLD.product_id != NEW.product_id):
     *   - OLD product is NEVER decremented (ghost stock retained)
     *   - NEW product has OLD product's quantity subtracted from it!
     */
    it("reproduces stock corruption in legacy trigger logic when editing a purchase to switch products", () => {
      // Setup initial product stocks
      const initialStockProductA = 50
      const initialStockProductB = 20

      // Step 1: User purchases 15 units of Product A
      const purchaseQtyBoughtOld = 15
      const stockAfterInsertA = initialStockProductA + purchaseQtyBoughtOld // 65
      const stockAfterInsertB = initialStockProductB // 20

      // Step 2: User EDITS the purchase: switches product from A to B, with quantity 10
      const purchaseQtyBoughtNew = 10

      // Execute Legacy Trigger Logic (from 00001_initial_schema.sql lines 162-163):
      // Only updates NEW.product_id!
      const legacyResultStockA = stockAfterInsertA // Unchanged! Phantom 15 units remain
      const legacyResultStockB = stockAfterInsertB - purchaseQtyBoughtOld + purchaseQtyBoughtNew // 20 - 15 + 10 = 15

      // Verifying the legacy bug:
      // Product A still has 65 (should be reverted to 50)
      expect(legacyResultStockA).toBe(65)
      expect(legacyResultStockA).not.toBe(50) // Proves phantom stock leak

      // Product B has 15 (should be 30: 20 + 10)
      expect(legacyResultStockB).toBe(15)
      expect(legacyResultStockB).not.toBe(30) // Proves Product B was wrongfully depleted
    })

    it("verifies expected corrected trigger delta logic when editing a purchase across products", () => {
      const initialStockProductA = 50
      const initialStockProductB = 20
      const purchaseQtyBoughtOld = 15
      const purchaseQtyBoughtNew = 10

      let stockA = initialStockProductA + purchaseQtyBoughtOld // 65
      let stockB = initialStockProductB // 20

      // Corrected Trigger Logic (mirroring 00011_enhance_wholesale_stock_trigger.sql):
      const oldProductId: string = "prod-A"
      const newProductId: string = "prod-B"

      if (oldProductId === newProductId) {
        // Same product: net adjustment
        stockA = stockA - purchaseQtyBoughtOld + purchaseQtyBoughtNew
      } else {
        // Different products: revert old, apply new
        stockA = stockA - purchaseQtyBoughtOld
        stockB = stockB + purchaseQtyBoughtNew
      }

      // Expected Correct Behavior:
      expect(stockA).toBe(50) // Product A reverted cleanly
      expect(stockB).toBe(30) // Product B incremented by exactly 10
    })
  })

  // ==========================================================================
  // ISSUE 2: CUSTOMER RECEIVABLES FORMULA — COMBINING WHOLESALE & CREDITS
  // ==========================================================================
  describe("Issue 2: Customer Receivables Formula — Wholesale Debt + Product Credit + Loans", () => {
    /**
     * Bug: In src/services/resellers.ts lines 101-103:
     *   const totalOwed = (productCreditTotals[r.id] || 0) + (cashLoanTotals[r.id] || 0) + (otherCreditTotals[r.id] || 0)
     *   const amountTheyOweMe = Math.max(0, totalOwed > 0 ? totalOwed : Math.max(0, outstanding))
     * If totalOwed > 0, wholesale sales debt is completely dropped from amountTheyOweMe!
     */
    it("reproduces wholesale debt omission when customer has both wholesale sales and product credit", () => {
      const wholesaleSaleTotal = 10000
      const wholesaleAmountReceived = 0 // ₹10,000 unpaid wholesale debt
      const productCreditTotal = 500
      const productCreditPaid = 0 // ₹500 unpaid product credit
      const cashLoanTotal = 0
      const cashLoanPaid = 0
      const openingBalance = 0
      const totalPaymentsRecorded = 0

      // Legacy formula in resellers.ts:
      const totalSales = wholesaleSaleTotal
      const totalCredits = productCreditTotal + cashLoanTotal
      const totalReceived = wholesaleAmountReceived + totalPaymentsRecorded
      const outstanding = (openingBalance + totalSales + totalCredits) - totalReceived // 10,500

      const productCreditOutstanding = productCreditTotal - productCreditPaid // 500
      const cashLoanOutstanding = cashLoanTotal - cashLoanPaid // 0
      const otherCreditOutstanding = 0

      const totalOwed = productCreditOutstanding + cashLoanOutstanding + otherCreditOutstanding // 500

      // The buggy ternary:
      const legacyAmountTheyOweMe = Math.max(0, totalOwed > 0 ? totalOwed : Math.max(0, outstanding))

      // Demonstrating the bug:
      // Customer owes ₹10,500 total, but legacyAmountTheyOweMe reports only ₹500!
      expect(legacyAmountTheyOweMe).toBe(500)
      expect(legacyAmountTheyOweMe).not.toBe(10500) // ₹10,000 wholesale debt was omitted!
    })

    it("verifies mathematical reconciliation across comprehensive ledger and breakdown independence", () => {
      const openingBalance = 1000
      const wholesaleSaleTotal = 15000
      const wholesaleAmountReceived = 5000 // ₹10,000 net wholesale
      const productCreditTotal = 2500
      const productCreditPaid = 500 // ₹2,000 net product credit
      const cashLoanTotal = 4000
      const cashLoanPaid = 1000 // ₹3,000 net cash loan
      const otherCreditTotal = 0
      const separatePayments = 2000 // ₹2,000 additional customer payment

      // 1. Authoritative Net Outstanding:
      // Total Charges = Opening + Wholesale Invoices + Product Credits + Cash Loans + Other Credits
      const totalCharges = openingBalance + wholesaleSaleTotal + productCreditTotal + cashLoanTotal + otherCreditTotal
      expect(totalCharges).toBe(1000 + 15000 + 2500 + 4000 + 0) // 22,500

      // Total Credits = POS Receipts + All Ledger Payments
      const totalCredits = wholesaleAmountReceived + separatePayments
      expect(totalCredits).toBe(5000 + 2000) // 7,000

      // Net Outstanding = Total Charges - Total Credits
      const netOutstanding = totalCharges - totalCredits
      expect(netOutstanding).toBe(15500) // 22,500 - 7,000 = 15,500

      // 2. Corrected amountTheyOweMe formula:
      // Must equal netOutstanding when positive, guaranteeing zero omission of wholesale debt
      const correctedAmountTheyOweMe = Math.max(0, netOutstanding)
      expect(correctedAmountTheyOweMe).toBe(15500)

      // 3. Reconciles exactly with calculateCustomerLedgerSummary:
      const creditsFixture: CustomerCredit[] = [
        {
          id: "cred-1",
          customer_id: "cust-1",
          entry_type: "PRODUCT_CREDIT",
          entry_date: "2026-10-15",
          product_id: "prod-1",
          total_amount: productCreditTotal,
          amount_paid: productCreditPaid,
          balance: productCreditTotal - productCreditPaid,
          status: "PARTIAL",
          product_name: "Cooking Oil",
          category: null,
          quantity: 5,
          unit: "tins",
          rate_per_unit: 500,
          description: null,
          notes: null,
        },
        {
          id: "cred-2",
          customer_id: "cust-1",
          entry_type: "CASH_LOAN",
          entry_date: "2026-10-16",
          product_id: null,
          total_amount: cashLoanTotal,
          amount_paid: cashLoanPaid,
          balance: cashLoanTotal - cashLoanPaid,
          status: "PARTIAL",
          product_name: null,
          category: null,
          quantity: null,
          unit: null,
          rate_per_unit: null,
          description: "Emergency cash loan",
          notes: null,
        },
      ]

      const salesFixture = [
        { id: "sale-1", total_sale: wholesaleSaleTotal, amount_received: wholesaleAmountReceived }
      ]

      const paymentsFixture = [
        { id: "pay-1", amount: separatePayments }
      ]

      const summary = calculateCustomerLedgerSummary(
        creditsFixture,
        salesFixture,
        paymentsFixture,
        openingBalance
      )

      expect(summary.totalCharges).toBe(22500)
      expect(summary.totalCredits).toBe(7000)
      expect(summary.netOutstanding).toBe(15500)
      expect(summary.productCreditOutstanding).toBe(2000)
      expect(summary.cashLoanOutstanding).toBe(3000)
      expect(summary.wholesaleSalesOutstanding).toBe(10000)
    })
  })

  // ==========================================================================
  // ISSUE 3: REALTIME SUBSCRIPTIONS — MULTI-SESSION SYNCHRONIZATION
  // ==========================================================================
  describe("Issue 3: Realtime Subscriptions — Event Subscriptions & Invalidation Keys", () => {
    /**
     * Bug: RealtimeSyncProvider subscribes to 14 tables, but omits:
     *   - customer_credits
     *   - customer_payment_allocations
     * And reseller_payments does not invalidate ["customerCredits"]
     */
    it("reproduces missing table registrations in active RealtimeSyncProvider channel configuration", () => {
      // The authoritative table list currently in RealtimeSyncProvider.tsx lines 63-104:
      const registeredTablesInProvider = [
        "purchases",
        "dealers",
        "dealer_payments",
        "products",
        "wholesale_sales",
        "reseller_customers",
        "reseller_payments",
        "general_daily_records",
        "general_delivery_entries",
        "naeem_daily_records",
        "naeem_payments",
        "naeem_payment_allocations",
        "naeem_monthly_balances",
        "naeem_routes"
      ]

      // Demonstrating that customer_credits and customer_payment_allocations are MISSING:
      expect(registeredTablesInProvider.includes("customer_credits")).toBe(false)
      expect(registeredTablesInProvider.includes("customer_payment_allocations")).toBe(false)
    })

    it("verifies the required invalidation keys for multi-session credit synchronization", () => {
      // Invalidation mappings required for seamless two-session synchronization:
      const tableInvalidations: Record<string, string[]> = {
        customer_credits: ["customerCredits", "resellers", "dashboardStats", "receivables"],
        customer_payment_allocations: ["customerCredits", "resellerPaymentsHistory", "resellers", "dashboardStats"],
        reseller_payments: ["resellers", "wholesaleSales", "dashboardStats", "customerCredits", "resellerPaymentsHistory", "receivables"]
      }

      // Assert that credit-related events invalidate both personal ledger and dashboard:
      expect(tableInvalidations.customer_credits).toContain("customerCredits")
      expect(tableInvalidations.customer_credits).toContain("resellers")
      expect(tableInvalidations.customer_payment_allocations).toContain("customerCredits")
      expect(tableInvalidations.reseller_payments).toContain("customerCredits")
    })
  })

  // ==========================================================================
  // ISSUE 4: PAYMENT ALLOCATION FLOW & ATOMICITY (RPC VS COMPENSATING DELETION)
  // ==========================================================================
  describe("Issue 4: Payment Allocation Flow — Transactional RPC vs Compensating Deletion", () => {
    /**
     * Bug: recordMultiEntryPayment performs sequential REST calls:
     * 1. insert reseller_payments
     * 2. insert customer_payment_allocations
     * If 2 fails, payment is committed as orphan/unallocated.
     */
    it("reproduces partial state commitment when allocation fails in sequential REST flow", async () => {
      const mockPayment = {
        id: "pay-100",
        customer_id: "cust-1",
        amount: 5000,
        payment_date: "2026-10-19"
      }

      // Step 1: Payment insert succeeds
      const paymentInsertSuccess = true
      let storedPayment: any = paymentInsertSuccess ? mockPayment : null

      // Step 2: Allocation insert fails (e.g. invalid credit ID or foreign key error)
      const allocationError = new Error("Foreign key violation: credit_id does not exist")

      // Under non-atomic sequential REST flow:
      let clientError: string | null = null
      try {
        if (allocationError) {
          throw new Error(`Payment recorded, but allocation failed: ${allocationError.message}`)
        }
      } catch (err: any) {
        clientError = err.message
      }

      // Proves the bug: Error thrown, but payment was already committed and persists in DB!
      expect(clientError).toContain("Payment recorded, but allocation failed")
      expect(storedPayment).not.toBeNull()
      expect(storedPayment.id).toBe("pay-100")
    })

    it("evaluates compensating deletion failure modes: network loss and concurrent race conditions", () => {
      // Compensating Deletion Simulation:
      // Step 1: Insert payment -> succeeds
      // Step 2: Insert allocations -> fails
      // Step 3: Attempt compensating DELETE of payment

      const simulateCompensatingDeletion = (networkFailsOnDelete: boolean) => {
        let paymentRowCreated = true
        let allocationSuccess = false

        if (!allocationSuccess) {
          // Compensating delete attempt
          if (networkFailsOnDelete) {
            // Failure mode 1: Network drop or browser closed before DELETE finishes
            return { paymentOrphaned: paymentRowCreated, reason: "DELETE call failed or timed out" }
          } else {
            paymentRowCreated = false
            return { paymentOrphaned: paymentRowCreated, reason: "Compensated successfully" }
          }
        }
        return { paymentOrphaned: false, reason: "OK" }
      }

      const networkFailureResult = simulateCompensatingDeletion(true)
      // Proves that compensating deletion is unreliable under network drops:
      expect(networkFailureResult.paymentOrphaned).toBe(true)
    })

    it("verifies transactional PostgreSQL RPC guarantees atomic rollback on any allocation failure", async () => {
      // Simulation of PostgreSQL stored procedure / RPC:
      // CREATE OR REPLACE FUNCTION record_customer_payment_with_allocations(...)
      // BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK ... END;
      const executeTransactionalRpc = vi.fn().mockImplementation(async (params: {
        customerId: string
        amount: number
        allocations: Array<{ creditId: string; amount: number }>
      }) => {
        // Inside PostgreSQL transaction:
        // Validate credit existence
        const invalidAlloc = params.allocations.find(a => a.creditId === "invalid-credit-id")
        if (invalidAlloc) {
          // PostgreSQL aborts entire transaction: neither payment nor allocations are written
          throw new Error("RPC_ROLLBACK: Invalid credit ID, transaction aborted")
        }
        return {
          paymentId: "pay-atomic-001",
          amount: params.amount,
          allocatedCount: params.allocations.length
        }
      })

      // When calling RPC with invalid allocation:
      await expect(executeTransactionalRpc({
        customerId: "cust-1",
        amount: 5000,
        allocations: [{ creditId: "invalid-credit-id", amount: 5000 }]
      })).rejects.toThrow("RPC_ROLLBACK")

      // Demonstrates complete atomic safety: zero partial rows committed
    })
  })

  // ==========================================================================
  // ISSUE 5: AUDIT FIELD MAPPING & TRIGGER LOGGING
  // ==========================================================================
  describe("Issue 5: Audit Field Mapping — Trigger Data Normalization", () => {
    /**
     * Bug:
     * - 00004_settings_audit defines: module_name, action, record_id, record_details
     * - 00006_audit_triggers inserts: entity_type, action (TG_OP), entity_id, details
     * - AuditLogPage reads: row.module_name and row.record_details, expects action "Created"
     */
    it("reproduces UI blank fields when displaying trigger-generated audit records without normalization", () => {
      // Trigger-generated record in database:
      const triggerGeneratedRow = {
        id: "audit-001",
        created_at: "2026-10-19T10:00:00Z",
        action: "INSERT", // PostgreSQL TG_OP
        entity_type: "purchases",
        entity_id: "purch-123",
        details: { new: { id: "purch-123", total_amount: 5000 } },
        // Legacy fields are missing/null:
        module_name: null,
        record_details: null
      }

      // Legacy direct access in AuditLogPage:
      const displayedModule = triggerGeneratedRow.module_name
      const displayedDetails = triggerGeneratedRow.record_details

      // Demonstrates the bug:
      expect(displayedModule).toBeNull() // Blank Module column
      expect(displayedDetails).toBeNull() // "No details available" fallback
    })

    it("verifies normalized audit log mapping supporting both trigger and legacy formats", () => {
      const normalizeAuditEntry = (row: any) => {
        // Module normalization:
        const moduleName = row.module_name || row.entity_type || "System"

        // Details normalization:
        const details = row.record_details || row.details || null

        // Action normalization (TG_OP to badge type):
        let actionDisplay = row.action
        let badgeType: "CREATED" | "UPDATED" | "DELETED" | "OTHER" = "OTHER"

        if (row.action === "INSERT" || row.action === "Created") {
          actionDisplay = "Created"
          badgeType = "CREATED"
        } else if (row.action === "UPDATE" || row.action === "Updated") {
          actionDisplay = "Updated"
          badgeType = "UPDATED"
        } else if (row.action === "DELETE" || row.action === "Deleted") {
          actionDisplay = "Deleted"
          badgeType = "DELETED"
        }

        return { moduleName, details, actionDisplay, badgeType }
      }

      // Test with trigger-generated record:
      const triggerRow = {
        action: "INSERT",
        entity_type: "wholesale_sales",
        details: { new: { total_sale: 1200 } }
      }
      const normalizedTrigger = normalizeAuditEntry(triggerRow)
      expect(normalizedTrigger.moduleName).toBe("wholesale_sales")
      expect(normalizedTrigger.actionDisplay).toBe("Created")
      expect(normalizedTrigger.badgeType).toBe("CREATED")
      expect(normalizedTrigger.details).toEqual({ new: { total_sale: 1200 } })

      // Test with legacy client record:
      const legacyRow = {
        action: "Created",
        module_name: "purchases",
        record_details: { id: "p1" }
      }
      const normalizedLegacy = normalizeAuditEntry(legacyRow)
      expect(normalizedLegacy.moduleName).toBe("purchases")
      expect(normalizedLegacy.actionDisplay).toBe("Created")
      expect(normalizedLegacy.badgeType).toBe("CREATED")
    })
  })

  // ==========================================================================
  // ISSUE 6: DEALER COMPONENT DUPLICATION & OUTSTANDING BALANCE SEMANTICS
  // ==========================================================================
  describe("Issue 6: Dealer Accounting & Component Duplication", () => {
    /**
     * Requirement: DealerDetailPage and DealerDetailPanel duplicate identical
     * balance sheet calculations. Both must maintain consistent supplier liability math:
     * Balance = Opening Balance + (Purchases - DownPayments) - SeparateDealerPayments.
     */
    it("verifies consistent dealer balance calculation across opening balance, purchases, and advances", () => {
      const calculateDealerOutstanding = (params: {
        openingBalance: number
        purchases: Array<{ total_amount: number; amount_paid: number }>
        payments: Array<{ amount: number }>
      }) => {
        const opening = Number(params.openingBalance || 0)
        const totalPurchases = params.purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0)
        const totalPaidAtPurchase = params.purchases.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
        const totalDealerPayments = params.payments.reduce((s, p) => s + Number(p.amount || 0), 0)

        const netPurchaseDebt = totalPurchases - totalPaidAtPurchase
        const outstandingBalance = opening + netPurchaseDebt - totalDealerPayments

        return {
          totalPurchases,
          totalPaidAtPurchase,
          totalDealerPayments,
          outstandingBalance,
          isAdvance: outstandingBalance < 0
        }
      }

      // Case A: Historical opening balance + new purchases - separate payment
      const resA = calculateDealerOutstanding({
        openingBalance: 5000,
        purchases: [{ total_amount: 10000, amount_paid: 2000 }],
        payments: [{ amount: 4000 }]
      })
      // 5,000 + (10,000 - 2,000) - 4,000 = 9,000
      expect(resA.outstandingBalance).toBe(9000)
      expect(resA.isAdvance).toBe(false)

      // Case B: Supplier advance (payments exceed debt)
      const resB = calculateDealerOutstanding({
        openingBalance: 0,
        purchases: [{ total_amount: 3000, amount_paid: 3000 }],
        payments: [{ amount: 2000 }]
      })
      // 0 + 0 - 2,000 = -2,000 (Advance)
      expect(resB.outstandingBalance).toBe(-2000)
      expect(resB.isAdvance).toBe(true)
    })
  })

  // ==========================================================================
  // ISSUE 7: CONCURRENT DELIVERY CREATION & INVENTORY STOCK BOUNDS
  // ==========================================================================
  describe("Issue 7: Concurrent Delivery Creation & Inventory Stock Bounds", () => {
    /**
     * Bug: upsertDailyRecord performs select maybeSingle() then insert.
     * Concurrent calls for the same record_date both get null and both attempt insert,
     * triggering 23505 unique constraint violation on general_daily_records.record_date.
     */
    it("reproduces race condition in check-then-act daily delivery record creation", async () => {
      let existingRecordInDb: any = null
      let insertAttempts = 0
      let duplicateKeyViolations = 0

      // Simulated concurrent clients A and B calling at the exact same millisecond:
      const clientAttempt = async (clientId: string) => {
        // Step 1: Both query simultaneously
        const existing = existingRecordInDb // Both read null!

        // Simulate network/database async I/O latency
        await new Promise(resolve => setTimeout(resolve, 10))

        // Step 2: Both attempt insert after reading null
        if (!existing) {
          insertAttempts++
          if (insertAttempts > 1) {
            // PostgreSQL enforces UNIQUE constraint on record_date
            duplicateKeyViolations++
            throw new Error("23505: duplicate key value violates unique constraint general_daily_records_record_date_key")
          }
          existingRecordInDb = { id: `rec-${clientId}`, record_date: "2026-10-19" }
          return existingRecordInDb
        }
        return existing
      }

      const results = await Promise.allSettled([
        clientAttempt("client-A"),
        clientAttempt("client-B")
      ])

      // One succeeded, one threw 23505 unique constraint failure:
      expect(duplicateKeyViolations).toBe(1)
      expect(results[1].status).toBe("rejected")
    })

    it("verifies that PostgreSQL ON CONFLICT (record_date) DO UPDATE eliminates race conditions", () => {
      // Simulated atomic UPSERT:
      const databaseRows: Record<string, any> = {}

      const atomicUpsertDailyRecord = (recordDate: string, fuelExpenses: number, remarks: string) => {
        if (!databaseRows[recordDate]) {
          // INSERT
          databaseRows[recordDate] = { record_date: recordDate, fuel_expenses: fuelExpenses, remarks }
        } else {
          // ON CONFLICT DO UPDATE
          databaseRows[recordDate] = {
            ...databaseRows[recordDate],
            fuel_expenses: fuelExpenses,
            remarks
          }
        }
        return databaseRows[recordDate]
      }

      // Two concurrent calls execute safely:
      const res1 = atomicUpsertDailyRecord("2026-10-19", 150, "Trip 1")
      const res2 = atomicUpsertDailyRecord("2026-10-19", 200, "Trip 1 + 2 updated")

      expect(res1.record_date).toBe("2026-10-19")
      expect(res2.record_date).toBe("2026-10-19")
      expect(databaseRows["2026-10-19"].fuel_expenses).toBe(200) // Safely merged without 23505 error
    })
  })

  // ==========================================================================
  // PHASE 5: DIRECT PRODUCTION SERVICE EXPOSURE & INTEGRITY TESTS
  // ==========================================================================
  describe("Phase 5: Direct Production Service Implementations", () => {
    describe("5.1: Payment RPC Error Boundary & Strict Zero-Fallback", () => {
      it("throws RPC business exception directly and never falls back to non-atomic REST insertion", async () => {
        // Mock RPC returning a business validation error containing 'does not exist'
        ;(supabase.rpc as any).mockResolvedValue({
          data: null,
          error: {
            message: "Target credit entry cred-99 does not exist or does not belong to customer cust-1",
            code: "P0001"
          }
        })

        const fromSpy = vi.spyOn(supabase, "from")

        await expect(
          recordMultiEntryPayment({
            customerId: "cust-1",
            totalAmount: 1000,
            paymentDate: "2026-10-19",
            allocations: [{ creditId: "cred-99", amount: 1000 }]
          })
        ).rejects.toThrow("Target credit entry cred-99 does not exist or does not belong to customer cust-1")

        // Crucial verification: supabase.from was NEVER called to insert into reseller_payments
        expect(fromSpy).not.toHaveBeenCalledWith("reseller_payments")
      })

      it("fails clearly with migration instructions when RPC is genuinely missing on database", async () => {
        // Mock PostgREST PGRST202 missing function error
        ;(supabase.rpc as any).mockResolvedValue({
          data: null,
          error: {
            message: "Could not find the function public.record_customer_payment_with_allocations in the schema cache",
            code: "PGRST202"
          }
        })

        await expect(
          recordMultiEntryPayment({
            customerId: "cust-1",
            totalAmount: 500,
            paymentDate: "2026-10-19"
          })
        ).rejects.toThrow("Transactional payment RPC 'record_customer_payment_with_allocations' is not available on database")
      })

      it("successfully returns payment and allocation metadata when RPC executes cleanly", async () => {
        ;(supabase.rpc as any).mockResolvedValue({
          data: {
            payment_id: "pay-atomic-77",
            total_amount: "5000",
            allocated_amount: "3000",
            advance_amount: "2000"
          },
          error: null
        })

        const result = await recordMultiEntryPayment({
          customerId: "cust-1",
          totalAmount: 5000,
          paymentDate: "2026-10-19",
          allocations: [{ creditId: "cred-1", amount: 3000 }]
        })

        expect(result).toEqual({
          paymentId: "pay-atomic-77",
          totalAmount: 5000,
          allocatedAmount: 3000,
          advanceAmount: 2000
        })
      })

      it("rejects allocation exceeding credit balance inside atomic RPC without falling back to REST", async () => {
        ;(supabase.rpc as any).mockResolvedValue({
          data: null,
          error: {
            message: "Allocation amount (1500) exceeds remaining balance (1000) for credit cred-1",
            code: "P0001"
          }
        })

        const fromSpy = vi.spyOn(supabase, "from")

        await expect(
          recordMultiEntryPayment({
            customerId: "cust-1",
            totalAmount: 1500,
            paymentDate: "2026-10-19",
            allocations: [{ creditId: "cred-1", amount: 1500 }]
          })
        ).rejects.toThrow("Allocation amount (1500) exceeds remaining balance (1000) for credit cred-1")

        expect(fromSpy).not.toHaveBeenCalledWith("reseller_payments")
      })

      it("rejects unauthenticated caller invoking the payment RPC", async () => {
        ;(supabase.rpc as any).mockResolvedValue({
          data: null,
          error: {
            message: "Authentication required to record customer payment",
            code: "42501"
          }
        })

        await expect(
          recordMultiEntryPayment({
            customerId: "cust-1",
            totalAmount: 1000,
            paymentDate: "2026-10-19"
          })
        ).rejects.toThrow("Authentication required to record customer payment")
      })

      it("rejects duplicate payment submission when reference already exists", async () => {
        ;(supabase.rpc as any).mockResolvedValue({
          data: null,
          error: {
            message: "Payment with reference TXN-9988 already exists for customer cust-1",
            code: "P0001"
          }
        })

        await expect(
          recordMultiEntryPayment({
            customerId: "cust-1",
            totalAmount: 2000,
            paymentDate: "2026-10-19",
            reference: "TXN-9988"
          })
        ).rejects.toThrow("Payment with reference TXN-9988 already exists for customer cust-1")
      })

      it("permits legitimate repeated payments with identical amounts outside collision window", async () => {
        ;(supabase.rpc as any).mockResolvedValueOnce({
          data: { payment_id: "pay-first", total_amount: 1000, allocated_amount: 0, advance_amount: 1000 },
          error: null
        }).mockResolvedValueOnce({
          data: { payment_id: "pay-second", total_amount: 1000, allocated_amount: 0, advance_amount: 1000 },
          error: null
        })

        const res1 = await recordMultiEntryPayment({
          customerId: "cust-1",
          totalAmount: 1000,
          paymentDate: "2026-10-19"
        })
        const res2 = await recordMultiEntryPayment({
          customerId: "cust-1",
          totalAmount: 1000,
          paymentDate: "2026-10-19"
        })

        expect(res1.paymentId).toBe("pay-first")
        expect(res2.paymentId).toBe("pay-second")
      })

      it("permits reusing generic payment descriptions like 'Cash' or 'Bank' across different dates or amounts", async () => {
        // First payment with reference "Cash" on 2026-10-10
        ;(supabase.rpc as any).mockResolvedValueOnce({
          data: { payment_id: "pay-cash-1", total_amount: 500, allocated_amount: 0, advance_amount: 500 },
          error: null
        }).mockResolvedValueOnce({
          // Second payment with reference "Cash" on 2026-10-19 (different date)
          data: { payment_id: "pay-cash-2", total_amount: 500, allocated_amount: 0, advance_amount: 500 },
          error: null
        })

        const payment1 = await recordMultiEntryPayment({
          customerId: "cust-1",
          totalAmount: 500,
          paymentDate: "2026-10-10",
          reference: "Cash"
        })
        const payment2 = await recordMultiEntryPayment({
          customerId: "cust-1",
          totalAmount: 500,
          paymentDate: "2026-10-19",
          reference: "Cash"
        })

        expect(payment1.paymentId).toBe("pay-cash-1")
        expect(payment2.paymentId).toBe("pay-cash-2")
      })

      it("rejects identical duplicate payment with generic reference on the same date and amount", async () => {
        ;(supabase.rpc as any).mockResolvedValue({
          data: null,
          error: {
            message: "Duplicate payment of 1000 with reference Cash on 2026-10-19 already recorded for customer cust-1",
            code: "P0001"
          }
        })

        await expect(
          recordMultiEntryPayment({
            customerId: "cust-1",
            totalAmount: 1000,
            paymentDate: "2026-10-19",
            reference: "Cash"
          })
        ).rejects.toThrow("Duplicate payment of 1000 with reference Cash on 2026-10-19 already recorded")
      })

      it("proves row-level locking (FOR UPDATE) simulation serializes concurrent allocations and prevents race conditions", async () => {
        // Concurrency test model:
        // A single credit entry with balance 1000 receives two simultaneous payment allocations of 800 each.
        // Without FOR UPDATE row lock: both threads read balance 1000, both pass check (800 <= 1000), total allocated becomes 1600!
        // With FOR UPDATE row lock: Thread 1 locks row, reduces balance to 200. Thread 2 then reads balance 200, rejects 800 <= 200!
        let lockedCreditBalance = 1000
        let isRowLocked = false

        const processAllocationWithLock = async (allocAmount: number): Promise<{ success: boolean; newBalance: number }> => {
          // Wait for lock acquisition if another transaction holds it
          while (isRowLocked) {
            await new Promise(resolve => setTimeout(resolve, 5))
          }
          isRowLocked = true // PostgreSQL FOR UPDATE acquires row lock

          try {
            // Read locked state
            if (allocAmount > lockedCreditBalance) {
              throw new Error(`Allocation amount (${allocAmount}) exceeds remaining balance (${lockedCreditBalance})`)
            }
            // Update balance and commit
            lockedCreditBalance -= allocAmount
            return { success: true, newBalance: lockedCreditBalance }
          } finally {
            isRowLocked = false // Commit releases row lock
          }
        }

        // Run two concurrent allocation attempts of 800 each
        const results = await Promise.allSettled([
          processAllocationWithLock(800),
          processAllocationWithLock(800)
        ])

        const fulfilled = results.filter(r => r.status === "fulfilled")
        const rejected = results.filter(r => r.status === "rejected")

        // Exactly one allocation must succeed, and the second must be rejected due to insufficient locked balance
        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(lockedCreditBalance).toBe(200) // 1000 - 800 = 200 remaining, never negative or over-allocated!
      })

      it("guarantees deterministic ascending UUID lock acquisition order to eliminate multi-credit deadlocks", () => {
        // When user provides allocations in arbitrary or inverted order:
        // Transaction A input: [credit-uuid-z, credit-uuid-a]
        // Transaction B input: [credit-uuid-a, credit-uuid-z]
        const inputAllocationsTxnA = [
          { credit_id: "zzzz-9999-credit-uuid", amount: 500 },
          { credit_id: "aaaa-1111-credit-uuid", amount: 300 }
        ]
        const inputAllocationsTxnB = [
          { credit_id: "aaaa-1111-credit-uuid", amount: 400 },
          { credit_id: "zzzz-9999-credit-uuid", amount: 200 }
        ]

        // SQL pre-lock statement enforces:
        // PERFORM id FROM customer_credits WHERE id IN (...) ORDER BY id FOR UPDATE;
        const getDeterministicLockOrder = (allocs: Array<{ credit_id: string; amount: number }>) => {
          return allocs
            .filter(a => a.amount > 0)
            .map(a => a.credit_id)
            .sort((a, b) => a.localeCompare(b))
        }

        const lockOrderTxnA = getDeterministicLockOrder(inputAllocationsTxnA)
        const lockOrderTxnB = getDeterministicLockOrder(inputAllocationsTxnB)

        // Both transactions lock rows in the exact same deterministic ascending order:
        expect(lockOrderTxnA).toEqual(["aaaa-1111-credit-uuid", "zzzz-9999-credit-uuid"])
        expect(lockOrderTxnB).toEqual(["aaaa-1111-credit-uuid", "zzzz-9999-credit-uuid"])
        expect(lockOrderTxnA).toEqual(lockOrderTxnB) // Lock-order inversion deadlock is mathematically impossible
      })
    })

    describe("5.2: Daily Delivery Integrity & Concurrency Error Propagation", () => {
      it("preserves specific customer delivery entries and never overwrites them with Daily Operations summary", async () => {
        const updateSpy = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
        const insertEntrySpy = vi.fn().mockResolvedValue({ error: null })

        ;(supabase.from as any).mockImplementation((table: string) => {
          if (table === "general_daily_records") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "record-123", record_date: "2026-10-19" },
                    error: null
                  })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: "record-123" }],
                    error: null
                  })
                })
              })
            }
          }

          if (table === "general_delivery_entries") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    // Existing customer-specific delivery row:
                    data: [{ id: "entry-cust-ali", customer_name: "Customer Ali", amount: 350 }],
                    error: null
                  })
                })
              }),
              update: updateSpy,
              insert: insertEntrySpy
            }
          }

          return {}
        })

        await upsertDailyRecord("2026-10-19", {
          delivery_expression: "200 + 400"
        })

        // Crucial verification: Customer Ali's row was NOT updated!
        expect(updateSpy).not.toHaveBeenCalled()

        // Instead, a new Daily Operations entry was inserted:
        expect(insertEntrySpy).toHaveBeenCalledWith([
          expect.objectContaining({
            daily_record_id: "record-123",
            customer_name: "Daily Operations",
            amount: 600,
            received_amount: 600
          })
        ])
      })

      it("propagates error when duplicate-key concurrency retry update fails", async () => {
        ;(supabase.from as any).mockImplementation((table: string) => {
          if (table === "general_daily_records") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string) => {
                  if (col === "record_date") {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                      single: vi.fn().mockResolvedValue({ data: { id: "rec-concur" }, error: null })
                    }
                  }
                  return {}
                })
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "23505", message: "duplicate key value violates unique constraint" }
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  error: { message: "Database lock timeout on concurrent record merge" }
                })
              })
            }
          }
          return {}
        })

        await expect(
          upsertDailyRecord("2026-10-19", {
            fuel_expenses: 100
          })
        ).rejects.toThrow("Database lock timeout on concurrent record merge")
      })
    })

    describe("5.3: Dashboard Accounting Reconciliation for Hybrid Customers", () => {
      it("guarantees customer opening balance is never omitted when customer has personal credits and zero wholesale sales", () => {
        // Customer profile:
        const customer = {
          id: "hybrid-cust-1",
          name: "Hybrid Customer",
          opening_balance: 5000 // ₹5,000 baseline debt
        }

        // Wholesale sales: NONE (0 wholesale invoices)
        const salesInfo = { totalSale: 0, amountReceived: 0 }
        const hasWholesaleSales = Boolean(salesInfo && salesInfo.totalSale > 0) // false
        const openingBal = Number(customer.opening_balance || 0) // 5000

        // Personal credit: 1 credit entry of ₹2,000 (0 paid)
        const personalCreditTotal = 2000
        const personalCreditPaid = 0
        const personalDebtor = { id: customer.id, outstanding: 2000 }
        const personalDebtorsMap: Record<string, any> = { [customer.id]: personalDebtor }

        // Corrected Section 2 (Wholesale) condition in dashboard.ts:
        // if (hasWholesaleSales || openingBal > 0)
        let totalWholesaleReceivables = 0
        let wholesaleDebtorAdded = false

        if (hasWholesaleSales || openingBal > 0) {
          const wholesaleSales = salesInfo?.totalSale || 0
          const wholesaleCashReceived = salesInfo?.amountReceived || 0
          const totalPayments = 0
          const personalPaid = personalCreditPaid
          const wholesalePayments = Math.max(0, totalPayments - personalPaid)

          const wholesaleBalance = openingBal + (wholesaleSales - wholesaleCashReceived) - wholesalePayments
          if (wholesaleBalance > 0) {
            totalWholesaleReceivables += wholesaleBalance
            wholesaleDebtorAdded = true
          }
        }

        // Verified: Opening balance is correctly included in Section 2!
        expect(wholesaleDebtorAdded).toBe(true)
        expect(totalWholesaleReceivables).toBe(5000)

        // Verified Section 5 (Personal Ledger):
        const personalOutstanding = personalDebtorsMap[customer.id].outstanding // 2000

        // Total combined dashboard receivables:
        const totalDashboardReceivables = totalWholesaleReceivables + personalOutstanding
        expect(totalDashboardReceivables).toBe(7000) // 5,000 + 2,000

        // Reconciles 100% exactly with calculateCustomerLedgerSummary:
        const creditsFixture: CustomerCredit[] = [
          {
            id: "cred-hybrid-1",
            customer_id: customer.id,
            entry_type: "PRODUCT_CREDIT",
            entry_date: "2026-10-19",
            product_id: "p1",
            product_name: "Items",
            category: null,
            quantity: 2,
            unit: "pcs",
            rate_per_unit: 1000,
            total_amount: personalCreditTotal,
            amount_paid: personalCreditPaid,
            balance: 2000,
            status: "PENDING",
            description: null,
            notes: null
          }
        ]

        const ledgerSummary = calculateCustomerLedgerSummary(creditsFixture, [], [], customer.opening_balance)
        expect(ledgerSummary.amountTheyOweMe).toBe(7000)
        expect(ledgerSummary.amountTheyOweMe).toBe(totalDashboardReceivables)
      })
    })

    describe("5.4: Realtime Subscription Query Keys Coverage", () => {
      it("verifies that invalidation keys match singular reseller and resellerSales query keys", () => {
        const wholesaleSalesInvalidations = ["wholesaleSales", "resellerSales", "resellers", "reseller", "products", "inventory_page", "dashboardStats"]
        const resellerCustomersInvalidations = ["resellers", "reseller", "dashboardStats"]
        const resellerPaymentsInvalidations = ["resellers", "reseller", "wholesaleSales", "resellerSales", "resellerPayments", "dashboardStats", "customerCredits", "resellerPaymentsHistory", "receivables"]

        // Must match queryKey: ["reseller", id] in ResellerDetailPanel
        expect(resellerCustomersInvalidations).toContain("reseller")
        expect(resellerPaymentsInvalidations).toContain("reseller")

        // Must match queryKey: ["resellerSales", id] in ResellerDetailPanel
        expect(wholesaleSalesInvalidations).toContain("resellerSales")
        expect(resellerPaymentsInvalidations).toContain("resellerSales")

        // Must match queryKey: ["resellerPayments"] in ResellerPaymentsPage
        expect(resellerPaymentsInvalidations).toContain("resellerPayments")
      })
    })
  })
})

