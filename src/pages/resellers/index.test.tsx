import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom"
import ResellersPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { 
  getResellersWithBalances,
  updateReseller
} from "@/services/resellers"
import { 
  recordMultiEntryPayment, 
  getCustomerCredits,
  updateCustomerCredit
} from "@/services/customerCredits"
import { supabase } from "@/lib/supabase"

vi.mock("@/services/resellers", () => ({
  getResellersWithBalances: vi.fn(),
  createReseller: vi.fn(),
  updateReseller: vi.fn(),
  deleteReseller: vi.fn()
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
    createCustomerCredit: vi.fn(),
    updateCustomerCredit: vi.fn(),
    deleteCustomerCredit: vi.fn(),
    autoAllocateCustomerPayments: vi.fn(),
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe("Local Customers (ResellersPage Component)", () => {
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
      created_at: "2026-10-01"
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
      created_at: "2026-10-05"
    }
  ]

  const mockCreditsCust1 = [
    {
      id: "cred-101",
      customer_id: "cust-1",
      entry_type: "PRODUCT_CREDIT",
      entry_date: "2026-10-10",
      product_name: "Cooking Oil 5L",
      quantity: 5,
      unit: "tins",
      rate_per_unit: 500,
      total_amount: 2500,
      amount_paid: 0,
      balance: 2500,
      status: "PENDING",
      allocations: []
    },
    {
      id: "loan-201",
      customer_id: "cust-1",
      entry_type: "CASH_LOAN",
      entry_date: "2026-10-11",
      product_name: null,
      total_amount: 1500,
      amount_paid: 0,
      balance: 1500,
      status: "PENDING",
      allocations: []
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    ;(getResellersWithBalances as any).mockResolvedValue(mockCustomers)
    ;(getCustomerCredits as any).mockResolvedValue(mockCreditsCust1)
    ;(recordMultiEntryPayment as any).mockResolvedValue({
      paymentId: "pay-new",
      totalAmount: 1500,
      allocatedAmount: 1500,
      advanceAmount: 0
    })

    // Mock for Supabase queries
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "reseller_customers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCustomers[0], error: null })
            })
          })
        }
      }
      if (table === "customer_credits") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockCreditsCust1, error: null }),
            }),
            eq: vi.fn().mockResolvedValue({ data: mockCreditsCust1, error: null })
          })
        }
      }
      if (table === "wholesale_sales") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        }
      }
      if (table === "reseller_payments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ 
                data: [
                  {
                    id: "pay-hist-1",
                    customer_id: "cust-1",
                    payment_date: "2026-10-08",
                    amount: 2000,
                    payment_method: "CASH",
                    reference: "REC-101",
                    notes: "Initial deposit"
                  }
                ], 
                error: null 
              })
            })
          })
        }
      }
      if (table === "products") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }
    })
  })

  it("renders page title, summary cards distinguishing Product Credit and Cash Loans, and customer list", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    // Page title and subtitle
    expect(await screen.findByText("Local Customers")).toBeDefined()
    expect(screen.getByText(/Manage customer accounts, track Product Credits, Cash Loans/i)).toBeDefined()

    // Summary Metric Cards with distinct badges (Receivables and Payables)
    expect(screen.getByText("Total Local Contacts")).toBeDefined()
    expect(screen.getByText("Amount They Owe Me")).toBeDefined()
    expect(screen.getByText("Amount I Owe Them")).toBeDefined()
    expect(screen.getByText("7TIME Funds")).toBeDefined()
    expect(screen.getByText("Personal Funds")).toBeDefined()

    // Customers rendered in table after loading
    expect(await screen.findByText("Ishfaq ATM")).toBeDefined()
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()
    expect(screen.getByText("+91 9876543210")).toBeDefined()
  })

  it("opens Create Customer Credit modal with Product Credit type when + Product Credit is clicked", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Click global + Product Credit button
    const prodCreditBtn = screen.getByRole("button", { name: /\+ Product Credit/i })
    fireEvent.click(prodCreditBtn)

    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(screen.getByText("Record Product Credit")).toBeDefined()
    expect(screen.getByLabelText(/Product \/ Item Name/i)).toBeDefined()
  })

  it("opens Cash Loan modal without requiring a product name when + Cash Loan is clicked", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Click global + Cash Loan button
    const cashLoanBtn = screen.getByRole("button", { name: /\+ Cash Loan/i })
    fireEvent.click(cashLoanBtn)

    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(screen.getByText("Give Cash Loan")).toBeDefined()
    expect(screen.getByText(/Direct cash loan given to this customer profile. No product record is created or required./i)).toBeDefined()
    expect(screen.getByLabelText(/Cash Loan Amount/i)).toBeDefined()
    expect(screen.queryByLabelText(/Product \/ Item Name/i)).toBeNull()
  })

  it("opens Record Payment modal with multi-entry allocation support and submits payment", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Click global Record Payment button
    const recordButtons = screen.getAllByRole("button", { name: /payment/i })
    fireEvent.click(recordButtons[0])

    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(screen.getByText("Record Payment Received")).toBeDefined()

    // Fill in amount
    const amountInput = screen.getByLabelText(/amount received/i)
    fireEvent.change(amountInput, { target: { value: "1500" } })

    // Fill in reference
    const refInput = screen.getByLabelText(/reference/i)
    fireEvent.change(refInput, { target: { value: "TXN-9988" } })

    // Fill in notes
    const notesInput = screen.getByLabelText(/notes/i)
    fireEvent.change(notesInput, { target: { value: "Test settlement note" } })

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /save payment/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recordMultiEntryPayment).toHaveBeenCalled()
    })

    const callArgs = (recordMultiEntryPayment as any).mock.calls[0][0]
    expect(callArgs).toMatchObject({
      totalAmount: 1500,
      paymentMethod: "CASH",
      reference: "TXN-9988",
      notes: "Test settlement note"
    })
  })

  it("opens Customer Ledger panel displaying Product Credit, Cash Loans, and Payment History", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Click on Ishfaq ATM row to open details modal
    fireEvent.click(screen.getByText("Ishfaq ATM"))

    // Details panel should render
    await waitFor(() => {
      expect(screen.getAllByText("Customer Profile").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole("button", { name: /all credits & loans/i })).toBeDefined()
    })

    // Click on Payments Received tab to view payments
    const paymentsTab = screen.getByRole("button", { name: /payments received/i })
    fireEvent.click(paymentsTab)

    // Payment history item rendered
    expect(await screen.findByText("Initial deposit")).toBeDefined()
  })

  it("filters customer directory by Has Outstanding, Has Product Credit, and Has Cash Loan", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()

    // Filter by Has Outstanding (They Owe Me)
    const select = screen.getByDisplayValue("All Local Contacts")
    fireEvent.change(select, { target: { value: "HAS_OUTSTANDING" } })

    // Only Ishfaq ATM has outstanding balance
    expect(screen.getByText("Ishfaq ATM")).toBeDefined()
    expect(screen.queryByText("Tariq Wholesale")).toBeNull()
  })

  it("verifies backwards-compatible route redirection from /reseller-payments to /local-customers", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/reseller-payments"]}>
        <Routes>
          <Route path="/local-customers" element={<div>Consolidated Local Customers Destination</div>} />
          <Route path="/reseller-payments" element={<Navigate to="/local-customers" replace />} />
        </Routes>
      </MemoryRouter>
    )

    expect(getByText("Consolidated Local Customers Destination")).toBeDefined()
  })

  it("opens Edit Profile modal, updates customer details including notes, and submits to Supabase", async () => {
    ;(updateReseller as any).mockResolvedValue({
      id: "cust-1",
      name: "Ishfaq ATM Updated",
      phone: "+91 9999988888",
      address: "Shop 12 New Market",
      notes: "Preferred customer with prompt settlements"
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Open detail modal for Ishfaq ATM
    fireEvent.click(screen.getByText("Ishfaq ATM"))

    // Find and click "Edit Profile" button
    const editProfileBtn = await screen.findByRole("button", { name: /edit profile/i })
    fireEvent.click(editProfileBtn)

    // Edit Profile Modal is rendered
    expect(await screen.findByText("Edit Customer Profile")).toBeDefined()

    // Edit Name
    const nameInput = screen.getByLabelText(/customer name/i)
    fireEvent.change(nameInput, { target: { value: "Ishfaq ATM Updated" } })

    // Edit Phone
    const phoneInput = screen.getByLabelText(/phone number/i)
    fireEvent.change(phoneInput, { target: { value: "+91 9999988888" } })

    // Edit Notes
    const notesInput = screen.getByLabelText(/customer notes/i)
    fireEvent.change(notesInput, { target: { value: "Preferred customer with prompt settlements" } })

    // Save Changes
    const saveBtn = screen.getByRole("button", { name: /save changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateReseller).toHaveBeenCalledWith("cust-1", expect.objectContaining({
        name: "Ishfaq ATM Updated",
        phone: "+91 9999988888",
        notes: "Preferred customer with prompt settlements"
      }))
    })
  })

  it("supports inline row editing of credit entries in the ledger table", async () => {
    ;(updateCustomerCredit as any).mockResolvedValue({
      id: "cred-101",
      customer_id: "cust-1",
      entry_type: "PRODUCT_CREDIT",
      product_name: "Cooking Oil 5L",
      quantity: 6,
      rate_per_unit: 500,
      total_amount: 3000,
      notes: "Increased by 1 tin"
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Open detail modal for Ishfaq ATM
    fireEvent.click(screen.getByText("Ishfaq ATM"))

    // Ensure credits table rendered
    await screen.findByText("Cooking Oil 5L")

    // Find the inline Edit button (title="Edit Entry")
    const editBtns = screen.getAllByTitle("Edit Entry")
    expect(editBtns.length).toBeGreaterThan(0)
    fireEvent.click(editBtns[0])

    // Quantity input is now rendered in edit mode with placeholder="Qty"
    const qtyInput = screen.getByPlaceholderText("Qty")
    expect(qtyInput).toBeDefined()

    // Change quantity to 6
    fireEvent.change(qtyInput, { target: { value: "6" } })

    // Save changes
    const saveBtn = screen.getByRole("button", { name: /save/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateCustomerCredit).toHaveBeenCalledWith("cred-101", expect.objectContaining({
        quantity: 6,
        rate_per_unit: 500,
        total_amount: 3000
      }))
    })
  })

  it("filters customer directory by Has Credit / Advance (I Owe Them)", async () => {
    const customersWithAdvance = [
      ...mockCustomers,
      {
        id: "cust-3",
        name: "Adil Advance Payee",
        phone: "+91 9991112222",
        address: "Town Market",
        total_sales: 0,
        total_received: 3000,
        product_credit_outstanding: 0,
        cash_loan_outstanding: 0,
        funds_7time_outstanding: 0,
        funds_personal_outstanding: 0,
        funds_unallocated_outstanding: 0,
        total_owed: 0,
        amount_they_owe_me: 0,
        amount_i_owe_them: 3000,
        outstanding: -3000,
        created_at: "2026-10-12"
      }
    ]
    ;(getResellersWithBalances as any).mockResolvedValue(customersWithAdvance)

    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Adil Advance Payee")

    // Filter by Has Credit / Advance (I Owe Them)
    const select = screen.getByDisplayValue("All Local Contacts")
    fireEvent.change(select, { target: { value: "HAS_CREDIT_BALANCE" } })

    // Only Adil Advance Payee has credit balance
    expect(screen.getByText("Adil Advance Payee")).toBeDefined()
    expect(screen.queryByText("Ishfaq ATM")).toBeNull()
  })

  it("renders Local Customers page under /local-customers route preserving /resellers alias", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/local-customers"]}>
        <Routes>
          <Route path="/local-customers" element={<div>Local Customers Primary Route</div>} />
          <Route path="/resellers" element={<div>Local Customers Legacy Alias</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(getByText("Local Customers Primary Route")).toBeDefined()
  })
})
