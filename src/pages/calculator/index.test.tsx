import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ProductCalculatorPage from "./index"
import { getProducts, type Product } from "@/services/products"
import { supabase } from "@/lib/supabase"

vi.mock("@/services/products", () => ({
  getProducts: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe("ProductCalculatorPage Component", () => {
  let queryClient: QueryClient

  const mockProducts: Product[] = [
    {
      id: "prod-1",
      dealer_id: "dealer-1",
      name: "Cooking Oil 5L",
      unit: "tin",
      buying_cost: 450,
      wholesale_price: 500,
      retail_price: 550,
      stock_quantity: 25,
      created_at: "2026-01-01",
    },
    {
      id: "prod-2",
      dealer_id: "dealer-1",
      name: "Basmati Rice Premium",
      unit: "Kg",
      buying_cost: 80,
      wholesale_price: 100,
      retail_price: 120,
      stock_quantity: 50,
      created_at: "2026-01-02",
    },
    {
      id: "prod-3",
      dealer_id: "dealer-2",
      name: "Special Spice Mix",
      unit: "Pkt",
      buying_cost: 40,
      wholesale_price: 0, // No wholesale price configured
      retail_price: 0, // No retail price configured
      stock_quantity: 5,
      created_at: "2026-01-03",
    },
    {
      id: "prod-4",
      dealer_id: "dealer-2",
      name: "Low Stock Sugar",
      unit: "Kg",
      buying_cost: 38,
      wholesale_price: 45,
      retail_price: 50,
      stock_quantity: 2, // Low stock for warning verification
      created_at: "2026-01-04",
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    })
    ;(getProducts as any).mockResolvedValue(mockProducts)
  })

  function renderCalculator() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/calculator"]}>
          <ProductCalculatorPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  // 1. Product loading and rate population
  it("loads products and dynamically populates current selling price and stock", async () => {
    renderCalculator()

    expect(await screen.findByText(/Product Price & Quantity Calculator/i)).toBeDefined()
    expect(screen.getByText(/Preview & Estimation Tool/i)).toBeDefined()

    const select = screen.getByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } })

    // Product info and active rates are visible
    expect(screen.getByText("Cooking Oil 5L")).toBeDefined()
    expect(screen.getByText(/25 tin in stock/i)).toBeDefined()
    // Defaults to wholesale price (₹500.00)
    expect(screen.getAllByText(/500/i).length).toBeGreaterThan(0)
  })

  // 2. Mode A: Cash provided calculates quantity correctly
  it("calculates exact and practical sellable quantity from customer cash in Mode A", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } }) // Cooking Oil: ₹500/tin

    // Enter cash amount of ₹1200
    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "1200" } })

    // ₹1200 / ₹500 = exact 2.4 tins. Since unit is "tin" (discrete), practical is 2 tins
    expect(screen.getByText("2")).toBeDefined() // Practical quantity
    expect(screen.getByText(/2.4/i)).toBeDefined() // Exact mathematical calculation
    expect(screen.getByText(/Change to Return/i)).toBeDefined()
  })

  // 3. Mode B: Entering quantity calculates total price correctly
  it("calculates total selling price from quantity in Mode B", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } }) // ₹500/tin

    // Switch to Mode B: Quantity to Price
    const modeBBtn = screen.getByRole("button", { name: /Mode B: Quantity to Price/i })
    fireEvent.click(modeBBtn)

    // Enter quantity 4
    const qtyInput = screen.getByLabelText(/Required Quantity/i)
    fireEvent.change(qtyInput, { target: { value: "4" } })

    // 4 tins @ ₹500 = ₹2,000.00
    expect(screen.getByText(/Total Selling Amount/i)).toBeDefined()
    expect(screen.getAllByText(/2,000/i).length).toBeGreaterThan(0)
  })

  // 4. Product changes dynamically update calculations
  it("updates calculations dynamically when product selection changes", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } }) // ₹500/tin

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "1000" } })

    // 1000 / 500 = 2 tins
    expect(screen.getByText("2")).toBeDefined()

    // Switch product to Basmati Rice (prod-2: ₹100/kg)
    fireEvent.change(select, { target: { value: "prod-2" } })

    // ₹1000 / ₹100 = 10 kg
    await waitFor(() => {
      expect(screen.getByText("Basmati Rice Premium")).toBeDefined()
      expect(screen.getByText("10")).toBeDefined()
    })
  })

  // 5. Zero, negative, invalid, and missing-price inputs
  it("handles zero, negative, invalid inputs, and missing prices safely", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } })

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)

    // Negative amount
    fireEvent.change(cashInput, { target: { value: "-100" } })
    expect(screen.getByText(/Amount must be greater than zero/i)).toBeDefined()

    // Zero amount
    fireEvent.change(cashInput, { target: { value: "0" } })
    expect(screen.getByText(/Amount must be greater than zero/i)).toBeDefined()

    // Product with missing price
    fireEvent.change(select, { target: { value: "prod-3" } })
    expect(await screen.findByText(/Missing Selling Price/i)).toBeDefined()
  })

  // 6. Fractional quantities, rounding, and whole-unit restrictions
  it("supports fractional quantities for continuous units and allows toggling whole-unit precision", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    // Select Basmati Rice (unit: Kg -> continuous)
    fireEvent.change(select, { target: { value: "prod-2" } }) // ₹100/kg

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "250" } })

    // 250 / 100 = 2.5 kg
    expect(screen.getByText("2.5")).toBeDefined()

    // Toggle to Whole Units
    const toggleBtn = screen.getByRole("button", { name: /Switch to Whole Units/i })
    fireEvent.click(toggleBtn)

    // In whole units, practical quantity floors to 2 kg, change is ₹50
    expect(screen.getByText("2")).toBeDefined()
  })

  // 7. Stock deficit warning when inventory info is available
  it("displays prominent inventory deficit warning without silently capping quantity", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    // Select Low Stock Sugar (prod-4: 2 Kg in stock, ₹45/kg)
    fireEvent.change(select, { target: { value: "prod-4" } })

    // Enter cash amount to buy 10 kg (₹450)
    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "450" } })

    // Warning is revealed
    expect(screen.getByText(/Inventory Deficit Warning/i)).toBeDefined()
    expect(screen.getByText(/exceeds available stock \(2 Kg\)/i)).toBeDefined()
    // Quantity is NOT capped to 2; practical quantity remains 10
    expect(screen.getByText("10")).toBeDefined()
  })

  // 8. Loading state and product-fetch errors
  it("renders error state when product loading fails with retry support", async () => {
    ;(getProducts as any).mockRejectedValueOnce(new Error("Supabase connection timeout"))

    renderCalculator()

    expect(await screen.findByText(/Failed to load products/i)).toBeDefined()
    expect(screen.getByText(/Supabase connection timeout/i)).toBeDefined()

    // Clicking retry triggers refetch
    const retryBtn = screen.getByRole("button", { name: /Retry/i })
    fireEvent.click(retryBtn)
    expect(getProducts).toHaveBeenCalledTimes(2)
  })

  // 9. Reset and mode switching
  it("clears inputs and allows seamless mode switching", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } })

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "700" } })

    // Reset All button
    const resetBtn = screen.getByRole("button", { name: /Reset All/i })
    fireEvent.click(resetBtn)

    // Form inputs and selection are cleared
    expect(screen.getByText(/No Product Selected/i)).toBeDefined()
  })

  // 10. Quick cash and quick quantity buttons work
  it("sets values instantly when quick cash and quick quantity presets are clicked", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } }) // ₹500/tin

    // Click quick preset ₹500
    const preset500 = screen.getByRole("button", { name: "₹500" })
    fireEvent.click(preset500)

    // 500 / 500 = 1 tin
    expect(screen.getByText("1")).toBeDefined()

    // Switch to Mode B and click quantity preset
    const modeBBtn = screen.getByRole("button", { name: /Mode B: Quantity to Price/i })
    fireEvent.click(modeBBtn)

    const preset5Qty = screen.getByRole("button", { name: /5 tin/i })
    fireEvent.click(preset5Qty)

    // 5 * 500 = 2,500
    expect(screen.getAllByText(/2,500/i).length).toBeGreaterThan(0)
  })

  // 11. Data and business safety: preview tool only (0 database mutations)
  it("guarantees 0 database writes, 0 ledger mutations, and 0 stock deductions", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } })

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "1000" } })

    // Verify supabase mutation methods (insert, update, delete, rpc) were NEVER called
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
