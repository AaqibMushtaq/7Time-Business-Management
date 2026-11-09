import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  calculatePersonalLedgerSummary,
  buildUnifiedPersonalEntries,
  createPersonalTransaction,
  updatePersonalTransaction,
  createPersonalTransfer,
  createPersonalQarzEntry,
  recordPersonalQarzRepayment,
  deletePersonalQarzEntry,
  type PersonalTransaction,
  type PersonalQarzEntry
} from "./personalLedger"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}))

describe("Personal Ledger Service & Accounting Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe("calculatePersonalLedgerSummary", () => {
    it("correctly computes Income, Expense, and Net Balance while keeping Qarz separate", () => {
      const mockTransactions: PersonalTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "INCOME",
          amount: 50000,
          transaction_date: "2026-11-01",
          category: "Salary",
          particulars: "Monthly salary",
          account: "Bank"
        },
        {
          id: "tx-2",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "INCOME",
          amount: 15000,
          transaction_date: "2026-11-02",
          category: "Freelance",
          particulars: "Client consulting",
          account: "Bank"
        },
        {
          id: "tx-3",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "EXPENSE",
          amount: 20000,
          transaction_date: "2026-11-03",
          category: "Rent",
          particulars: "House rent",
          account: "Bank"
        },
        {
          id: "tx-4",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "EXPENSE",
          amount: 5000,
          transaction_date: "2026-11-03",
          category: "Groceries",
          particulars: "Weekly groceries",
          account: "Cash"
        },
        {
          id: "tx-5",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "TRANSFER",
          amount: 10000,
          transaction_date: "2026-11-03",
          category: "Transfer",
          particulars: "ATM withdrawal",
          account: "Bank",
          to_account: "Cash"
        }
      ]

      const mockQarz: PersonalQarzEntry[] = [
        {
          id: "qarz-1",
          user_id: "user-1",
          workspace_id: "ws-1",
          person_name: "Brother Ahmed",
          direction: "GIVEN",
          original_amount: 25000,
          amount_repaid: 10000,
          balance: 15000,
          transaction_date: "2026-10-15",
          account: "Bank",
          status: "PARTIALLY_REPAID"
        },
        {
          id: "qarz-2",
          user_id: "user-1",
          workspace_id: "ws-1",
          person_name: "Uncle Tariq",
          direction: "RECEIVED",
          original_amount: 40000,
          amount_repaid: 10000,
          balance: 30000,
          transaction_date: "2026-10-20",
          account: "Bank",
          status: "PARTIALLY_REPAID"
        }
      ]

      const summary = calculatePersonalLedgerSummary(mockTransactions, mockQarz)

      // Total Income = 50000 + 15000 = 65000
      expect(summary.totalIncome).toBe(65000)
      // Total Expense = 20000 + 5000 = 25000 (Transfer not included)
      expect(summary.totalExpense).toBe(25000)
      // Net Balance = 65000 - 25000 = 40000
      expect(summary.netBalance).toBe(40000)

      // Qarz metrics:
      // Total Given: 25000
      expect(summary.qarz.totalGiven).toBe(25000)
      // Outstanding Receivables: 15000
      expect(summary.qarz.outstandingReceivables).toBe(15000)
      // Total Received: 40000
      expect(summary.qarz.totalReceived).toBe(40000)
      // Outstanding Payables: 30000
      expect(summary.qarz.outstandingPayables).toBe(30000)
    })

    it("verifies account transfers have zero effect on combined Net Balance", () => {
      const transactionsWithTransfers: PersonalTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "INCOME",
          amount: 10000,
          transaction_date: "2026-11-01",
          category: "Salary",
          particulars: "Salary",
          account: "Bank"
        },
        {
          id: "t-1",
          user_id: "u1",
          workspace_id: "ws-1",
          entry_type: "TRANSFER",
          amount: 4000,
          transaction_date: "2026-11-02",
          category: "Transfer",
          particulars: "Transfer to Savings",
          account: "Bank",
          to_account: "Savings"
        },
        {
          id: "t-2",
          user_id: "u1",
          workspace_id: "ws-1",
          entry_type: "TRANSFER",
          amount: 2000,
          transaction_date: "2026-11-03",
          category: "Transfer",
          particulars: "Transfer to Cash",
          account: "Bank",
          to_account: "Cash"
        }
      ]

      const summary = calculatePersonalLedgerSummary(transactionsWithTransfers, [])
      expect(summary.totalIncome).toBe(10000)
      expect(summary.totalExpense).toBe(0)
      expect(summary.netBalance).toBe(10000)
    })
  })

  describe("buildUnifiedPersonalEntries", () => {
    it("assembles and orders unified entries with clear visual typing", () => {
      const mockTransactions: PersonalTransaction[] = [
        {
          id: "tx-1",
          user_id: "user-1",
          workspace_id: "ws-1",
          entry_type: "INCOME",
          amount: 5000,
          transaction_date: "2026-11-01",
          category: "Bonus",
          particulars: "Performance bonus",
          account: "Bank"
        }
      ]

      const mockQarz: PersonalQarzEntry[] = [
        {
          id: "qarz-1",
          user_id: "user-1",
          workspace_id: "ws-1",
          person_name: "Zaid",
          direction: "GIVEN",
          original_amount: 10000,
          amount_repaid: 2000,
          balance: 8000,
          transaction_date: "2026-11-02",
          account: "Cash",
          status: "PARTIALLY_REPAID",
          repayments: [
            {
              id: "repay-1",
              qarz_entry_id: "qarz-1",
              user_id: "user-1",
              workspace_id: "ws-1",
              amount: 2000,
              repayment_date: "2026-11-03",
              payment_account: "Cash",
              notes: "First installment"
            }
          ]
        }
      ]

      const entries = buildUnifiedPersonalEntries(mockTransactions, mockQarz)

      // Total items = 1 tx + 1 qarz + 1 repayment = 3
      expect(entries).toHaveLength(3)
      // Sorted descending by date: Nov 3 -> Nov 2 -> Nov 1
      expect(entries[0].type).toBe("REPAYMENT_RECEIVED")
      expect(entries[0].particulars).toContain("Repayment received from Zaid")
      expect(entries[0].amount).toBe(2000)

      expect(entries[1].type).toBe("QARZ_GIVEN")
      expect(entries[1].particulars).toContain("Qarz given to Zaid")
      expect(entries[1].amount).toBe(10000)

      expect(entries[2].type).toBe("INCOME")
      expect(entries[2].particulars).toBe("Performance bonus")
      expect(entries[2].amount).toBe(5000)
    })

    it("prevents displaying duplicate twin rows for double-entry linked transfers", () => {
      const linkedTransfers: PersonalTransaction[] = [
        {
          id: "00000000-0000-0000-0000-000000000001",
          user_id: "u1",
          workspace_id: "ws1",
          entry_type: "TRANSFER",
          amount: 5000,
          transaction_date: "2026-11-01",
          category: "Transfer",
          particulars: "ATM Withdrawal",
          account: "Bank",
          to_account: "Cash",
          linked_transaction_id: "00000000-0000-0000-0000-000000000002"
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          user_id: "u1",
          workspace_id: "ws1",
          entry_type: "TRANSFER",
          amount: 5000,
          transaction_date: "2026-11-01",
          category: "Transfer",
          particulars: "ATM Withdrawal",
          account: "Cash",
          to_account: "Bank",
          linked_transaction_id: "00000000-0000-0000-0000-000000000001"
        }
      ]

      const entries = buildUnifiedPersonalEntries(linkedTransfers, [])
      expect(entries).toHaveLength(1)
      expect(entries[0].account).toBe("Bank → Cash")
    })
  })

  describe("Validation & Integrity Controls", () => {
    it("rejects non-positive transaction amounts", async () => {
      await expect(
        createPersonalTransaction({
          user_id: "u1",
          workspace_id: "ws1",
          entry_type: "INCOME",
          amount: 0,
          transaction_date: "2026-11-01",
          category: "Salary",
          particulars: "Salary",
          account: "Bank"
        })
      ).rejects.toThrow("Amount must be greater than zero.")
    })

    it("rejects same-account transfers", async () => {
      await expect(
        createPersonalTransaction({
          user_id: "u1",
          workspace_id: "ws1",
          entry_type: "TRANSFER",
          amount: 1000,
          transaction_date: "2026-11-01",
          category: "Transfer",
          particulars: "Internal move",
          account: "Cash",
          to_account: "Cash"
        })
      ).rejects.toThrow("Source and destination accounts must be different.")
    })

    it("rejects non-positive Qarz amounts or empty person names", async () => {
      await expect(
        createPersonalQarzEntry({
          user_id: "u1",
          workspace_id: "ws1",
          direction: "GIVEN",
          person_name: "",
          original_amount: 5000,
          transaction_date: "2026-11-01",
          account: "Cash"
        })
      ).rejects.toThrow("Person's name is required.")

      await expect(
        createPersonalQarzEntry({
          user_id: "u1",
          workspace_id: "ws1",
          direction: "GIVEN",
          person_name: "Farhan",
          original_amount: -100,
          transaction_date: "2026-11-01",
          account: "Cash"
        })
      ).rejects.toThrow("Loan amount must be greater than zero.")
    })

    it("prevents over-repayment exceeding the outstanding loan balance", async () => {
      const qarzEntry: PersonalQarzEntry = {
        id: "q-1",
        user_id: "u1",
        workspace_id: "ws1",
        person_name: "Farhan",
        direction: "GIVEN",
        original_amount: 5000,
        amount_repaid: 3000,
        balance: 2000, // Remaining balance is 2000
        transaction_date: "2026-11-01",
        account: "Cash",
        status: "PARTIALLY_REPAID"
      }

      await expect(
        recordPersonalQarzRepayment(
          {
            qarz_entry_id: "q-1",
            user_id: "u1",
            workspace_id: "ws1",
            amount: 2500, // Over-repayment!
            repayment_date: "2026-11-02",
            payment_account: "Cash"
          },
          qarzEntry
        )
      ).rejects.toThrow(/cannot exceed the outstanding balance/)
    })

    it("prevents deleting a Qarz entry that has recorded repayments", async () => {
      ;(supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "repay-1" }],
            error: null
          })
        })
      })

      await expect(
        deletePersonalQarzEntry("q-1", "ws1")
      ).rejects.toThrow("Cannot delete a loan that has recorded repayment history.")
    })

    it("throws explicit actionable error when Supabase remote persistence fails (never silently succeeds)", async () => {
      ;(supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "database network timeout" }
            })
          })
        })
      })

      await expect(
        createPersonalTransaction({
          user_id: "u1",
          workspace_id: "ws1",
          entry_type: "INCOME",
          amount: 5000,
          transaction_date: "2026-11-01",
          category: "Salary",
          particulars: "Monthly salary",
          account: "Bank"
        })
      ).rejects.toThrow(/Failed to record personal transaction: database network timeout/)
    })

    it("records repayment atomically using PostgreSQL RPC when available", async () => {
      ;(supabase.rpc as any).mockResolvedValue({
        data: {
          id: "rpc-repay-123",
          qarz_entry_id: "q-1",
          amount: 1000,
          repayment_date: "2026-11-03",
          payment_account: "Cash",
          new_amount_repaid: 1000,
          new_balance: 4000,
          new_status: "PARTIALLY_REPAID"
        },
        error: null
      })

      const qarzEntry: PersonalQarzEntry = {
        id: "q-1",
        user_id: "u1",
        workspace_id: "ws1",
        person_name: "Farhan",
        direction: "GIVEN",
        original_amount: 5000,
        amount_repaid: 0,
        balance: 5000,
        transaction_date: "2026-11-01",
        account: "Cash",
        status: "OUTSTANDING"
      }

      const res = await recordPersonalQarzRepayment(
        {
          qarz_entry_id: "q-1",
          user_id: "u1",
          workspace_id: "ws1",
          amount: 1000,
          repayment_date: "2026-11-03",
          payment_account: "Cash"
        },
        qarzEntry
      )

      expect(supabase.rpc).toHaveBeenCalledWith("record_personal_qarz_repayment", expect.any(Object))
      expect(res.id).toBe("rpc-repay-123")
      expect(res.amount).toBe(1000)
    })

    it("updates existing personal transactions correctly with validation", async () => {
      ;(supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "tx-1",
                    amount: 6000,
                    particulars: "Updated salary"
                  },
                  error: null
                })
              })
            })
          })
        })
      })

      const updated = await updatePersonalTransaction(
        "tx-1",
        { amount: 6000, particulars: "Updated salary" },
        "ws-1"
      )

      expect(updated.amount).toBe(6000)
      expect(updated.particulars).toBe("Updated salary")

      // Rejects negative amount update
      await expect(
        updatePersonalTransaction("tx-1", { amount: -50 }, "ws-1")
      ).rejects.toThrow("Amount must be greater than zero.")
    })

    it("creates personal transfer via RPC or direct insert", async () => {
      ;(supabase.rpc as any).mockResolvedValue({
        data: { debit_id: "deb-1", credit_id: "cred-1" },
        error: null
      })

      const transferResult = await createPersonalTransfer({
        workspace_id: "ws-1",
        user_id: "u-1",
        amount: 2500,
        transaction_date: "2026-11-03",
        from_account: "Cash",
        to_account: "Bank Account",
        particulars: "Deposit to bank"
      })

      expect(transferResult.debit_id).toBe("deb-1")
      expect(transferResult.credit_id).toBe("cred-1")

      // Rejects transfer between identical accounts
      await expect(
        createPersonalTransfer({
          workspace_id: "ws-1",
          user_id: "u-1",
          amount: 2500,
          transaction_date: "2026-11-03",
          from_account: "Cash",
          to_account: "Cash",
          particulars: "Self transfer"
        })
      ).rejects.toThrow("Source and destination accounts must be different.")
    })
  })
})
