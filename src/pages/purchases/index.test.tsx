import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PurchasesPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { getPurchases } from "@/services/purchases"
import { getDealers } from "@/services/dealers"
import { getProducts } from "@/services/products"
import { getDealerPayments } from "@/services/dealerPayments"
import { formatMoney } from "@/lib/utils"

vi.mock("@/services/purchases", () => ({
  getPurchases: vi.fn(),
  createPurchase: vi.fn(),
  updatePurchase: vi.fn(),
  deletePurchase: vi.fn(),
}))

vi.mock("@/services/dealers", () => ({
  getDealers: vi.fn(),
}))

vi.mock("@/services/products", () => ({
  getProducts: vi.fn(),
}))

vi.mock("@/services/dealerPayments", () => ({
  getDealerPayments: vi.fn(),
}))

describe("PurchasesPage Reconciled Accounting & Summary", () => {
  let queryClient: QueryClient

  const mockDealers = [
    {
      id: "d1",
      name: "AL INFAQ TRADERS",
      phone: "+91 98765 43210",
      address: "Main Fruit Mandi, Sopore",
      opening_balance: 0,
    },
    {
      id: "d2",
      name: "Kashmir Agro Foods",
      phone: "+91 91234 56789",
      address: "Industrial Estate, Lassipora",
      opening_balance: 0,
    },
  ]

  const mockProducts = [
    { id: "prod-1", name: "Apple Juice 1L", dealer_id: "d1", buying_cost: 65, unit: "bottles" },
    { id: "prod-2", name: "Apple Cider 500ml", dealer_id: "d2", buying_cost: 50, unit: "bottles" },
  ]

  const mockPurchases = [
    {
      id: "purch-1",
      dealer_id: "d1",
      product_id: "prod-1",
      purchase_date: "2026-10-10",
      quantity_bought: 358,
      buying_rate: 65,
      total_amount: 23300,
      amount_paid: 0,
      balance: 23300,
      reference: "INV-1001",
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
      reference: "INV-1002",
      dealer: { id: "d2", name: "Kashmir Agro Foods" },
      product: { id: "prod-2", name: "Apple Cider 500ml", unit: "bottles" },
    },
  ]

  const mockPayments = [
    {
      id: "pay-1",
      dealer_id: "d1",
      payment_date: "2026-10-12",
      amount: 23300,
      reference: "DISB-23300",
      payment_method: "BANK_TRANSFER",
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
    ;(getProducts as any).mockResolvedValue(mockProducts)
    ;(getPurchases as any).mockResolvedValue(mockPurchases)
    ;(getDealerPayments as any).mockResolvedValue(mockPayments)
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PurchasesPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("reconciles standalone dealer payments and displays accurate balance in the purchases table", async () => {
    renderComponent()

    expect(await screen.findByText("Purchases")).toBeDefined()
    expect(screen.getByText("Purchase History")).toBeDefined()

    await waitFor(() => {
      expect(screen.getAllByText(formatMoney(23300)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(0)).length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText(formatMoney(4000)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(formatMoney(1000)).length).toBeGreaterThanOrEqual(1)
  })

  it("renders the 4 responsive financial summary cards with accurate cumulative metrics", async () => {
    renderComponent()

    expect(await screen.findByText("Purchases")).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases")).toBeDefined()
      expect(screen.getByText("Total Paid")).toBeDefined()
      expect(screen.getAllByText("Balance Payable").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Dealers & Suppliers")).toBeDefined()

      expect(screen.getAllByText(formatMoney(28300)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(24300)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(formatMoney(4000)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("2 Registered")).toBeDefined()
      expect(screen.getByText("Partially Paid")).toBeDefined()
    })
  })

  it("displays neutral instruction when no dealer is selected, and reveals contextual dealer summary upon selection", async () => {
    renderComponent()

    expect(await screen.findByText("Purchases")).toBeDefined()

    // Initially, neutral instruction is visible
    expect(
      screen.getByText(/Select a dealer to view supplier details, contact information, and outstanding balance/i)
    ).toBeDefined()

    // Wait until dealers data finishes loading
    await waitFor(() => {
      expect(screen.getByText("2 Registered")).toBeDefined()
    })

    // Target the dealer select element and select "d1"
    const dealerSelect = screen.getByDisplayValue("Select Dealer")
    fireEvent.change(dealerSelect, { target: { value: "d1" } })

    // Now contextual dealer summary is displayed
    await waitFor(() => {
      expect(screen.getByText("Main Fruit Mandi, Sopore")).toBeDefined()
      expect(screen.getByText("+91 98765 43210")).toBeDefined()
      expect(screen.getByText("Account Settled")).toBeDefined()
      expect(screen.getByText("View Supplier Profile")).toBeDefined()
    })

    // Card 4 should now reflect the selected dealer
    expect(screen.getByText("Selected Dealer")).toBeDefined()
    expect(screen.getAllByText("AL INFAQ TRADERS").length).toBeGreaterThanOrEqual(2)
  })

  it("dynamically calculates purchase preview and validates that paid amount cannot exceed total purchase", async () => {
    renderComponent()

    expect(await screen.findByText("Purchases")).toBeDefined()

    // Wait until dealers and products data finish loading
    await waitFor(() => {
      expect(screen.getByText("2 Registered")).toBeDefined()
    })

    // Select dealer "d1"
    const dealerSelect = screen.getByDisplayValue("Select Dealer")
    fireEvent.change(dealerSelect, { target: { value: "d1" } })

    // Wait for product select to enable with dealer products
    await waitFor(() => {
      expect(screen.getByDisplayValue("Select Product")).toBeDefined()
    })

    // Select product "prod-1"
    const productSelect = screen.getByDisplayValue("Select Product")
    fireEvent.change(productSelect, { target: { value: "prod-1" } })

    // Inputs: [quantity, buyingRate, amountPaid]
    const inputs = screen.getAllByPlaceholderText("0.00")
    const quantityInput = inputs[0]
    const amountPaidInput = inputs[2]

    // Set quantity = 10 (buying rate is auto-filled to 65) -> totalAmount = 650, balance = 650
    fireEvent.change(quantityInput, { target: { value: "10" } })

    await waitFor(() => {
      expect(screen.getAllByText(formatMoney(650)).length).toBeGreaterThanOrEqual(1)
    })

    // Enter paid = 200 -> balance should be 450
    fireEvent.change(amountPaidInput, { target: { value: "200" } })

    await waitFor(() => {
      expect(screen.getAllByText(formatMoney(450)).length).toBeGreaterThanOrEqual(1)
    })

    // Now enter paid = 700 (which exceeds total 650) -> should show validation error
    fireEvent.change(amountPaidInput, { target: { value: "700" } })

    await waitFor(() => {
      expect(
        screen.getByText(/Amount paid .* cannot exceed total purchase amount/i)
      ).toBeDefined()
    })

    // Submit button should be disabled
    const submitBtn = screen.getByRole("button", { name: /Record Purchase/i }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)

    // Fix paid = 100 -> valid again, button enabled
    fireEvent.change(amountPaidInput, { target: { value: "100" } })

    await waitFor(() => {
      expect(
        screen.queryByText(/Amount paid .* cannot exceed total purchase amount/i)
      ).toBeNull()
      expect(submitBtn.disabled).toBe(false)
    })
  })

  it("handles empty purchases gracefully displaying valid zero summary states", async () => {
    ;(getPurchases as any).mockResolvedValue([])
    ;(getDealerPayments as any).mockResolvedValue([])

    renderComponent()

    expect(await screen.findByText("Purchases")).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases")).toBeDefined()
      expect(screen.getByText("Settled")).toBeDefined()
      expect(screen.getAllByText(formatMoney(0)).length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText("No purchases found").length).toBeGreaterThanOrEqual(1)
    })
  })
})
