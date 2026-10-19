import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import WholesaleSalesPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getWholesaleSales, createWholesaleSale, updateWholesaleSale, deleteWholesaleSale } from "@/services/wholesaleSales"
import { getResellers } from "@/services/resellers"
import { getProducts } from "@/services/products"

vi.mock("@/services/wholesaleSales", () => ({
  getWholesaleSales: vi.fn(),
  createWholesaleSale: vi.fn(),
  deleteWholesaleSale: vi.fn(),
  updateWholesaleSale: vi.fn()
}))

vi.mock("@/services/resellers", () => ({
  getResellers: vi.fn()
}))

vi.mock("@/services/products", () => ({
  getProducts: vi.fn()
}))

describe("WholesaleSalesPage Component", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    ;(getResellers as any).mockResolvedValue([
      { id: "cust-1", name: "Alpha Reseller", phone: "111", address: "Market 1" }
    ])

    ;(getProducts as any).mockResolvedValue([
      {
        id: "prod-1",
        name: "Premium Cashew",
        unit: "kg",
        buying_cost: 100,
        wholesale_price: 150,
        retail_price: 180,
        stock_quantity: 50,
        dealer_id: "dealer-1"
      }
    ])

    ;(getWholesaleSales as any).mockResolvedValue([
      {
        id: "sale-1",
        customer_id: "cust-1",
        product_id: "prod-1",
        dealer_id: "dealer-1",
        sale_date: "2026-10-10",
        quantity: 5,
        buying_cost: 100,
        wholesale_price: 150,
        total_sale: 750,
        amount_received: 750,
        balance: 0,
        profit: 250,
        payment_status: "PAID",
        payment_method: "CASH",
        notes: "Historical test note #123",
        customer: { id: "cust-1", name: "Alpha Reseller" },
        product: { id: "prod-1", name: "Premium Cashew", unit: "kg" }
      }
    ])
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WholesaleSalesPage />
      </QueryClientProvider>
    )
  }

  it("renders page title, New Wholesale Sale form, Notes and Actions columns in table", async () => {
    renderComponent()

    expect(screen.getByText("Wholesale Dashboard")).toBeDefined()
    expect(screen.getByText("New Wholesale Sale")).toBeDefined()
    expect(screen.getByText("Payment Method")).toBeDefined()
    expect(screen.getByText("Wholesale Transactions")).toBeDefined()

    // Wait for customer option to load
    expect(await screen.findByRole("option", { name: "Alpha Reseller" })).toBeDefined()
    expect(await screen.findByRole("option", { name: /Premium Cashew/ })).toBeDefined()

    // Verify existing sale transaction rendered in table with note and method
    expect(await screen.findByText("Historical test note #123")).toBeDefined()
    expect(screen.getByText("Notes")).toBeDefined()
    expect(screen.getByText("Actions")).toBeDefined()
    expect(screen.getByText("CASH")).toBeDefined()
    expect(screen.getByRole("button", { name: /Edit transaction for Alpha Reseller/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Delete transaction for Alpha Reseller/i })).toBeDefined()
  })

  it("submits a new sale with selected payment method, customer, product, and trimmed note", async () => {
    ;(createWholesaleSale as any).mockResolvedValue({
      id: "new-sale-1",
      customer_id: "cust-1",
      product_id: "prod-1",
      dealer_id: "dealer-1",
      sale_date: "2026-10-11",
      quantity: 10,
      buying_cost: 100,
      wholesale_price: 150,
      total_sale: 1500,
      amount_received: 1000,
      balance: 500,
      profit: 500,
      payment_status: "PARTIAL",
      payment_method: "UPI",
      notes: "Urgent shipment"
    })

    renderComponent()

    await screen.findByRole("option", { name: "Alpha Reseller" })

    const selects = screen.getAllByRole("combobox")
    // selects[0] is dateFilter, [1] is customer, [2] is product, [3] is payment method
    fireEvent.change(selects[1], { target: { value: "cust-1" } })
    fireEvent.change(selects[2], { target: { value: "prod-1" } })
    fireEvent.change(selects[3], { target: { value: "UPI" } })

    const numberInputs = screen.getAllByRole("spinbutton")
    fireEvent.change(numberInputs[0], { target: { value: "10" } }) // Qty
    fireEvent.change(numberInputs[1], { target: { value: "1000" } }) // Received

    // Note input in create form
    const noteInput = screen.getByPlaceholderText(/e\.g\. Delivered - Settled/i)
    fireEvent.change(noteInput, { target: { value: "   Urgent shipment   " } })

    const submitBtn = screen.getByRole("button", { name: /Record Sale/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createWholesaleSale).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: "cust-1",
          product_id: "prod-1",
          dealer_id: "dealer-1",
          quantity: 10,
          wholesale_price: 150,
          total_sale: 1500,
          amount_received: 1000,
          balance: 500,
          profit: 500,
          payment_status: "PARTIAL",
          payment_method: "UPI",
          notes: "Urgent shipment"
        }),
        expect.anything()
      )
    })
  })

  it("opens edit modal with populated transaction data, recalculates live values, and saves edits", async () => {
    ;(updateWholesaleSale as any).mockResolvedValue({
      id: "sale-1",
      customer_id: "cust-1",
      product_id: "prod-1",
      dealer_id: "dealer-1",
      sale_date: "2026-10-10",
      quantity: 8,
      buying_cost: 100,
      wholesale_price: 150,
      total_sale: 1200,
      amount_received: 1200,
      balance: 0,
      profit: 400,
      payment_status: "PAID",
      payment_method: "BANK",
      notes: "Updated delivery settled"
    })

    renderComponent()

    await screen.findByText("Historical test note #123")

    // Click Edit button
    const editBtn = screen.getByRole("button", { name: /Edit transaction for Alpha Reseller/i })
    fireEvent.click(editBtn)

    // Edit modal appears
    expect(screen.getByText("Edit Wholesale Sale")).toBeDefined()

    // Find modal inputs
    const modal = screen.getByRole("dialog")
    const modalQtyInput = modal.querySelector('input[type="number"][step="0.01"]') as HTMLInputElement
    expect(modalQtyInput).toBeDefined()
    expect(modalQtyInput.value).toBe("5")

    // Change quantity to 8
    fireEvent.change(modalQtyInput, { target: { value: "8" } })

    // Find and update note input inside modal
    const modalNoteInput = modal.querySelector('input[placeholder="e.g. Delivered - Settled"]') as HTMLInputElement
    expect(modalNoteInput.value).toBe("Historical test note #123")
    fireEvent.change(modalNoteInput, { target: { value: "Updated delivery settled" } })

    // Change payment method to BANK
    const modalSelects = modal.querySelectorAll("select")
    // modalSelects: [0] customer, [1] product, [2] payment method
    fireEvent.change(modalSelects[2], { target: { value: "BANK" } })

    // Click Save Changes
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateWholesaleSale).toHaveBeenCalledWith(
        "sale-1",
        expect.objectContaining({
          quantity: 8,
          wholesale_price: 150,
          total_sale: 1200,
          payment_method: "BANK",
          notes: "Updated delivery settled"
        })
      )
    })
  })

  it("cancels edit without calling updateWholesaleSale or modifying the transaction", async () => {
    renderComponent()

    await screen.findByText("Historical test note #123")

    const editBtn = screen.getByRole("button", { name: /Edit transaction for Alpha Reseller/i })
    fireEvent.click(editBtn)

    expect(screen.getByText("Edit Wholesale Sale")).toBeDefined()

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i })
    fireEvent.click(cancelBtn)

    // Modal is closed
    expect(screen.queryByText("Edit Wholesale Sale")).toBeNull()
    expect(updateWholesaleSale).not.toHaveBeenCalled()
  })

  it("handles delete transaction with confirmation modal", async () => {
    ;(deleteWholesaleSale as any).mockResolvedValue(undefined)

    renderComponent()

    await screen.findByText("Historical test note #123")

    const deleteBtn = screen.getByRole("button", { name: /Delete transaction for Alpha Reseller/i })
    fireEvent.click(deleteBtn)

    // ConfirmDialog appears
    const confirmBtn = screen.getByRole("button", { name: /^Delete Sale$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteWholesaleSale).toHaveBeenCalledWith("sale-1", expect.anything())
    })
  })
})
