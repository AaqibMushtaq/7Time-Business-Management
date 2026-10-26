import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
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
    },
    {
      id: "prod-5",
      dealer_id: "dealer-3",
      name: "Pure Apple Juice",
      unit: "L",
      buying_cost: 80,
      wholesale_price: 120,
      retail_price: 140,
      stock_quantity: 30,
      created_at: "2026-01-05",
    },
    {
      id: "prod-6",
      dealer_id: "dealer-3",
      name: "Almonds California",
      unit: "kg",
      buying_cost: 160,
      wholesale_price: 200,
      retail_price: 220,
      stock_quantity: 40,
      created_at: "2026-01-06",
    },
    {
      id: "prod-7",
      dealer_id: "dealer-3",
      name: "Cold Drink Glass Bottle",
      unit: "bottle",
      buying_cost: 30,
      wholesale_price: 40,
      retail_price: 50,
      stock_quantity: 100,
      created_at: "2026-01-07",
    },
    {
      id: "prod-8",
      dealer_id: "dealer-4",
      name: "Mystery Item",
      unit: "", // Missing unit
      buying_cost: 50,
      wholesale_price: 70,
      retail_price: 80,
      stock_quantity: 10,
      created_at: "2026-01-08",
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
    expect(screen.getAllByText("Cooking Oil 5L").length).toBeGreaterThan(0)
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

  // 3. Mode A: Illustrative Example - ₹100 for product priced at ₹200/kg shows convenient 500 g
  it("calculates ₹100 for ₹200/kg product as convenient 500 g in Mode A", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-6" } }) // Almonds: ₹200/kg

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "100" } })

    // 100 / 200 = 0.5 kg, convenient metric highlight displays 500 g
    expect(screen.getByText("0.5")).toBeDefined()
    expect(screen.getByText(/Convenient Metric: 500 g/i)).toBeDefined()
  })

  // 4. Mode B: Entering quantity calculates total price correctly
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

  // 5. Mode B: Metric Conversion - 750 g for product priced at ₹200/kg = ₹150
  it("converts 750 g to 0.75 kg for ₹200/kg product and calculates ₹150 total in Mode B", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-6" } }) // Almonds: ₹200/kg

    // Switch to Mode B: Quantity to Price
    const modeBBtn = screen.getByRole("button", { name: /Mode B: Quantity to Price/i })
    fireEvent.click(modeBBtn)

    // Select Gram (g) unit
    const gramUnitBtn = screen.getByRole("button", { name: /Gram \(g\)/i })
    fireEvent.click(gramUnitBtn)

    // Enter quantity 750 (grams)
    const qtyInput = screen.getByLabelText(/Required Quantity/i)
    fireEvent.change(qtyInput, { target: { value: "750" } })

    // 750 g @ ₹200/kg (₹0.20/g) = ₹150.00
    expect(screen.getAllByText(/150/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/0.75 kg/i).length).toBeGreaterThan(0)
  })

  // 6. Mode B: Metric Conversion - 250 mL for product priced at ₹120/L = ₹30
  it("converts 250 mL to 0.25 L for ₹120/L product and calculates ₹30 total in Mode B", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-5" } }) // Apple Juice: ₹120/L

    // Switch to Mode B
    const modeBBtn = screen.getByRole("button", { name: /Mode B: Quantity to Price/i })
    fireEvent.click(modeBBtn)

    // Select Millilitre (mL) unit
    const mlUnitBtn = screen.getByRole("button", { name: /Millilitre \(mL\)/i })
    fireEvent.click(mlUnitBtn)

    // Enter quantity 250 (mL)
    const qtyInput = screen.getByLabelText(/Required Quantity/i)
    fireEvent.change(qtyInput, { target: { value: "250" } })

    // 250 mL @ ₹120/L (₹0.12/mL) = ₹30.00
    expect(screen.getAllByText(/30/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/0.25 L/i).length).toBeGreaterThan(0)
  })

  // 7. Product changes dynamically update calculations and reset units
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

    // Enter cash again after product switch
    const cashInputAfter = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInputAfter, { target: { value: "1000" } })

    // ₹1000 / ₹100 = 10 kg
    await waitFor(() => {
      expect(screen.getAllByText("Basmati Rice Premium").length).toBeGreaterThan(0)
      expect(screen.getByText("10")).toBeDefined()
    })
  })

  // 8. Zero, negative, invalid, and missing-price inputs
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

  // 9. Missing measurement unit displays warning
  it("displays a clear warning when a product has no defined measurement unit", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-8" } }) // Mystery Item without unit

    expect((await screen.findAllByText(/Missing Measurement Unit/i)).length).toBeGreaterThan(0)
  })

  // 10. Fractional quantities, rounding, and whole-unit restrictions
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

  // 11. Packaging product distinction
  it("displays packaging rate notice for discrete package units (e.g. bottles)", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-7" } }) // Cold Drink Glass Bottle

    expect(screen.getByText(/priced per individual bottle/i)).toBeDefined()
  })

  // 12. Stock deficit warning when inventory info is available
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

  // 13. Loading state and product-fetch errors
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

  // 14. Reset and mode switching
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

  // 15. Data and business safety: preview tool only (0 database mutations)
  it("guarantees 0 database writes, 0 ledger mutations, and 0 stock deductions", async () => {
    renderCalculator()

    const select = await screen.findByLabelText(/Select Product/i)
    fireEvent.change(select, { target: { value: "prod-1" } })

    const cashInput = screen.getByLabelText(/Cash Provided by Customer/i)
    fireEvent.change(cashInput, { target: { value: "1000" } })

    // Verify supabase mutation methods (insert, update, delete, rpc) were NEVER called
    expect(supabase.from).not.toHaveBeenCalled()
  })

  // 16. Combobox portal rendering, search filtering, and product selection
  it("opens the searchable combobox portal and filters products by query", async () => {
    renderCalculator()

    // Trigger button
    const trigger = await screen.findByRole("combobox", { name: /Open product catalog/i })
    fireEvent.click(trigger)

    // Verify search input is present in the portaled dropdown
    const searchInput = screen.getByRole("searchbox", { name: "" })
    expect(searchInput).toBeDefined()

    // Type "Almonds"
    fireEvent.change(searchInput, { target: { value: "Almonds" } })

    const listbox = screen.getByRole("listbox")
    // Only Almonds California should be visible in filtered list
    expect(within(listbox).getByText("Almonds California")).toBeDefined()
    expect(within(listbox).queryByText("Basmati Rice Premium")).toBeNull()

    // Select Almonds California
    fireEvent.click(within(listbox).getByText("Almonds California"))

    // Selected product summary appears
    await waitFor(() => {
      expect(screen.getAllByText("Almonds California").length).toBeGreaterThan(0)
    })
  })

  // 17. Keyboard navigation in searchable combobox (ArrowDown, Enter, Escape)
  it("supports keyboard navigation: ArrowDown, Enter to select, and Escape to dismiss", async () => {
    renderCalculator()

    const trigger = await screen.findByRole("combobox", { name: /Open product catalog/i })

    // Open via Enter
    fireEvent.keyDown(trigger, { key: "Enter" })
    expect(screen.getByRole("searchbox")).toBeDefined()

    // Press Escape to dismiss
    const searchInput = screen.getByRole("searchbox")
    fireEvent.keyDown(searchInput, { key: "Escape" })
    expect(screen.queryByRole("searchbox")).toBeNull()

    // Open again via ArrowDown
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    expect(screen.getByRole("searchbox")).toBeDefined()

    // Press ArrowDown to navigate to second item and Enter to select
    const searchInput2 = screen.getByRole("searchbox")
    fireEvent.keyDown(searchInput2, { key: "ArrowDown" })
    fireEvent.keyDown(searchInput2, { key: "Enter" })

    // Second product selected
    await waitFor(() => {
      expect(screen.getAllByText("Basmati Rice Premium").length).toBeGreaterThan(0)
    })
  })

  // 18. Outside click dismisses the portaled combobox menu
  it("dismisses the combobox dropdown when clicking outside", async () => {
    renderCalculator()

    const trigger = await screen.findByRole("combobox", { name: /Open product catalog/i })
    fireEvent.click(trigger)
    expect(screen.getByRole("searchbox")).toBeDefined()

    // Click outside on heading
    const heading = screen.getByText(/Product Price & Quantity Calculator/i)
    fireEvent.mouseDown(heading)
    expect(screen.queryByRole("searchbox")).toBeNull()
  })
})
