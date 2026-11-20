import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom"
import ResellersPage from "./index"
import ResellerDetailPage from "./ResellerDetailPage"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { 
  getResellersWithBalances
} from "@/services/resellers"
import { 
  getCustomerCredits
} from "@/services/customerCredits"
import {
  getPersonalTransactions,
  getPersonalQarzEntries
} from "@/services/personalLedger"
import { supabase } from "@/lib/supabase"
import { formatMoney } from "@/lib/utils"

const { 
  mockCreateReseller, 
  mockUpdateReseller, 
  mockDeleteReseller,
  mockCreatePersonalTransaction,
  mockCreatePersonalQarzEntry,
  mockRecordPersonalQarzRepayment,
  mockCreateCustomerCredit
} = vi.hoisted(() => ({
  mockCreateReseller: vi.fn(),
  mockUpdateReseller: vi.fn(),
  mockDeleteReseller: vi.fn(),
  mockCreatePersonalTransaction: vi.fn(),
  mockCreatePersonalQarzEntry: vi.fn(),
  mockRecordPersonalQarzRepayment: vi.fn(),
  mockCreateCustomerCredit: vi.fn()
}))

vi.mock("@/services/resellers", () => ({
  getResellersWithBalances: vi.fn(),
  createReseller: mockCreateReseller,
  createPersonalCustomer: vi.fn((...args) => mockCreateReseller(...args)),
  updateReseller: mockUpdateReseller,
  updatePersonalCustomer: vi.fn((...args) => mockUpdateReseller(...args)),
  deleteReseller: mockDeleteReseller,
  deletePersonalCustomer: vi.fn((...args) => mockDeleteReseller(...args))
}))

vi.mock("@/services/resellerPayments", () => ({
  getResellerPayments: vi.fn(),
  getResellerPaymentsByCustomer: vi.fn(),
  createResellerPayment: vi.fn()
}))

vi.mock("@/services/customerCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/customerCredits")>()
  return {
    ...actual,
    getCustomerCredits: vi.fn(),
    recordMultiEntryPayment: vi.fn(),
    createCustomerCredit: mockCreateCustomerCredit,
    updateCustomerCredit: vi.fn(),
    deleteCustomerCredit: vi.fn(),
    autoAllocateCustomerPayments: vi.fn(),
  }
})

vi.mock("@/services/personalLedger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/personalLedger")>()
  return {
    ...actual,
    getPersonalTransactions: vi.fn(),
    getPersonalQarzEntries: vi.fn(),
    createPersonalTransaction: mockCreatePersonalTransaction,
    createPersonalQarzEntry: mockCreatePersonalQarzEntry,
    recordPersonalQarzRepayment: mockRecordPersonalQarzRepayment,
    deletePersonalTransaction: vi.fn(),
    deletePersonalQarzEntry: vi.fn(),
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

const mockAuthState = {
  user: { id: "user-test", email: "test@7time.com" },
  currentWorkspace: { id: "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15", name: "7TIME Primary Enterprise" },
  signOut: vi.fn(),
}

vi.mock("@/components/auth/useAuth", () => ({
  useAuth: () => mockAuthState,
}))

describe("Personal Ledger (Standalone Redesign + Qarz-e-Hasana)", () => {
  let queryClient: QueryClient

  const mockCustomers = [
    {
      id: "cust-1",
      name: "Ishfaq ATM",
      phone: "+91 9876543210",
      address: "Main Bazar Shop 4",
      total_sales: 5000,
      total_received: 2000,
      product_credit_outstanding: 2500,
      cash_loan_outstanding: 1500,
      funds_7time_outstanding: 2500,
      funds_personal_outstanding: 1500,
      funds_unallocated_outstanding: 0,
      total_owed: 4000,
      outstanding: 7000,
      created_at: "2026-10-01",
      contact_type: "PERSONAL"
    },
    {
      id: "cust-2",
      name: "Tariq Wholesale",
      phone: "+91 9123456789",
      address: "Grain Market",
      total_sales: 4000,
      total_received: 4000,
      product_credit_outstanding: 0,
      cash_loan_outstanding: 0,
      funds_7time_outstanding: 0,
      funds_personal_outstanding: 0,
      funds_unallocated_outstanding: 0,
      total_owed: 0,
      outstanding: 0,
      created_at: "2026-10-05",
      contact_type: "PERSONAL"
    }
  ]

  const mockTransactions = [
    {
      id: "tx-1",
      user_id: "user-test",
      workspace_id: "ws-test",
      entry_type: "INCOME" as const,
      amount: 45000,
      transaction_date: "2026-11-01",
      category: "Salary",
      particulars: "Monthly Software Consulting",
      account: "Bank Account"
    },
    {
      id: "tx-2",
      user_id: "user-test",
      workspace_id: "ws-test",
      entry_type: "EXPENSE" as const,
      amount: 12000,
      transaction_date: "2026-11-02",
      category: "Groceries",
      particulars: "Supermarket Supplies",
      account: "Cash"
    },
    {
      id: "tx-3",
      user_id: "user-test",
      workspace_id: "ws-test",
      entry_type: "TRANSFER" as const,
      amount: 5000,
      transaction_date: "2026-11-02",
      category: "Transfer",
      particulars: "ATM Cash Withdrawal",
      account: "Bank Account",
      to_account: "Cash"
    }
  ]

  const mockQarzEntries = [
    {
      id: "qarz-101",
      user_id: "user-test",
      workspace_id: "ws-test",
      person_name: "Bilal Ahmad",
      direction: "GIVEN" as const,
      original_amount: 15000,
      amount_repaid: 5000,
      balance: 10000,
      transaction_date: "2026-10-25",
      account: "Bank Account",
      status: "PARTIALLY_REPAID" as const,
      repayments: [
        {
          id: "repay-1",
          qarz_entry_id: "qarz-101",
          user_id: "user-test",
          workspace_id: "ws-test",
          amount: 5000,
          repayment_date: "2026-10-30",
          payment_account: "Cash",
          notes: "First partial return"
        }
      ]
    },
    {
      id: "qarz-102",
      user_id: "user-test",
      workspace_id: "ws-test",
      person_name: "Uncle Zahoor",
      direction: "RECEIVED" as const,
      original_amount: 20000,
      amount_repaid: 0,
      balance: 20000,
      transaction_date: "2026-10-28",
      account: "Cash",
      status: "OUTSTANDING" as const,
      repayments: []
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    ;(getResellersWithBalances as any).mockResolvedValue(mockCustomers)
    ;(getCustomerCredits as any).mockResolvedValue([])
    ;(getPersonalTransactions as any).mockResolvedValue(mockTransactions)
    ;(getPersonalQarzEntries as any).mockResolvedValue(mockQarzEntries)

    mockCreatePersonalTransaction.mockImplementation((input: any) => Promise.resolve({
      ...input,
      id: "new-tx-" + Date.now()
    }))

    mockCreateReseller.mockImplementation((input: any) => Promise.resolve({
      ...input,
      id: "new-cust-" + Date.now(),
      created_at: "2026-11-10"
    }))

    mockUpdateReseller.mockImplementation((id: string, input: any) => Promise.resolve({
      id,
      ...input
    }))

    mockCreatePersonalQarzEntry.mockImplementation((input: any) => Promise.resolve({
      ...input,
      id: "new-qarz-" + Date.now(),
      amount_repaid: 0,
      balance: input.original_amount,
      status: "OUTSTANDING",
      repayments: []
    }))

    mockRecordPersonalQarzRepayment.mockImplementation((input: any) => Promise.resolve({
      ...input,
      id: "new-repay-" + Date.now()
    }))

    mockCreateCustomerCredit.mockImplementation((input: any) => Promise.resolve({
      ...input,
      id: "new-cred-" + Date.now(),
      amount_paid: 0,
      balance: input.total_amount,
      status: "PENDING"
    }))

    // Supabase dummy mock
    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      })
    })
  })

  const renderApp = (initialRoute = "/local-customers") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/local-customers" element={<ResellersPage />} />
            <Route path="/local-customers/:id" element={<ResellerDetailPage />} />
            <Route path="/reseller-payments" element={<Navigate to="/local-customers" replace />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("renders page header with PERSONAL badge and 4 independent financial summary cards", async () => {
    renderApp()

    // 3.1 Page Header
    expect(await screen.findByText("Personal Ledger")).toBeDefined()
    expect(screen.getByText("PERSONAL")).toBeDefined()
    expect(screen.getByText("Personal financial ledger for income, expenses, transfers and Qarz-e-Hasana.")).toBeDefined()
    expect(screen.getByRole("button", { name: /Add Entry/i })).toBeDefined()

    // 3.2 Four Summary Cards
    expect(screen.getByText("Total Income")).toBeDefined()
    expect(screen.getByText("Total Expense")).toBeDefined()
    expect(screen.getByText("Net Balance")).toBeDefined()
    expect(screen.getAllByText("Qarz-e-Hasana").length).toBeGreaterThanOrEqual(2)

    // Submetrics of Qarz-e-Hasana card
    expect(screen.getByText("Receivables:")).toBeDefined()
    expect(screen.getByText("Payables:")).toBeDefined()

    // Strictly verify 7TIME Funds is NOT rendered
    expect(screen.queryByText("7TIME Funds")).toBeNull()
    expect(screen.queryByText("7TIME Business Funds")).toBeNull()
  })

  it("displays transaction feed and filters by tabs: All Entries, Income, Expense, Transfers, and Qarz", async () => {
    renderApp()

    // All Entries initially rendered
    expect(await screen.findByText("Monthly Software Consulting")).toBeDefined()
    expect(screen.getByText("Supermarket Supplies")).toBeDefined()
    expect(screen.getByText("ATM Cash Withdrawal")).toBeDefined()
    expect(screen.getByText(/Qarz given to Bilal Ahmad/i)).toBeDefined()
    expect(screen.getByText(/Qarz received from Uncle Zahoor/i)).toBeDefined()
    expect(screen.getByText(/Repayment received from Bilal Ahmad/i)).toBeDefined()

    // Filter by Income
    const incomeTab = screen.getByRole("button", { name: /Income/i })
    fireEvent.click(incomeTab)
    expect(screen.getByText("Monthly Software Consulting")).toBeDefined()
    expect(screen.queryByText("Supermarket Supplies")).toBeNull()

    // Filter by Expense
    const expenseTab = screen.getByRole("button", { name: /Expense/i })
    fireEvent.click(expenseTab)
    expect(screen.getByText("Supermarket Supplies")).toBeDefined()
    expect(screen.queryByText("Monthly Software Consulting")).toBeNull()

    // Filter by Transfers
    const transferTab = screen.getByRole("button", { name: /Transfers/i })
    fireEvent.click(transferTab)
    expect(screen.getByText("ATM Cash Withdrawal")).toBeDefined()
    expect(screen.queryByText("Supermarket Supplies")).toBeNull()

    // Filter by Qarz-e-Hasana
    const qarzTab = screen.getByRole("button", { name: /^Qarz-e-Hasana/i })
    fireEvent.click(qarzTab)
    expect(screen.getByText(/Qarz given to Bilal Ahmad/i)).toBeDefined()
    expect(screen.getByText(/Qarz received from Uncle Zahoor/i)).toBeDefined()
    expect(screen.queryByText("Monthly Software Consulting")).toBeNull()
  })

  it("opens Add Entry dropdown and records an Income entry", async () => {
    renderApp()

    const addEntryBtn = await screen.findByRole("button", { name: /Add Entry/i })
    fireEvent.click(addEntryBtn)

    const addIncomeOpt = screen.getByRole("button", { name: /\+ Add Personal Income/i })
    fireEvent.click(addIncomeOpt)

    expect(screen.getByText("Record Personal Transaction")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "30000" } })
    fireEvent.change(screen.getByLabelText(/Particulars \(Description\) \*/i), { target: { value: "Freelance Project Milestone" } })

    const submitBtn = screen.getByRole("button", { name: /Save Income/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreatePersonalTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "INCOME",
          amount: 30000,
          particulars: "Freelance Project Milestone"
        })
      )
    })
  })

  it("opens Add Entry dropdown and records Qarz Given loan", async () => {
    renderApp()

    const addEntryBtn = await screen.findByRole("button", { name: /Add Entry/i })
    fireEvent.click(addEntryBtn)

    const giveQarzOpt = screen.getByRole("button", { name: /\+ Give Qarz/i })
    fireEvent.click(giveQarzOpt)

    expect(screen.getByText("Record Qarz-e-Hasana (قرضِ حسنہ)")).toBeDefined()
    expect(screen.getByText(/Qarz Given \(I Lent Money\)/i)).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Person's Name \*/i), { target: { value: "Farooq Dar" } })
    fireEvent.change(screen.getByLabelText(/Loan Amount \(₹\) \*/i), { target: { value: "8000" } })

    const submitBtn = screen.getByRole("button", { name: /Record Qarz Given/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreatePersonalQarzEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          person_name: "Farooq Dar",
          direction: "GIVEN",
          original_amount: 8000
        })
      )
    })
  })

  it("opens Qarz Detail Modal displaying loan terms and repayment timeline", async () => {
    renderApp()

    await screen.findByText(/Qarz given to Bilal Ahmad/i)

    // Filter by Qarz tab to isolate Qarz entries
    const qarzTab = screen.getByRole("button", { name: /^Qarz-e-Hasana/i })
    fireEvent.click(qarzTab)

    const eyeBtns = screen.getAllByTitle("View Qarz Details")
    expect(eyeBtns.length).toBeGreaterThan(0)
    // Click the eye button
    fireEvent.click(eyeBtns[0])

    // Should display loan detail modal
    expect(await screen.findByText(/Original Amount/i)).toBeDefined()
    expect(screen.getByText(/Remaining Balance/i)).toBeDefined()
    expect(screen.getByText(/Repayment History/i)).toBeDefined()
  })

  it("opens Record Repayment modal and validates that repayments cannot exceed remaining balance", async () => {
    renderApp()

    await screen.findByText(/Qarz given to Bilal Ahmad/i)

    // Filter by Qarz tab
    const qarzTab = screen.getByRole("button", { name: /^Qarz-e-Hasana/i })
    fireEvent.click(qarzTab)

    // Find repayment buttons
    const repayBtns = screen.getAllByTitle("Record Repayment")
    expect(repayBtns.length).toBeGreaterThan(0)
    fireEvent.click(repayBtns[0])

    // The modal opens with repayment form
    expect(await screen.findByText(/Record Repayment/i)).toBeDefined()
    expect(screen.getByText("Current Outstanding:")).toBeDefined()

    // Try over-repaying: enter 999999
    const amountInput = screen.getByLabelText(/Repayment Amount \(₹\) \*/i)
    fireEvent.change(amountInput, { target: { value: "999999" } })

    const submitBtn = screen.getByRole("button", { name: /Save Repayment/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/exceeds outstanding loan balance/i)).toBeDefined()
    expect(mockRecordPersonalQarzRepayment).not.toHaveBeenCalled()

    // Enter valid repayment
    fireEvent.change(amountInput, { target: { value: "1000" } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockRecordPersonalQarzRepayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000
        }),
        expect.anything()
      )
    })
  })

  it("allows switching to People & Contacts Directory view without displaying 7TIME Funds", async () => {
    renderApp()

    // Click People Directory view tab
    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    // In People Directory view:
    expect(await screen.findByText("People & Contacts Directory")).toBeDefined()
    expect(screen.getByText("Ishfaq ATM")).toBeDefined()
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()

    // Verify summary cards: Total People, Receivable, Payable
    expect(screen.getByText("Total People")).toBeDefined()
    expect(screen.getByText("Receivable (They Owe Me)")).toBeDefined()
    expect(screen.getByText("Payable (I Owe Them)")).toBeDefined()

    // Absolutely NO 7TIME Funds card!
    expect(screen.queryByText("7TIME Funds")).toBeNull()
    expect(screen.queryByText("7TIME Business Funds")).toBeNull()
  })

  it("verifies route redirection from /reseller-payments to /local-customers", async () => {
    renderApp("/reseller-payments")

    expect(await screen.findByText("Personal Ledger")).toBeDefined()
    expect(screen.getByText("PERSONAL")).toBeDefined()
  })

  it("opens Record Expense on Behalf modal and confirms Paid From and Quick-Pick sections are completely removed", async () => {
    renderApp()

    // Switch to People Directory
    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Confusing Money Source UI is REMOVED
    expect(screen.queryByText(/capital origin for this personal dealing/i)).toBeNull()
    expect(screen.queryByText(/Company business money/i)).toBeNull()
    expect(screen.queryByText(/Proprietor personal money/i)).toBeNull()

    // Paid From section is COMPLETELY REMOVED
    expect(screen.queryByText("Paid From")).toBeNull()
    expect(screen.queryByText("Select where the money was paid from.")).toBeNull()
    expect(screen.queryByRole("button", { name: /Bank Account/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /UPI/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Digital Wallet/i })).toBeNull()
    expect(screen.queryByText(/Paid from Account:/i)).toBeNull()

    // Inventory Quick-Pick is COMPLETELY REMOVED
    expect(screen.queryByText(/Quick-Pick:/i)).toBeNull()

    // Manual-first items section is rendered
    expect(screen.getByText("Items / Expenses")).toBeDefined()
    expect(screen.getByLabelText(/Item \/ Expense Description \*/i)).toBeDefined()
  })

  it("records Expense on Behalf with simple manual entry (description and direct amount)", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Fill Item Description and direct Amount
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Office Equipment Reimbursement" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "6500" } })

    // Verify grand total displays 6500
    expect(screen.getAllByText(formatMoney(6500))[0]).toBeDefined()

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Office Equipment Reimbursement",
          shopkeeper_name: null,
          total_amount: 6500,
          funding_source: "PERSONAL_FUNDS",
          account: null,
          notes: null
        }),
        expect.anything()
      )
    })
  })

  it("records multi-item expense with manual amounts and calculates exact grand total", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Row 1: Petrol ₹1500
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Petrol" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "1500" } })

    // Add Row 2: Medicine ₹250
    const addRowBtn = screen.getByRole("button", { name: /Add Item \/ Expense/i })
    fireEvent.click(addRowBtn)

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description 2/i), { target: { value: "Medicine" } })
    fireEvent.change(screen.getByLabelText(/Amount 2/i), { target: { value: "250" } })

    // Add Row 3: Transport ₹100
    fireEvent.click(addRowBtn)

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description 3/i), { target: { value: "Transport" } })
    fireEvent.change(screen.getByLabelText(/Amount 3/i), { target: { value: "100" } })

    // Verify Total Items and Grand Total display (1500 + 250 + 100 = 1850)
    expect(screen.getByText("3 Items")).toBeDefined()
    expect(screen.getAllByText(formatMoney(1850))[0]).toBeDefined()

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Petrol, Medicine, Transport",
          total_amount: 1850,
          account: null,
          funding_source: "PERSONAL_FUNDS"
        }),
        expect.anything()
      )
    })
  })

  it("allows funding_source to be selected as 7TIME Business Funds without payment account dependency", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Office Supplies" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "1200" } })

    // Explicitly toggle Funding Source to 7TIME Business Funds
    const businessFundsBtn = screen.getByRole("button", { name: /7TIME Business Funds/i })
    fireEvent.click(businessFundsBtn)

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Office Supplies",
          shopkeeper_name: null,
          total_amount: 1200,
          account: null,
          funding_source: "7TIME_FUNDS",
          notes: null
        }),
        expect.anything()
      )
    })
  })

  it("preserves user remarks in notes with simplified direct entry", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Hardware Tools" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "3500" } })

    // Enter user remarks in Notes field
    const notesInput = screen.getByPlaceholderText(/Add any additional details or transaction notes/i)
    fireEvent.change(notesInput, { target: { value: "Purchased at City Hardware store with bill #889" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Hardware Tools",
          shopkeeper_name: null,
          total_amount: 3500,
          account: null,
          notes: "Purchased at City Hardware store with bill #889"
        }),
        expect.anything()
      )
    })
  })

  it("confirms Shopkeeper and Location inputs are removed from new-entry UI and records cleanly", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Verify Shopkeeper and Location fields are not rendered
    expect(screen.queryByLabelText(/Shopkeeper/i)).toBeNull()
    expect(screen.queryByLabelText(/Purchase Location/i)).toBeNull()

    // Fill item description and amount
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Cooking Oil 5L" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "850" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          shopkeeper_name: null,
          purchase_location: null,
          product_name: "Cooking Oil 5L",
          total_amount: 850,
          account: null
        }),
        expect.anything()
      )
    })
  })

  it("records Expense on Behalf with null shopkeeper and purchase location", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Catering Dinner" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "4800" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          shopkeeper_name: null,
          purchase_location: null,
          product_name: "Catering Dinner",
          total_amount: 4800,
          account: null,
          funding_source: "PERSONAL_FUNDS"
        }),
        expect.anything()
      )
    })
  })

  it("records Expense on Behalf with partial settlement upfront and validates limits", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Monthly Provisions" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "5000" } })

    // Check upfront partial settlement
    const upfrontCheckbox = screen.getByLabelText(/Person paid partial settlement upfront\?/i)
    fireEvent.click(upfrontCheckbox)

    // Verify amount paid field appears
    const upfrontAmountInput = screen.getByLabelText(/Amount Paid \(₹\) \*/i)
    fireEvent.change(upfrontAmountInput, { target: { value: "2000" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Monthly Provisions",
          shopkeeper_name: null,
          total_amount: 5000,
          initial_payment_amount: 2000,
          account: null
        }),
        expect.anything()
      )
    })
  })

  it("opens Add New Person modal and successfully creates a PERSONAL contact inside a BUSINESS workspace", async () => {
    renderApp()

    // Switch to People Directory
    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    expect(await screen.findByText("People & Contacts Directory")).toBeDefined()

    // Click "+ Add Person"
    const addPersonBtn = await screen.findByRole("button", { name: /\+ Add Person/i })
    fireEvent.click(addPersonBtn)

    // Modal opens with "Add New Person" heading
    expect(await screen.findByText("Add New Person")).toBeDefined()

    // Fill form
    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Dr. Farooq" } })
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "+91 9419123456" } })
    fireEvent.change(screen.getByLabelText(/Address \/ Location/i), { target: { value: "Srinagar" } })
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: "Personal contact in enterprise" } })
    fireEvent.change(screen.getByLabelText(/Opening Balance/i), { target: { value: "1500" } })

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Save Person/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateReseller).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dr. Farooq",
          phone: "+91 9419123456",
          address: "Srinagar",
          notes: "Personal contact in enterprise",
          opening_balance: 1500,
          contact_type: "PERSONAL",
          workspace_id: "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15"
        }),
        expect.anything()
      )
    })
  })

  it("displays error banner if contact creation in business workspace fails", async () => {
    mockCreateReseller.mockRejectedValueOnce(
      new Error("Workspace type mismatch: customer contact_type is PERSONAL but workspace is BUSINESS.")
    )

    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const addPersonBtn = await screen.findByRole("button", { name: /\+ Add Person/i })
    fireEvent.click(addPersonBtn)

    expect(await screen.findByText("Add New Person")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Error Person" } })

    const submitBtn = screen.getByRole("button", { name: /Save Person/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Workspace type mismatch: customer contact_type is PERSONAL but workspace is BUSINESS/i)).toBeDefined()
  })

  it("edits an existing personal contact in business workspace preserving PERSONAL classification", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    expect(await screen.findByText("Ishfaq ATM")).toBeDefined()

    // Find edit button for Ishfaq ATM
    const editBtns = screen.getAllByTitle("Edit Person Details")
    expect(editBtns.length).toBeGreaterThan(0)
    fireEvent.click(editBtns[0])

    expect(await screen.findByText("Edit Person Details")).toBeDefined()

    // Edit phone
    const phoneInput = screen.getByLabelText(/Phone Number/i)
    fireEvent.change(phoneInput, { target: { value: "+91 9999999999" } })

    const submitBtn = screen.getByRole("button", { name: /Update Person/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockUpdateReseller).toHaveBeenCalledWith(
        "cust-1",
        expect.objectContaining({
          name: "Ishfaq ATM",
          phone: "+91 9999999999",
          contact_type: "PERSONAL"
        })
      )
    })
  })

  it("renders both funding source cards with correct titles and descriptions in Record Expense on Behalf modal", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // 1. 7TIME Business Funds Card
    expect(screen.getByRole("button", { name: /7TIME Business Funds/i })).toBeDefined()
    expect(screen.getByText("Money paid from 7TIME's own business funds.")).toBeDefined()

    // 2. Personal Funds Card
    expect(screen.getByRole("button", { name: /Personal Funds/i })).toBeDefined()
    expect(screen.getByText("Money paid personally by the owner on behalf of this person.")).toBeDefined()

    // Borrowed Funds must NOT be present
    expect(screen.queryByRole("button", { name: /Borrowed Funds/i })).toBeNull()
  })

  it("records Expense on Behalf with 7TIME Business Funds and submits account as null", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Cement & Bricks" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "15000" } })

    // Select 7TIME Business Funds
    const businessFundsBtn = screen.getByRole("button", { name: /7TIME Business Funds/i })
    fireEvent.click(businessFundsBtn)

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledTimes(1)
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Cement & Bricks",
          shopkeeper_name: null,
          total_amount: 15000,
          account: null,
          funding_source: "7TIME_FUNDS",
          notes: null
        }),
        expect.anything()
      )
    })
  })

  it("records universal multi-item expense with multiple goods/services in ONE logical transaction", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Verify Section Header and Subtitle
    expect(screen.getByText("Items / Expenses")).toBeDefined()
    expect(screen.getByText(/Describe anything purchased or paid for on behalf of this person/i)).toBeDefined()

    // Row 1: Petrol (10 Litre @ 150 = 1500)
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Petrol" } })
    const detailsToggle1 = screen.getByLabelText(/Add details for item 1/i)
    fireEvent.click(detailsToggle1)

    fireEvent.change(screen.getByLabelText(/Category 1/i), { target: { value: "Fuel" } })
    fireEvent.change(screen.getByLabelText(/Quantity 1/i), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText(/^Unit 1$/i), { target: { value: "litre" } })
    fireEvent.change(screen.getByLabelText(/Rate \/ Unit 1/i), { target: { value: "150" } })

    // Add Row 2: Engine Oil (1 Pcs @ 850 = 850)
    const addRowBtn = screen.getByRole("button", { name: /Add Item \/ Expense/i })
    fireEvent.click(addRowBtn)

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description 2/i), { target: { value: "Engine Oil" } })
    const detailsToggle2 = screen.getByLabelText(/Add details for item 2/i)
    fireEvent.click(detailsToggle2)

    fireEvent.change(screen.getByLabelText(/Category 2/i), { target: { value: "Maintenance" } })
    fireEvent.change(screen.getByLabelText(/Quantity 2/i), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText(/^Unit 2$/i), { target: { value: "pcs" } })
    fireEvent.change(screen.getByLabelText(/Rate \/ Unit 2/i), { target: { value: "850" } })

    // Add Row 3: Mechanic Service (1 Job @ 500 = 500)
    fireEvent.click(addRowBtn)

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description 3/i), { target: { value: "Mechanic Service" } })
    const detailsToggle3 = screen.getByLabelText(/Add details for item 3/i)
    fireEvent.click(detailsToggle3)

    fireEvent.change(screen.getByLabelText(/Category 3/i), { target: { value: "Labour" } })
    fireEvent.change(screen.getByLabelText(/Quantity 3/i), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText(/^Unit 3$/i), { target: { value: "job" } })
    fireEvent.change(screen.getByLabelText(/Rate \/ Unit 3/i), { target: { value: "500" } })

    // Verify Total Items and Grand Total display (1500 + 850 + 500 = 2850)
    expect(screen.getByText("3 Items")).toBeDefined()
    expect(screen.getAllByText(formatMoney(2850))[0]).toBeDefined()

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      // Must create exactly ONE logical parent transaction (prevent double entries)
      expect(mockCreateCustomerCredit).toHaveBeenCalledTimes(1)
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          shopkeeper_name: null,
          product_name: "Petrol, Engine Oil, Mechanic Service",
          total_amount: 2850,
          account: null,
          items: expect.arrayContaining([
            expect.objectContaining({ name: "Petrol", quantity: 10, unit: "litre", rate_per_unit: 150, amount: 1500 }),
            expect.objectContaining({ name: "Engine Oil", quantity: 1, unit: "pcs", rate_per_unit: 850, amount: 850 }),
            expect.objectContaining({ name: "Mechanic Service", quantity: 1, unit: "job", rate_per_unit: 500, amount: 500 })
          ])
        }),
        expect.anything()
      )
    })
  })

  it("handles duplicate and remove row actions with instant recalculation", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    // Row 1: Diesel ₹2000
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Diesel" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "2000" } })

    expect(screen.getAllByText(formatMoney(2000))[0]).toBeDefined()

    // Duplicate Row 1 -> should have 2 rows totaling 4000
    const duplicateBtn = screen.getByLabelText(/Duplicate row 1/i)
    fireEvent.click(duplicateBtn)

    expect(screen.getByText("2 Items")).toBeDefined()
    expect(screen.getAllByText(formatMoney(4000))[0]).toBeDefined()

    // Remove Row 2 -> should revert back to 1 row totaling 2000
    const removeBtn = screen.getByLabelText(/Remove row 2/i)
    fireEvent.click(removeBtn)

    expect(screen.getByText("1 Item")).toBeDefined()
    expect(screen.getAllByText(formatMoney(2000))[0]).toBeDefined()

    // Cannot remove the only remaining row (remove button is disabled)
    const onlyRemoveBtn = screen.getByLabelText(/Remove row 1/i)
    expect(onlyRemoveBtn).toHaveProperty("disabled", true)
  })

  it("validates row inputs and blocks submission on empty or invalid rows", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    // Leave Item Description empty and attempt submit
    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Row 1: Item \/ Expense Description is required/i)).toBeDefined()
    expect(mockCreateCustomerCredit).not.toHaveBeenCalled()

    // Fill Item Description but enter non-positive amount
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Filters" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "0" } })

    fireEvent.click(submitBtn)
    expect(await screen.findByText(/Please enter a valid positive amount/i)).toBeDefined()
    expect(mockCreateCustomerCredit).not.toHaveBeenCalled()
  })

  it("verifies responsive placeholders and accessible labels across the modal", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Verify main fields placeholders
    expect(screen.getByPlaceholderText("e.g. Petrol, Medicine, Groceries, Repair")).toBeDefined()
    expect(screen.getByPlaceholderText("Enter amount (₹)")).toBeDefined()
    expect(screen.getByPlaceholderText("Add any additional details or transaction notes")).toBeDefined()

    // Expand details and verify details placeholders
    const detailsToggle = screen.getByLabelText(/Add details for item 1/i)
    fireEvent.click(detailsToggle)

    expect(screen.getByPlaceholderText("e.g. Food, Transport, Medical")).toBeDefined()
    expect(screen.getByPlaceholderText("e.g. 2")).toBeDefined()
    expect(screen.getByPlaceholderText("Enter rate (₹)")).toBeDefined()

    // Enable partial settlement and verify upfront placeholders
    const upfrontCheckbox = screen.getByLabelText(/Person paid partial settlement upfront\?/i)
    fireEvent.click(upfrontCheckbox)

    expect(screen.getByPlaceholderText("Enter amount already paid (₹)")).toBeDefined()
    expect(screen.getByPlaceholderText("e.g. UPI Ref, Cheque No, Transaction ID")).toBeDefined()
  })

  it("renders People Directory as a responsive person card grid with all card details and actions", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    expect(await screen.findByText("People & Contacts Directory")).toBeDefined()

    // Verify card containers exist with test IDs
    const card1 = screen.getByTestId("person-card-cust-1")
    const card2 = screen.getByTestId("person-card-cust-2")
    expect(card1).toBeDefined()
    expect(card2).toBeDefined()

    // Verify card 1 details (Ishfaq ATM - owes money)
    expect(within(card1).getByText("IA")).toBeDefined() // Initials
    expect(within(card1).getByText("Ishfaq ATM")).toBeDefined()
    expect(within(card1).getByText("+91 9876543210")).toBeDefined()
    expect(within(card1).getByText("They Owe Me")).toBeDefined()
    expect(within(card1).getByText("₹4,000.00")).toBeDefined() // Net balance

    // Verify card 2 details (Tariq Wholesale - settled)
    expect(within(card2).getByText("TW")).toBeDefined() // Initials
    expect(within(card2).getByText("Tariq Wholesale")).toBeDefined()
    expect(within(card2).getByText("+91 9123456789")).toBeDefined()
    expect(within(card2).getAllByText("Settled").length).toBeGreaterThanOrEqual(1)

    // Test filter: "They Owe Me"
    const theyOweMeFilter = screen.getByRole("button", { name: /They Owe Me/i })
    fireEvent.click(theyOweMeFilter)
    expect(screen.getByText("Ishfaq ATM")).toBeDefined()
    expect(screen.queryByText("Tariq Wholesale")).toBeNull()

    // Test filter: "All Contacts"
    const allContactsFilter = screen.getByRole("button", { name: /All Contacts/i })
    fireEvent.click(allContactsFilter)
    expect(screen.getByText("Ishfaq ATM")).toBeDefined()
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()

    // Test search filter: type "Wholesale"
    const searchInput = screen.getByPlaceholderText("Search people...")
    fireEvent.change(searchInput, { target: { value: "Wholesale" } })
    expect(screen.queryByText("Ishfaq ATM")).toBeNull()
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()

    // Test search filter: clear search
    fireEvent.change(searchInput, { target: { value: "" } })
    expect(screen.getByText("Ishfaq ATM")).toBeDefined()
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()

    // Test card action: + Expense button on Ishfaq ATM opens modal
    const expenseBtns = screen.getAllByRole("button", { name: /\+ Expense/i })
    fireEvent.click(expenseBtns[1]) // First is in top header, second is on card
    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()
  })
})
