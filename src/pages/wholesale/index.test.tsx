import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import WholesaleSalesPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getWholesaleSales, createWholesaleSale } from "@/services/wholesaleSales"
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
        notes: "Historical test sale",
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

  it("renders page title and New Wholesale Sale form with payment method selector", async () => {
    renderComponent()

    expect(screen.getByText("Wholesale Dashboard")).toBeDefined()
    expect(screen.getByText("New Wholesale Sale")).toBeDefined()
    expect(screen.getByText("Payment Method")).toBeDefined()
    expect(screen.getByText("Wholesale Transactions")).toBeDefined()

    // Wait for customer option to load
    expect(await screen.findByRole("option", { name: "Alpha Reseller" })).toBeDefined()
    expect(await screen.findByRole("option", { name: /Premium Cashew/ })).toBeDefined()

    // Verify existing sale transaction rendered in table
    expect(await screen.findByText("CASH")).toBeDefined()
  })

  it("submits a new sale with selected payment method, customer, and product", async () => {
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
      notes: "Urgent order"
    })

    renderComponent()

    await screen.findByRole("option", { name: "Alpha Reseller" })

    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[1], { target: { value: "cust-1" } })
    fireEvent.change(selects[2], { target: { value: "prod-1" } })
    fireEvent.change(selects[3], { target: { value: "UPI" } })

    const numberInputs = screen.getAllByRole("spinbutton")
    fireEvent.change(numberInputs[0], { target: { value: "10" } }) // Qty
    fireEvent.change(numberInputs[1], { target: { value: "1000" } }) // Received

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
          payment_method: "UPI"
        }),
        expect.anything()
      )
    })
  })

  it("retains form values and displays error banner when submission fails", async () => {
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {})
    ;(createWholesaleSale as any).mockRejectedValue(
      new Error("Could not find the 'payment_method' column of 'wholesale_sales' in the schema cache")
    )

    renderComponent()
    await screen.findByRole("option", { name: "Alpha Reseller" })

    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[1], { target: { value: "cust-1" } })
    fireEvent.change(selects[2], { target: { value: "prod-1" } })
    fireEvent.change(selects[3], { target: { value: "BANK" } })

    const numberInputs = screen.getAllByRole("spinbutton")
    fireEvent.change(numberInputs[0], { target: { value: "5" } })
    fireEvent.change(numberInputs[1], { target: { value: "750" } })

    const submitBtn = screen.getByRole("button", { name: /Record Sale/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Failed to create sale: Could not find the 'payment_method' column/i)).toBeDefined()
      expect((numberInputs[0] as HTMLInputElement).value).toBe("5")
      expect((numberInputs[1] as HTMLInputElement).value).toBe("750")
    })

    alertMock.mockRestore()
  })
})
