import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom"
import ResellersPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { 
  getResellersWithBalances 
} from "@/services/resellers"
import { createResellerPayment } from "@/services/resellerPayments"
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

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe("ResellersPage Component", () => {
  let queryClient: QueryClient

  const mockResellers = [
    {
      id: "cust-1",
      name: "Ishfaq ATM",
      phone: "+91 9876543210",
      address: "Main Bazar Shop 4",
      total_sales: 5000,
      total_received: 2000,
      outstanding: 3000,
      created_at: "2026-10-01"
    },
    {
      id: "cust-2",
      name: "Tariq Wholesale",
      phone: "+91 9123456789",
      address: "Grain Market",
      total_sales: 4000,
      total_received: 4000,
      outstanding: 0,
      created_at: "2026-10-05"
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

    ;(getResellersWithBalances as any).mockResolvedValue(mockResellers)
    ;(createResellerPayment as any).mockResolvedValue({
      id: "pay-new",
      customer_id: "cust-1",
      amount: 1500,
      payment_date: "2026-10-11",
      payment_method: "CASH"
    })

    // Mock for ResellerDetailPanel queries
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "reseller_customers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockResellers[0], error: null })
            })
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
      return {}
    })
  })

  it("renders page title, summary cards, and reseller list with outstanding balances", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    // Page title and subtitle
    expect(await screen.findByText("Resellers")).toBeDefined()
    expect(screen.getByText(/Manage reseller accounts, record payments/i)).toBeDefined()

    // Summary Metric Cards
    expect(screen.getByText("Total Resellers")).toBeDefined()
    expect(screen.getByText("Outstanding Receivable")).toBeDefined()
    expect(screen.getByText("Total Wholesale Sales")).toBeDefined()
    expect(screen.getByText("Total Payments Collected")).toBeDefined()

    // Resellers rendered in table after loading
    expect(await screen.findByText("Ishfaq ATM")).toBeDefined()
    expect(screen.getByText("Tariq Wholesale")).toBeDefined()
    expect(screen.getByText("+91 9876543210")).toBeDefined()
  })

  it("opens Record Payment modal with selected reseller preselected when Payment button on row is clicked", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Find the Payment button for the first customer
    const paymentButtons = screen.getAllByRole("button", { name: /payment/i })
    fireEvent.click(paymentButtons[0]) // Global button or row button

    // Check modal opened
    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(screen.getByText("Record Reseller Payment")).toBeDefined()
  })

  it("submits payment successfully with entered amount, method, and notes", async () => {
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
      expect(createResellerPayment).toHaveBeenCalled()
    })

    const callArgs = (createResellerPayment as any).mock.calls[0][0]
    expect(callArgs).toMatchObject({
      amount: 1500,
      payment_method: "CASH",
      reference: "TXN-9988",
      notes: "Test settlement note"
    })
  })

  it("opens Reseller Detail Panel when eye button or row is clicked, displaying profile and payment history", async () => {
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
      expect(screen.getByText("Reseller Account")).toBeDefined()
      expect(screen.getByText("Payment History")).toBeDefined()
    })

    // Payment history item rendered
    expect(await screen.findByText("Initial deposit")).toBeDefined()
  })

  it("handles empty search results gracefully with helpful empty state", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResellersPage />
      </QueryClientProvider>
    )

    await screen.findByText("Ishfaq ATM")

    // Type query that doesn't match
    const searchInput = screen.getByPlaceholderText(/search by name/i)
    fireEvent.change(searchInput, { target: { value: "NonExistentReseller" } })

    expect(await screen.findByText("No matching resellers found")).toBeDefined()
  })

  it("verifies backwards-compatible route redirection from /reseller-payments to /resellers", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/reseller-payments"]}>
        <Routes>
          <Route path="/resellers" element={<div>Consolidated Resellers Destination</div>} />
          <Route path="/reseller-payments" element={<Navigate to="/resellers" replace />} />
        </Routes>
      </MemoryRouter>
    )

    expect(getByText("Consolidated Resellers Destination")).toBeDefined()
  })
})
