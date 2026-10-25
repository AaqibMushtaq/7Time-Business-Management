import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import DealerDetailPage from "./DealerDetailPage"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { updateDealer } from "@/services/dealers"
import { createPurchase } from "@/services/purchases"
import { createProduct } from "@/services/products"
import { createDealerPayment } from "@/services/dealerPayments"
import { formatMoney } from "@/lib/utils"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  }
}))

vi.mock("@/services/dealers", () => ({
  updateDealer: vi.fn(),
}))

vi.mock("@/services/purchases", () => ({
  createPurchase: vi.fn(),
}))

vi.mock("@/services/products", () => ({
  createProduct: vi.fn(),
}))

vi.mock("@/services/dealerPayments", () => ({
  createDealerPayment: vi.fn(),
}))

describe("DealerDetailPage Component", () => {
  let queryClient: QueryClient

  const mockDealer = {
    id: "dealer-1",
    name: "Al Infaq Traders",
    phone: "+91 99060 11223",
    whatsapp: "+91 99060 11223",
    address: "Main Market, Pulwama, Kashmir",
    notes: "Primary beverage supplier Net 15",
    opening_balance: 1000,
    created_at: "2026-01-01T00:00:00Z"
  }

  const mockProducts = [
    {
      id: "prod-1",
      dealer_id: "dealer-1",
      name: "Apple Juice 1L",
      unit: "bottles",
      stock_quantity: 150,
      buying_cost: 65,
      retail_price: 90,
      category: "Beverages"
    },
    {
      id: "prod-2",
      dealer_id: "dealer-1",
      name: "Mango Nectar 500ml",
      unit: "cans",
      stock_quantity: 80,
      buying_cost: 40,
      retail_price: 55,
      category: "Beverages"
    }
  ]

  const mockPurchases = [
    {
      id: "purch-1",
      dealer_id: "dealer-1",
      purchase_date: "2026-10-15",
      product_id: "prod-1",
      quantity_bought: 100,
      buying_rate: 65,
      total_amount: 6500,
      amount_paid: 2000,
      balance: 4500,
      reference: "INV-9901",
      notes: "First batch",
      product: { name: "Apple Juice 1L", unit: "bottles" }
    },
    {
      id: "purch-2",
      dealer_id: "dealer-1",
      purchase_date: "2026-10-18",
      product_id: "prod-2",
      quantity_bought: 50,
      buying_rate: 40,
      total_amount: 2000,
      amount_paid: 2000,
      balance: 0,
      reference: "INV-9902",
      notes: "Fully paid restock",
      product: { name: "Mango Nectar 500ml", unit: "cans" }
    }
  ]

  const mockPayments = [
    {
      id: "pay-1",
      dealer_id: "dealer-1",
      payment_date: "2026-10-20",
      amount: 1500,
      payment_method: "BANK_TRANSFER",
      reference: "UTR-882200",
      notes: "Bank settlement towards balance"
    }
  ]

  const setupSupabaseMock = (dealerData: any = mockDealer) => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: dealerData,
                error: dealerData ? null : { message: "Not found" }
              })
            })
          })
        }
      }
      if (table === "products") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
            }),
            order: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
          })
        }
      }
      if (table === "purchases") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockPurchases, error: null })
              })
            })
          })
        }
      }
      if (table === "dealer_payments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockPayments, error: null })
              })
            })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    setupSupabaseMock()
  })

  const renderComponent = (dealerId = "dealer-1") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/dealers/${dealerId}`]}>
          <Routes>
            <Route path="/dealers/:id" element={<DealerDetailPage />} />
            <Route path="/dealers" element={<div>Dealers Listing Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("renders dealer header, breadcrumbs, contact information, and avatar initials", async () => {
    renderComponent()

    // Dealer name in heading
    expect(await screen.findByRole("heading", { name: "Al Infaq Traders" })).toBeDefined()

    // Breadcrumbs
    expect(screen.getByText("Business")).toBeDefined()
    expect(screen.getByText("Dealers")).toBeDefined()

    // Avatar initials
    expect(screen.getByText("AL")).toBeDefined()

    // Contact details
    expect(screen.getByText("+91 99060 11223")).toBeDefined()
    expect(screen.getAllByText("Main Market, Pulwama, Kashmir").length).toBeGreaterThanOrEqual(1)
  })

  it("renders financial summary cards with authoritative balance calculation", async () => {
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Total Purchases = 6500 + 2000 = 8500
    // Total Paid = 2000 + 2000 + 1500 = 5500
    // Outstanding Balance = Opening (1000) + 8500 - 5500 = 4000 (> 0: We Owe Dealer)
    expect(screen.getByText(formatMoney(8500))).toBeDefined()
    expect(screen.getByText(formatMoney(5500))).toBeDefined()
    expect(screen.getByText(formatMoney(4000))).toBeDefined()
    expect(screen.getByText("We Owe Dealer")).toBeDefined()
    expect(screen.getByText(`(Op: ${formatMoney(1000)})`)).toBeDefined()
  })

  it("renders Overview tab with Associated Products table using DataTable", async () => {
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Products table header and rows
    expect(screen.getByText("Associated Products")).toBeDefined()
    expect(screen.getAllByText("Apple Juice 1L").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Mango Nectar 500ml").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/150/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/bottles/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/80/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/cans/).length).toBeGreaterThan(0)
  })

  it("switches to Purchases tab and displays purchase orders in DataTable", async () => {
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Click Purchases tab
    const purchasesTab = screen.getByRole("tab", { name: /purchases/i })
    fireEvent.click(purchasesTab)

    expect(await screen.findByText("Purchase History")).toBeDefined()
    expect(screen.getAllByText("Ref: INV-9901").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Ref: INV-9902").length).toBeGreaterThan(0)
    expect(screen.getAllByText(formatMoney(6500)).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Partial").length).toBeGreaterThan(0)
  })

  it("renders mobile structured purchase cards with Date, Status, Product, Total Amount, and Balance", async () => {
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Click Purchases tab
    const purchasesTab = screen.getByRole("tab", { name: /purchases/i })
    fireEvent.click(purchasesTab)

    expect(await screen.findByText("Purchase History")).toBeDefined()

    // Mobile purchase card for purch-1
    const card1 = await screen.findByTestId("mobile-card-purch-1")
    expect(card1).toBeDefined()

    // Verify key field labels in card 1
    expect(within(card1).getByText("Date")).toBeDefined()
    expect(within(card1).getByText("Status")).toBeDefined()
    expect(within(card1).getByText("Product / Restock")).toBeDefined()
    expect(within(card1).getByText("Total Amount")).toBeDefined()
    expect(within(card1).getByText("Balance")).toBeDefined()

    // Verify content in card 1 (Partially paid)
    expect(within(card1).getByText("Ref: INV-9901")).toBeDefined()
    expect(within(card1).getByText("Apple Juice 1L")).toBeDefined()
    expect(within(card1).getByText(formatMoney(6500))).toBeDefined()
    expect(within(card1).getByText("Partial")).toBeDefined()
    expect(within(card1).getByText(/Paid:/)).toBeDefined()
    expect(within(card1).getByText(formatMoney(4000))).toBeDefined()

    // Mobile purchase card for purch-2 (Fully Paid)
    const card2 = screen.getByTestId("mobile-card-purch-2")
    expect(within(card2).getByText("Paid")).toBeDefined()
    expect(within(card2).getByText("Mango Nectar 500ml")).toBeDefined()
    expect(within(card2).getByText(formatMoney(2000))).toBeDefined()
  })

  it("switches to Payments tab and displays payment settlements in DataTable", async () => {
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Click Payments tab
    const paymentsTab = screen.getByRole("tab", { name: /payments/i })
    fireEvent.click(paymentsTab)

    expect(await screen.findByText("Payment Settlements")).toBeDefined()
    expect(screen.getAllByText("BANK_TRANSFER").length).toBeGreaterThan(0)
    expect(screen.getAllByText("UTR-882200").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bank settlement towards balance").length).toBeGreaterThan(0)
  })

  it("opens Edit Dealer modal and submits update", async () => {
    ;(updateDealer as any).mockResolvedValue(mockDealer)
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Edit Dealer modal
    const editBtn = screen.getByRole("button", { name: /edit dealer/i })
    fireEvent.click(editBtn)

    expect(screen.getByText("Edit Dealer Information")).toBeDefined()
    const nameInput = screen.getByPlaceholderText("e.g. Al Infaq Traders")
    fireEvent.change(nameInput, { target: { value: "Al Infaq Mega Wholesale" } })

    const saveBtn = screen.getByRole("button", { name: /save changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateDealer).toHaveBeenCalledWith("dealer-1", expect.objectContaining({
        name: "Al Infaq Mega Wholesale"
      }))
    })
  })

  it("opens Add Purchase modal and records stock purchase", async () => {
    ;(createPurchase as any).mockResolvedValue({ id: "purch-new" })
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Add Purchase modal
    const addPurchaseBtn = screen.getByRole("button", { name: /add purchase/i })
    fireEvent.click(addPurchaseBtn)

    expect(screen.getByText("Record Stock Purchase")).toBeDefined()

    const productSelect = screen.getByRole("combobox")
    fireEvent.change(productSelect, { target: { value: "prod-1" } })

    const qtyInput = screen.getByPlaceholderText("0")
    fireEvent.change(qtyInput, { target: { value: "25" } })

    const rateInput = screen.getByPlaceholderText("0.00")
    fireEvent.change(rateInput, { target: { value: "60" } })

    const saveBtn = screen.getByRole("button", { name: /save purchase/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(createPurchase).toHaveBeenCalledWith(expect.objectContaining({
        dealer_id: "dealer-1",
        product_id: "prod-1",
        quantity_bought: 25,
        buying_rate: 60,
        total_amount: 1500
      }))
    })
  })

  it("allows creating a new product from Add Purchase modal, automatically selects it, and saves purchase", async () => {
    const mockNewProduct = {
      id: "prod-new-1",
      dealer_id: "dealer-1",
      name: "Saffron Syrup 500ml",
      unit: "Bottle",
      buying_cost: 150,
      wholesale_price: 200,
      retail_price: 250,
      stock_quantity: 0
    }
    ;(createProduct as any).mockResolvedValue(mockNewProduct)
    ;(createPurchase as any).mockResolvedValue({ id: "purch-new-1" })

    renderComponent()
    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Add Purchase modal
    const addPurchaseBtn = screen.getByRole("button", { name: /add purchase/i })
    fireEvent.click(addPurchaseBtn)
    expect(screen.getByText("Record Stock Purchase")).toBeDefined()

    // Switch to Add New Product
    const addNewProductBtn = screen.getByRole("button", { name: /add new product/i })
    fireEvent.click(addNewProductBtn)

    expect(screen.getByText("New Product Form")).toBeDefined()

    // Fill in product details
    const nameInput = screen.getByLabelText("New Product Name")
    fireEvent.change(nameInput, { target: { value: "Saffron Syrup 500ml" } })

    const unitSelect = screen.getByLabelText("Measurement Unit")
    fireEvent.change(unitSelect, { target: { value: "Bottle" } })

    const costInput = screen.getByLabelText("New Product Buying Cost")
    fireEvent.change(costInput, { target: { value: "150" } })

    const wholesaleInput = screen.getByLabelText("New Product Wholesale Price")
    fireEvent.change(wholesaleInput, { target: { value: "200" } })

    const retailInput = screen.getByLabelText("New Product Retail Price")
    fireEvent.change(retailInput, { target: { value: "250" } })

    // Click "Save & Select Product"
    const saveProductBtn = screen.getByRole("button", { name: /save & select product/i })
    fireEvent.click(saveProductBtn)

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith({
        dealer_id: "dealer-1",
        name: "Saffron Syrup 500ml",
        unit: "Bottle",
        buying_cost: 150,
        wholesale_price: 200,
        retail_price: 250,
        stock_quantity: 0
      })
    })

    // Verify product is now selected in existing product selector
    await waitFor(() => {
      const productSelect = screen.getByRole("combobox", { name: /product/i }) as HTMLSelectElement
      expect(productSelect.value).toBe("prod-new-1")
    })

    // Buying rate should be pre-populated with 150
    const rateInput = screen.getByPlaceholderText("0.00") as HTMLInputElement
    expect(rateInput.value).toBe("150")

    // Enter purchase quantity and payment
    const qtyInput = screen.getByPlaceholderText("0")
    fireEvent.change(qtyInput, { target: { value: "10" } })

    const amountPaidInput = screen.getByPlaceholderText(/0\.00 \(optional down payment\)/i)
    fireEvent.change(amountPaidInput, { target: { value: "500" } })

    // Total: 10 * 150 = 1500, Balance: 1500 - 500 = 1000
    expect(screen.getByText(formatMoney(1500))).toBeDefined()
    expect(screen.getByText(formatMoney(1000))).toBeDefined()

    // Save purchase
    const savePurchaseBtn = screen.getByRole("button", { name: /save purchase/i })
    fireEvent.click(savePurchaseBtn)

    await waitFor(() => {
      expect(createPurchase).toHaveBeenCalledWith(expect.objectContaining({
        dealer_id: "dealer-1",
        product_id: "prod-new-1",
        quantity_bought: 10,
        buying_rate: 150,
        total_amount: 1500,
        amount_paid: 500,
        balance: 1000
      }))
    })
  })

  it("validates required fields, non-negative numbers, and duplicates when creating product", async () => {
    renderComponent()
    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Add Purchase modal
    fireEvent.click(screen.getByRole("button", { name: /add purchase/i }))

    // Switch to Add New Product
    fireEvent.click(screen.getByRole("button", { name: /add new product/i }))

    // 1. Try to save without name
    fireEvent.click(screen.getByRole("button", { name: /save & select product/i }))
    expect(screen.getByText("Product name is required.")).toBeDefined()
    expect(createProduct).not.toHaveBeenCalled()

    // 2. Duplicate product name check (mockProducts has "Apple Juice 1L")
    const nameInput = screen.getByLabelText("New Product Name")
    fireEvent.change(nameInput, { target: { value: "apple juice 1l" } })
    fireEvent.click(screen.getByRole("button", { name: /save & select product/i }))
    expect(screen.getByText(/already exists for this supplier/i)).toBeDefined()
    expect(createProduct).not.toHaveBeenCalled()

    // 3. Negative price check
    fireEvent.change(nameInput, { target: { value: "Organic Honey" } })
    const costInput = screen.getByLabelText("New Product Buying Cost")
    fireEvent.change(costInput, { target: { value: "-20" } })
    fireEvent.click(screen.getByRole("button", { name: /save & select product/i }))
    expect(screen.getByText("Buying cost must be zero or a positive amount.")).toBeDefined()
    expect(createProduct).not.toHaveBeenCalled()
  })

  it("handles failed purchase save after product creation without creating duplicate products", async () => {
    const mockNewProduct = {
      id: "prod-fail-test",
      dealer_id: "dealer-1",
      name: "Special Tea",
      unit: "Box",
      buying_cost: 100,
      wholesale_price: 120,
      retail_price: 150,
      stock_quantity: 0
    }
    ;(createProduct as any).mockResolvedValue(mockNewProduct)
    ;(createPurchase as any).mockRejectedValueOnce(new Error("Supabase purchase insert failed"))

    renderComponent()
    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Add Purchase modal
    fireEvent.click(screen.getByRole("button", { name: /add purchase/i }))

    // Switch to Add New Product
    fireEvent.click(screen.getByRole("button", { name: /add new product/i }))

    // Fill in product details
    fireEvent.change(screen.getByLabelText("New Product Name"), { target: { value: "Special Tea" } })
    fireEvent.change(screen.getByLabelText("New Product Buying Cost"), { target: { value: "100" } })

    // Click "Save & Select Product"
    fireEvent.click(screen.getByRole("button", { name: /save & select product/i }))

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledTimes(1)
    })

    // Now product is selected, fill purchase details
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "5" } })

    // Submit purchase - which fails
    fireEvent.click(screen.getByRole("button", { name: /save purchase/i }))

    // Error message should clearly communicate that product was saved, but purchase failed
    await screen.findByText(/Product was saved, but recording the purchase failed/i)

    // Now mock purchase success for retry
    ;(createPurchase as any).mockResolvedValueOnce({ id: "purch-retry-success" })

    // User retries clicking Save Purchase
    fireEvent.click(screen.getByRole("button", { name: /save purchase/i }))

    await waitFor(() => {
      expect(createPurchase).toHaveBeenCalledTimes(2)
      // IMPORTANT: createProduct MUST NOT have been called a second time
      expect(createProduct).toHaveBeenCalledTimes(1)
    })
  })

  it("supports direct purchase submission while in new product mode", async () => {
    const mockNewProduct = {
      id: "prod-direct-1",
      dealer_id: "dealer-1",
      name: "Walnut Kernels 250g",
      unit: "Pkt",
      buying_cost: 300,
      wholesale_price: 350,
      retail_price: 400,
      stock_quantity: 0
    }
    ;(createProduct as any).mockResolvedValue(mockNewProduct)
    ;(createPurchase as any).mockResolvedValue({ id: "purch-direct-1" })

    renderComponent()
    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Add Purchase modal
    fireEvent.click(screen.getByRole("button", { name: /add purchase/i }))

    // Switch to Add New Product
    fireEvent.click(screen.getByRole("button", { name: /add new product/i }))

    // Fill new product form
    fireEvent.change(screen.getByLabelText("New Product Name"), { target: { value: "Walnut Kernels 250g" } })
    fireEvent.change(screen.getByLabelText("Measurement Unit"), { target: { value: "Pkt" } })
    fireEvent.change(screen.getByLabelText("New Product Buying Cost"), { target: { value: "300" } })

    // Also fill purchase form fields directly
    fireEvent.change(screen.getByLabelText("Quantity Bought"), { target: { value: "20" } })
    fireEvent.change(screen.getByLabelText("Buying Rate"), { target: { value: "300" } })

    // Click "Save Purchase" directly without separate "Save & Select Product"
    fireEvent.click(screen.getByRole("button", { name: /save purchase/i }))

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({
        name: "Walnut Kernels 250g",
        unit: "Pkt",
        buying_cost: 300
      }))
      expect(createPurchase).toHaveBeenCalledWith(expect.objectContaining({
        dealer_id: "dealer-1",
        product_id: "prod-direct-1",
        quantity_bought: 20,
        buying_rate: 300,
        total_amount: 6000
      }))
    })
  })

  it("opens Record Payment modal and records dealer payment", async () => {
    ;(createDealerPayment as any).mockResolvedValue({ id: "pay-new" })
    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Open Record Payment modal
    const recordPayBtn = screen.getByRole("button", { name: /record payment/i })
    fireEvent.click(recordPayBtn)

    expect(screen.getByText("Record Payment to Dealer")).toBeDefined()

    const amountInput = screen.getByPlaceholderText("0.00")
    fireEvent.change(amountInput, { target: { value: "3500" } })

    const refInput = screen.getByPlaceholderText(/e\.g\. UTR/i)
    fireEvent.change(refInput, { target: { value: "UTR-554433" } })

    const submitBtn = screen.getByRole("button", { name: /confirm payment/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createDealerPayment).toHaveBeenCalledWith(expect.objectContaining({
        dealer_id: "dealer-1",
        amount: 3500,
        reference: "UTR-554433"
      }))
    })
  })

  it("handles Call, WhatsApp, and Directions shortcuts", async () => {
    const originalOpen = window.open
    window.open = vi.fn()

    renderComponent()

    await screen.findByRole("heading", { name: "Al Infaq Traders" })

    // Call shortcut
    const callBtn = screen.getByLabelText("Call Al Infaq Traders")
    fireEvent.click(callBtn)
    expect(window.open).toHaveBeenCalledWith("tel:+919906011223")

    // WhatsApp shortcut
    const waBtn = screen.getByLabelText("WhatsApp Al Infaq Traders")
    fireEvent.click(waBtn)
    expect(window.open).toHaveBeenCalledWith(
      "https://wa.me/919906011223",
      "_blank",
      "noopener,noreferrer"
    )

    // Directions shortcut
    const dirBtn = screen.getByLabelText("Directions to Al Infaq Traders")
    fireEvent.click(dirBtn)
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://maps.google.com/?q="),
      "_blank",
      "noopener,noreferrer"
    )

    window.open = originalOpen
  })

  it("renders not-found empty state when dealer does not exist", async () => {
    setupSupabaseMock(null)
    renderComponent("invalid-dealer-id")

    expect(await screen.findByText("Dealer not found")).toBeDefined()
    expect(screen.getByText("The dealer you are looking for does not exist or may have been deleted.")).toBeDefined()
    expect(screen.getByRole("button", { name: /back to dealers/i })).toBeDefined()
  })

  it("bugfix regression: purchases show PAID when covered by standalone dealer payments even if amount_paid was 0 (AL INFAQ TRADERS scenario)", async () => {
    const alInfaqDealer = {
      id: "dealer-al-infaq",
      name: "AL INFAQ TRADERS",
      opening_balance: 0,
      phone: "+91 99060 00000",
      whatsapp: null,
      address: "Main Market",
      notes: null,
      created_at: "2026-01-01T00:00:00Z"
    }

    const alInfaqPurchases = [
      {
        id: "purch-al-1",
        dealer_id: "dealer-al-infaq",
        purchase_date: "2026-10-10",
        product_id: "prod-1",
        quantity_bought: 358,
        buying_rate: 65,
        total_amount: 23300,
        amount_paid: 0, // initially 0 paid at purchase creation
        balance: 23300,
        reference: "INV-AL-001",
        notes: null,
        product: { name: "Apple Juice 1L", unit: "bottles" }
      }
    ]

    const alInfaqPayments = [
      {
        id: "pay-al-1",
        dealer_id: "dealer-al-infaq",
        payment_date: "2026-10-12",
        amount: 23300,
        payment_method: "BANK_TRANSFER",
        reference: "DISB-23300",
        notes: "Full clearance payment"
      }
    ]

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "dealers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: alInfaqDealer, error: null })
            })
          })
        }
      }
      if (table === "products") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
            }),
            order: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
          })
        }
      }
      if (table === "purchases") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: alInfaqPurchases, error: null })
              })
            })
          })
        }
      }
      if (table === "dealer_payments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: alInfaqPayments, error: null })
              })
            })
          })
        }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
    })

    renderComponent("dealer-al-infaq")
    await screen.findByRole("heading", { name: "AL INFAQ TRADERS" })

    // Financial summaries: Total Purchases: 23300, Total Paid: 23300, Outstanding: 0 (Settled)
    expect(screen.getAllByText(formatMoney(23300)).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Settled")).toBeDefined()
    expect(screen.getByText("All accounts cleared")).toBeDefined()

    // Navigate to Purchases tab
    const purchasesTab = screen.getByRole("tab", { name: /purchases/i })
    fireEvent.click(purchasesTab)

    expect(await screen.findByText("Purchase History")).toBeDefined()

    // The purchase MUST show Paid (not UNPAID!)
    const paidBadges = screen.getAllByText("Paid")
    expect(paidBadges.length).toBeGreaterThan(0)
    expect(screen.queryByText("Unpaid")).toBeNull()

    // The purchase card/row balance MUST show 0.00
    expect(screen.getAllByText(formatMoney(0)).length).toBeGreaterThan(0)
  })
})
