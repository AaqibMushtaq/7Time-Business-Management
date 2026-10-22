import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import DealerPaymentsPage from "./DealerPaymentsPage"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import {
  getDealerPayments,
  createDealerPayment,
  deleteDealerPayment,
} from "@/services/dealerPayments"
import { getDealers } from "@/services/dealers"
import { getPurchases } from "@/services/purchases"
import { formatMoney } from "@/lib/utils"

vi.mock("@/services/dealerPayments", () => ({
  getDealerPayments: vi.fn(),
  createDealerPayment: vi.fn(),
  updateDealerPayment: vi.fn(),
  deleteDealerPayment: vi.fn(),
}))

vi.mock("@/services/dealers", () => ({
  getDealers: vi.fn(),
}))

vi.mock("@/services/purchases", () => ({
  getPurchases: vi.fn(),
}))

describe("DealerPaymentsPage Component & Ledger Reconciliation", () => {
  let queryClient: QueryClient

  const mockDealers = [
    {
      id: "d1",
      name: "AL INFAQ TRADERS",
      phone: "+91 98765 43210",
      address: "Main Fruit Mandi, Sopore",
      opening_balance: 5000,
    },
    {
      id: "d2",
      name: "Kashmir Agro Foods",
      phone: "+91 91234 56789",
      address: "Industrial Estate, Lassipora",
      opening_balance: 0,
    },
  ]

  const mockPurchases = [
    {
      id: "purch-1",
      dealer_id: "d1",
      product_id: "prod-1",
      purchase_date: "2026-10-10",
      quantity_bought: 300,
      buying_rate: 60,
      total_amount: 18000,
      amount_paid: 3000, // 3000 downpayment
      balance: 15000,
      reference: "INV-101",
      dealer: { id: "d1", name: "AL INFAQ TRADERS" },
      product: { id: "prod-1", name: "Apple Juice 1L", unit: "bottles" },
    },
    {
      id: "purch-2",
      dealer_id: "d2",
      product_id: "prod-2",
      purchase_date: "2026-10-11",
      quantity_bought: 100,
      buying_rate: 50,
      total_amount: 5000,
      amount_paid: 1000,
      balance: 4000,
      reference: "INV-102",
      dealer: { id: "d2", name: "Kashmir Agro Foods" },
      product: { id: "prod-2", name: "Apple Cider 500ml", unit: "bottles" },
    },
  ]

  const mockPayments = [
    {
      id: "pay-1",
      dealer_id: "d1",
      payment_date: "2026-10-12",
      amount: 10000,
      payment_method: "BANK_TRANSFER",
      reference: "NEFT-10000",
      notes: "Part payment against opening and stock",
      dealer: { id: "d1", name: "AL INFAQ TRADERS" },
    },
    {
      id: "pay-2",
      dealer_id: "d2",
      payment_date: "2026-10-14",
      amount: 4000,
      payment_method: "CASH",
      reference: "CASH-4000",
      notes: "Cleared balance",
      dealer: { id: "d2", name: "Kashmir Agro Foods" },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    ;(getDealers as any).mockResolvedValue(mockDealers)
    ;(getPurchases as any).mockResolvedValue(mockPurchases)
    ;(getDealerPayments as any).mockResolvedValue(mockPayments)
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DealerPaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("renders page header, global AP summary cards, neutral prompt, and payments table", async () => {
    renderComponent()

    expect(await screen.findByText("Dealer Payments")).toBeDefined()
    expect(screen.getByText("ACCOUNTS PAYABLE")).toBeDefined()
    expect(screen.getByText("Record Dealer Payment")).toBeDefined()
    expect(screen.getByText("Payment History")).toBeDefined()

    // Global figures:
    // Total Purchases = 18000 + 5000 = 23000
    // Total Paid = (3000 + 1000) at purchase + (10000 + 4000) standalone = 18000
    // Total Opening = 5000 + 0 = 5000
    // Net Outstanding = 5000 + 23000 - 18000 = 10000
    await waitFor(() => {
      expect(screen.getByText("2 Active Suppliers")).toBeDefined()
      expect(screen.getAllByText(formatMoney(23000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(18000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(10000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Accounts Payable")).toBeDefined()
    })

    // Neutral instruction banner is displayed initially
    expect(
      screen.getByText(/Select a dealer to inspect supplier ledger, outstanding payable balance/i)
    ).toBeDefined()

    // Table displays existing payment rows (both desktop and mobile card view rendered)
    expect(screen.getAllByText("NEFT-10000").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("CASH-4000").length).toBeGreaterThanOrEqual(1)
  })

  it("automatically fetches and displays dealer financial ledger when Dealer A is selected", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("2 Active Suppliers")).toBeDefined()
    })

    // Target the dealer select element and select Dealer A ("d1" AL INFAQ TRADERS)
    const dealerSelect = screen.getByDisplayValue("Select Dealer")
    fireEvent.change(dealerSelect, { target: { value: "d1" } })

    // Contextual supplier summary appears
    await waitFor(() => {
      expect(screen.getByText("Main Fruit Mandi, Sopore")).toBeDefined()
      expect(screen.getByText("+91 98765 43210")).toBeDefined()
      expect(screen.getByText("View Supplier Profile")).toBeDefined()
    })

    // Dealer A financials:
    // Opening balance: 5000
    // Purchases total: 18000
    // Direct paid: 3000, Standalone paid: 10000 -> Total paid: 13000
    // Net Outstanding: 5000 + 18000 - 13000 = 10000
    await waitFor(() => {
      expect(screen.getAllByText("Total Purchases").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(18000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(13000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(10000)).length).toBeGreaterThanOrEqual(1)
    })

    // Quick action button "Pay Full (₹10,000.00)" appears
    expect(screen.getByText(/Pay Full \(.*10,000/i)).toBeDefined()

    // Open invoices breakdown button appears
    expect(screen.getByText(/View 1 Open Invoice/i)).toBeDefined()
  })

  it("switches cleanly to Dealer B without stale data from Dealer A", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("2 Active Suppliers")).toBeDefined()
    })

    const dealerSelect = screen.getByDisplayValue("Select Dealer")
    // Select Dealer A first
    fireEvent.change(dealerSelect, { target: { value: "d1" } })

    await waitFor(() => {
      expect(screen.getByText("Main Fruit Mandi, Sopore")).toBeDefined()
    })

    // Switch to Dealer B ("d2" Kashmir Agro Foods)
    fireEvent.change(dealerSelect, { target: { value: "d2" } })

    await waitFor(() => {
      expect(screen.getByText("Industrial Estate, Lassipora")).toBeDefined()
      expect(screen.queryByText("Main Fruit Mandi, Sopore")).toBeNull()
    })

    // Dealer B financials:
    // Opening balance: 0
    // Purchases: 5000 (1000 downpayment)
    // Standalone payment: 4000
    // Total Paid: 1000 + 4000 = 5000
    // Outstanding: 5000 - 5000 = 0 (Settled!)
    await waitFor(() => {
      expect(screen.getAllByText("Account Settled").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(5000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(0)).length).toBeGreaterThanOrEqual(1)
    })
  })

  it("calculates live projected balance and warns when payment amount exceeds outstanding", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("2 Active Suppliers")).toBeDefined()
    })

    // Select Dealer A ("d1", outstanding = 10000)
    const dealerSelect = screen.getByDisplayValue("Select Dealer")
    fireEvent.change(dealerSelect, { target: { value: "d1" } })

    const amountInput = screen.getByPlaceholderText("0.00")

    // Enter partial payment 4000 -> Projected balance should be 6000
    fireEvent.change(amountInput, { target: { value: "4000" } })

    await waitFor(() => {
      expect(screen.getAllByText(formatMoney(6000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Remaining Due")).toBeDefined()
    })

    // Click "Pay Full" button -> sets amount to 10000 -> Projected balance 0 (Settled)
    const payFullBtn = screen.getByText(/Pay Full \(.*10,000/i)
    fireEvent.click(payFullBtn)

    await waitFor(() => {
      expect((amountInput as HTMLInputElement).value).toBe("10000.00")
      expect(screen.getAllByText(formatMoney(0)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Settled")).toBeDefined()
    })

    // Enter overpayment 12000 (exceeds 10000 by 2000)
    fireEvent.change(amountInput, { target: { value: "12000" } })

    await waitFor(() => {
      // Advance warning appears
      expect(screen.getByText(/exceeds the outstanding balance/i)).toBeDefined()
      expect(screen.getByText(/advance credit of/i)).toBeDefined()
      expect(screen.getByText("Advance")).toBeDefined()
    })
  })

  it("validates form fields and submits a valid payment transaction", async () => {
    ;(createDealerPayment as any).mockResolvedValue({
      id: "pay-new",
      dealer_id: "d1",
      payment_date: "2026-10-15",
      amount: 5000,
      payment_method: "BANK_TRANSFER",
      reference: "UTR-5500",
      notes: "Stock payment",
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("2 Active Suppliers")).toBeDefined()
    })

    const submitBtn = screen.getByRole("button", { name: /Record Payment/i }) as HTMLButtonElement

    // Initially disabled because no dealer and amount
    expect(submitBtn.disabled).toBe(true)

    // Select dealer "d1"
    const dealerSelect = screen.getByDisplayValue("Select Dealer")
    fireEvent.change(dealerSelect, { target: { value: "d1" } })

    // Fill valid amount
    const amountInput = screen.getByPlaceholderText("0.00")
    fireEvent.change(amountInput, { target: { value: "5000" } })

    // Fill reference
    const refInput = screen.getByPlaceholderText(/e\.g\. UTR \/ Cheque #/i)
    fireEvent.change(refInput, { target: { value: "UTR-5500" } })

    // Button should now be enabled
    expect(submitBtn.disabled).toBe(false)

    // Submit form
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createDealerPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          dealer_id: "d1",
          amount: 5000,
          payment_method: "CASH",
          reference: "UTR-5500",
        })
      )
    })
  })

  it("supports editing a payment and toggling dealer-specific table filter", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("NEFT-10000").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("CASH-4000").length).toBeGreaterThanOrEqual(1)
    })

    // Click edit on the first payment
    const editBtns = screen.getAllByRole("button", { name: /Edit payment/i })
    fireEvent.click(editBtns[0])

    // Header updates to "Edit Dealer Payment" and cancel button appears
    expect(screen.getByText("Edit Dealer Payment")).toBeDefined()
    expect(screen.getByText("Cancel Edit")).toBeDefined()

    // Form inputs prefilled
    const amountInput = screen.getByPlaceholderText("0.00") as HTMLInputElement
    expect(amountInput.value).toBe("10000")

    // Filter to selected dealer button appears in table toolbar
    const filterBtn = screen.getByRole("button", { name: /Filter to AL INFAQ TRADERS/i })
    fireEvent.click(filterBtn)

    // Now only NEFT-10000 is visible; CASH-4000 (Dealer B) is filtered out
    expect(screen.getAllByText("NEFT-10000").length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText("CASH-4000")).toBeNull()

    // Restore all payments
    const showAllBtn = screen.getByRole("button", { name: /Show All Payments/i })
    fireEvent.click(showAllBtn)
    expect(screen.getAllByText("CASH-4000").length).toBeGreaterThanOrEqual(1)
  })

  it("opens delete confirmation modal and calls deleteDealerPayment on confirm", async () => {
    ;(deleteDealerPayment as any).mockResolvedValue(undefined)

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("NEFT-10000").length).toBeGreaterThanOrEqual(1)
    })

    const deleteBtns = screen.getAllByRole("button", { name: /Delete payment/i })
    fireEvent.click(deleteBtns[0])

    // Confirmation dialog appears
    expect(screen.getByRole("dialog")).toBeDefined()
    expect(
      screen.getByText(/Are you sure you want to delete this payment record\? This will increase the dealer's outstanding balance\./i)
    ).toBeDefined()

    // Click confirm Delete Payment
    const confirmDeleteBtn = screen.getByRole("button", { name: "Delete Payment" })
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(deleteDealerPayment).toHaveBeenCalledWith("pay-1")
    })
  })
})
