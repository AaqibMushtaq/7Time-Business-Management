import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

vi.mock("@/components/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "test@7time.com" },
    currentWorkspace: { id: "ws-test", name: "Personal Workspace" },
    signOut: vi.fn(),
  }),
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

  it("opens Record Expense on Behalf modal and renders simplified Paid From selector with Cash, Bank, UPI, Wallet", async () => {
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

    // New "Paid From" heading and helper text are rendered
    expect(screen.getByText("Paid From")).toBeDefined()
    expect(screen.getByText("Select where the money was paid from.")).toBeDefined()

    // Account categories are rendered
    expect(screen.getByRole("button", { name: /Cash/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Bank Account/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /UPI/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Digital Wallet/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /^Other$/i })).toBeDefined()
  })

  it("records Expense on Behalf selecting Bank Account as payment source and saves successfully", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Fill Shopkeeper and Item / Expense fields
    fireEvent.change(screen.getByLabelText(/Shopkeeper \/ Paid To \*/i), { target: { value: "ABC Traders" } })
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Office Equipment Reimbursement" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "6500" } })

    // Select Bank Account category
    const bankAccountBtn = screen.getByRole("button", { name: /Bank Account/i })
    fireEvent.click(bankAccountBtn)

    // Verify indicator displays Bank Account
    expect(screen.getByText(/Paid from Account:/i)).toBeDefined()

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Office Equipment Reimbursement",
          shopkeeper_name: "ABC Traders",
          total_amount: 6500,
          funding_source: "PERSONAL_FUNDS",
          account: "Bank Account",
          notes: null
        }),
        expect.anything()
      )
    })
  })

  it("records Expense on Behalf with custom account string and saves structured account", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Shopkeeper \/ Paid To \*/i), { target: { value: "Kashmir Oil Store" } })
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Vehicle Fuel Reimbursement" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "2400" } })

    // Select custom account option
    const selectElem = screen.getByDisplayValue("Cash")
    fireEvent.change(selectElem, { target: { value: "CUSTOM" } })

    // Enter custom account name
    const customInput = screen.getByPlaceholderText(/Enter account name/i)
    fireEvent.change(customInput, { target: { value: "HDFC Salary Account" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Vehicle Fuel Reimbursement",
          shopkeeper_name: "Kashmir Oil Store",
          total_amount: 2400,
          account: "HDFC Salary Account",
          notes: null
        }),
        expect.anything()
      )
    })
  })

  it("allows funding_source to be selected independently of account", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    fireEvent.change(screen.getByLabelText(/Shopkeeper \/ Paid To \*/i), { target: { value: "City Stationers" } })
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Office Supplies" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "1200" } })

    // Select UPI account
    const upiBtn = screen.getByRole("button", { name: /UPI/i })
    fireEvent.click(upiBtn)

    // Explicitly toggle Funding Source to Business Funds (displays as Business Funds, persists as 7TIME_FUNDS)
    const businessFundsBtn = screen.getByRole("button", { name: /^Business Funds$/i })
    fireEvent.click(businessFundsBtn)

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Office Supplies",
          shopkeeper_name: "City Stationers",
          total_amount: 1200,
          account: "UPI",
          funding_source: "7TIME_FUNDS",
          notes: null
        }),
        expect.anything()
      )
    })
  })

  it("preserves user remarks in notes without account string prefix or suffix", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Shopkeeper \/ Paid To \*/i), { target: { value: "City Hardware" } })
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Hardware Tools" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "3500" } })

    // Enter user remarks in Notes field
    const notesInput = screen.getByPlaceholderText(/Any additional notes or transaction details/i)
    fireEvent.change(notesInput, { target: { value: "Purchased at City Hardware store with bill #889" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Hardware Tools",
          shopkeeper_name: "City Hardware",
          total_amount: 3500,
          account: "Cash",
          notes: "Purchased at City Hardware store with bill #889"
        }),
        expect.anything()
      )
    })
  })

  it("validates that Shopkeeper / Paid To is required for Expense on Behalf", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Omit shopkeeper name but fill item name and amount
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Cooking Oil 5L" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "850" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Shopkeeper \/ Paid To is required for Expense on Behalf/i)).toBeDefined()
    expect(mockCreateCustomerCredit).not.toHaveBeenCalled()
  })

  it("records Expense on Behalf with both Shopkeeper and optional Purchase Location", async () => {
    renderApp()

    const peopleDirTab = await screen.findByRole("button", { name: /People Directory/i })
    fireEvent.click(peopleDirTab)

    const recordExpenseBtn = await screen.findByRole("button", { name: /\+ Record Expense on Behalf/i })
    fireEvent.click(recordExpenseBtn)

    expect(await screen.findByText("Record Expense on Behalf")).toBeDefined()

    // Fill Shopkeeper and Location
    fireEvent.change(screen.getByLabelText(/Shopkeeper \/ Paid To \*/i), { target: { value: "Hotel Afaq" } })
    fireEvent.change(screen.getByLabelText(/Shop \/ Purchase Location/i), { target: { value: "Lal Chowk, Srinagar" } })
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Catering Dinner" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "4800" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          shopkeeper_name: "Hotel Afaq",
          purchase_location: "Lal Chowk, Srinagar",
          product_name: "Catering Dinner",
          total_amount: 4800,
          account: "Cash",
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

    fireEvent.change(screen.getByLabelText(/Shopkeeper \/ Paid To \*/i), { target: { value: "Bismillah General Store" } })
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Name \*/i), { target: { value: "Monthly Provisions" } })
    fireEvent.change(screen.getByLabelText(/Total Amount Spent \(Rs\) \*/i), { target: { value: "5000" } })

    // Check upfront partial settlement
    const upfrontCheckbox = screen.getByLabelText(/Person paid partial settlement upfront\?/i)
    fireEvent.click(upfrontCheckbox)

    // Verify amount paid field appears
    const upfrontAmountInput = screen.getByLabelText(/Amount Paid \(Rs\) \*/i)
    fireEvent.change(upfrontAmountInput, { target: { value: "2000" } })

    const submitBtn = screen.getByRole("button", { name: /Save Expense on Behalf/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: "PRODUCT_CREDIT",
          product_name: "Monthly Provisions",
          shopkeeper_name: "Bismillah General Store",
          total_amount: 5000,
          initial_payment_amount: 2000
        }),
        expect.anything()
      )
    })
  })
})
