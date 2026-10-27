import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ProductsPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getProducts, createProduct, updateProduct, deleteProduct, type Product } from "@/services/products"
import { getDealers, type Dealer } from "@/services/dealers"

vi.mock("@/services/products", () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))

vi.mock("@/services/dealers", () => ({
  getDealers: vi.fn(),
}))

describe("ProductsPage and EditProductModal Component", () => {
  let queryClient: QueryClient

  const mockDealers: Dealer[] = [
    {
      id: "dealer-1",
      name: "Sunrise Agro Traders",
      phone: "+91 9123456789",
      address: "Mandi Road",
      created_at: "2026-01-01",
    },
    {
      id: "dealer-2",
      name: "Valley Dry Fruits Co",
      phone: "+91 9876543210",
      address: "Orchard Lane",
      created_at: "2026-01-02",
    },
  ]

  const mockProducts: Product[] = [
    {
      id: "prod-1",
      dealer_id: "dealer-1",
      name: "California Almonds",
      unit: "Kg",
      buying_cost: 650,
      wholesale_price: 750,
      retail_price: 850,
      stock_quantity: 120,
      dealer: mockDealers[0],
      created_at: "2026-01-10",
    },
    {
      id: "prod-2",
      dealer_id: "dealer-2",
      name: "Organic Walnuts",
      unit: "Box",
      buying_cost: 400,
      wholesale_price: 480,
      retail_price: 550,
      stock_quantity: 45,
      dealer: mockDealers[1],
      created_at: "2026-01-12",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    ;(getDealers as any).mockResolvedValue(mockDealers)
    ;(getProducts as any).mockResolvedValue(mockProducts)
    ;(createProduct as any).mockResolvedValue({
      id: "prod-3",
      dealer_id: "dealer-1",
      name: "Green Cardamom",
      unit: "Kg",
      buying_cost: 1200,
      wholesale_price: 1450,
      retail_price: 1600,
      stock_quantity: 0,
    })
    ;(updateProduct as any).mockResolvedValue({
      ...mockProducts[0],
      name: "California Almonds (Grade A)",
      wholesale_price: 780,
    })
    ;(deleteProduct as any).mockResolvedValue(true)
  })

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProductsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

  it("renders the products directory header, categories strip, and products catalogue", async () => {
    renderComponent()

    expect(screen.getByText("Product Catalog")).toBeDefined()
    expect(screen.getByText("Total Products")).toBeDefined()
    expect(screen.getByText("Total Stock Value")).toBeDefined()

    // Wait for data to load in cards
    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Organic Walnuts").length).toBeGreaterThan(0)
    })

    // Check dealer badges
    expect(screen.getAllByText("Sunrise Agro Traders").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Valley Dry Fruits Co").length).toBeGreaterThan(0)
  })

  it("creates a new product successfully with correct input parameters", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Click Add Product to open AddProductModal
    const openAddBtn = screen.getByRole("button", { name: /Add Product/i })
    fireEvent.click(openAddBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    const modal = screen.getByRole("dialog")

    fireEvent.change(within(modal).getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "Green Cardamom" },
    })

    const categorySelect = within(modal).getByLabelText(/Category/i)
    const dealerSelect = within(modal).getByLabelText(/Dealer/i)
    const unitSelect = within(modal).getByLabelText(/Unit/i)
    fireEvent.change(categorySelect, { target: { value: "Spices & Masalas" } })
    fireEvent.change(dealerSelect, { target: { value: "dealer-1" } })
    fireEvent.change(unitSelect, { target: { value: "Kg" } })

    const costInput = within(modal).getByLabelText(/Buying/i)
    const wholesaleInput = within(modal).getByLabelText(/Wholesale/i)
    const retailInput = within(modal).getByLabelText(/Retail/i)
    fireEvent.change(costInput, { target: { value: "1200" } })
    fireEvent.change(wholesaleInput, { target: { value: "1450" } })
    fireEvent.change(retailInput, { target: { value: "1600" } })

    const form = modal.querySelector("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Green Cardamom",
          dealer_id: "dealer-1",
          unit: "Kg",
          buying_cost: 1200,
          wholesale_price: 1450,
          retail_price: 1600,
          stock_quantity: 0,
          category: "Spices & Masalas",
        }),
        expect.anything()
      )
    })
  })

  it("opens EditProductModal when Edit button is clicked and displays pre-populated fields", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Find and click the edit button for California Almonds
    const editBtn = screen.getAllByLabelText("Edit California Almonds")[0]
    expect(editBtn).toBeDefined()
    fireEvent.click(editBtn)

    // Modal should now be open
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit Product" })).toBeDefined()
    })

    const nameInput = screen.getByDisplayValue("California Almonds")
    expect(nameInput).toBeDefined()

    const costInput = screen.getByDisplayValue("650")
    expect(costInput).toBeDefined()

    const wholesaleInput = screen.getByDisplayValue("750")
    expect(wholesaleInput).toBeDefined()

    const retailInput = screen.getByDisplayValue("850")
    expect(retailInput).toBeDefined()

    // Verify margin preview shows wholesale margin (750 - 650 = 100)
    expect(screen.getByText(/Wholesale Margin/i)).toBeDefined()
    expect(screen.getByText(/Retail Margin/i)).toBeDefined()
  })

  it("submits updated product info via updateProduct with correct sanitized fields", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByLabelText("Edit California Almonds")[0])

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit Product" })).toBeDefined()
    })

    // Update name and wholesale price
    const nameInput = screen.getByDisplayValue("California Almonds")
    fireEvent.change(nameInput, { target: { value: "California Almonds (Grade A)" } })

    const wholesaleInput = screen.getByDisplayValue("750")
    fireEvent.change(wholesaleInput, { target: { value: "780" } })

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith("prod-1", {
        name: "California Almonds (Grade A)",
        dealer_id: "dealer-1",
        unit: "Kg",
        buying_cost: 650,
        wholesale_price: 780,
        retail_price: 850,
        category: "Dry Fruits & Nuts",
      })
    })

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Edit Product" })).toBeNull()
    })
  })

  it("validates required fields before calling updateProduct", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByLabelText("Edit California Almonds")[0])

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit Product" })).toBeDefined()
    })

    const nameInput = screen.getByDisplayValue("California Almonds")
    fireEvent.change(nameInput, { target: { value: "   " } })

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i })
    fireEvent.click(saveBtn)

    // Should display validation error
    await waitFor(() => {
      expect(screen.getByText("Product name is required.")).toBeDefined()
    })

    expect(updateProduct).not.toHaveBeenCalled()
  })

  it("opens ConfirmDialog and calls deleteProduct when confirmed", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("Organic Walnuts").length).toBeGreaterThan(0)
    })

    const deleteBtn = screen.getAllByLabelText("Delete Organic Walnuts")[0]
    fireEvent.click(deleteBtn)

    // Confirm dialog should open
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete "Organic Walnuts"?/i)).toBeDefined()
    })

    // Click confirm in the dialog
    const confirmBtn = screen.getByRole("button", { name: /^Delete Product$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith("prod-2", expect.anything())
    })
  })

  it("trims whitespace from product name before submitting creation", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    const openAddBtn = screen.getByRole("button", { name: /Add Product/i })
    fireEvent.click(openAddBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    const modal = screen.getByRole("dialog")

    fireEvent.change(within(modal).getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "   Kashmiri Saffron   " },
    })

    const categorySelect = within(modal).getByLabelText(/Category/i)
    const dealerSelect = within(modal).getByLabelText(/Dealer/i)
    const unitSelect = within(modal).getByLabelText(/Unit/i)
    fireEvent.change(categorySelect, { target: { value: "Spices & Masalas" } })
    fireEvent.change(dealerSelect, { target: { value: "dealer-1" } })
    fireEvent.change(unitSelect, { target: { value: "Box" } })

    const costInput = within(modal).getByLabelText(/Buying/i)
    const wholesaleInput = within(modal).getByLabelText(/Wholesale/i)
    const retailInput = within(modal).getByLabelText(/Retail/i)
    fireEvent.change(costInput, { target: { value: "250" } })
    fireEvent.change(wholesaleInput, { target: { value: "320" } })
    fireEvent.change(retailInput, { target: { value: "400" } })

    const form = modal.querySelector("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Kashmiri Saffron",
          unit: "Box",
        }),
        expect.anything()
      )
    })
  })

  it("displays an error message when negative prices are entered during creation", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    const openAddBtn = screen.getByRole("button", { name: /Add Product/i })
    fireEvent.click(openAddBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    const modal = screen.getByRole("dialog")

    fireEvent.change(within(modal).getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "Invalid Product" },
    })

    const categorySelect = within(modal).getByLabelText(/Category/i)
    const dealerSelect = within(modal).getByLabelText(/Dealer/i)
    fireEvent.change(categorySelect, { target: { value: "Dry Fruits & Nuts" } })
    fireEvent.change(dealerSelect, { target: { value: "dealer-1" } })

    const costInput = within(modal).getByLabelText(/Buying/i)
    const wholesaleInput = within(modal).getByLabelText(/Wholesale/i)
    const retailInput = within(modal).getByLabelText(/Retail/i)
    fireEvent.change(costInput, { target: { value: "-100" } })
    fireEvent.change(wholesaleInput, { target: { value: "100" } })
    fireEvent.change(retailInput, { target: { value: "120" } })

    const form = modal.querySelector("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/Buying cost must be zero or a positive amount/i)).toBeDefined()
    })

    expect(createProduct).not.toHaveBeenCalled()
  })

  it("displays an explanatory error banner when deletion is rejected due to active references", async () => {
    ;(deleteProduct as any).mockRejectedValueOnce(
      new Error(
        "Cannot delete product because it is referenced by 2 purchase order(s). Deletion is blocked to preserve historical accounting integrity."
      )
    )

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("Organic Walnuts").length).toBeGreaterThan(0)
    })

    const deleteBtn = screen.getAllByLabelText("Delete Organic Walnuts")[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete "Organic Walnuts"?/i)).toBeDefined()
    })

    const confirmBtn = screen.getByRole("button", { name: /^Delete Product$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot delete product because it is referenced by 2 purchase order\(s\)/i)
      ).toBeDefined()
    })
  })

  it("filters products when search term is entered", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByPlaceholderText(/Search products by name/i)
    fireEvent.change(searchInput, { target: { value: "Almonds" } })

    expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    expect(screen.queryByText("Organic Walnuts")).toBeNull()
  })

  it("filters products when category is selected", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Both mock products are in Dry Fruits category
    const honeyBtn = screen.getByRole("button", { name: /Honey category/i })
    fireEvent.click(honeyBtn)

    // Should show no products for Honey
    expect(screen.getByText(/No products found/i)).toBeDefined()

    // Reset or click Dry Fruits
    const dryFruitsBtn = screen.getByRole("button", { name: /Dry Fruits.*category/i })
    fireEvent.click(dryFruitsBtn)

    expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
  })

  it("renders 3-column mobile grid container with exact grid classes", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Verify 3-column mobile grid exists
    const mobileGrid = document.querySelector(".product-mobile-grid")
    expect(mobileGrid).toBeDefined()
    expect(mobileGrid?.classList.contains("grid-cols-3")).toBe(true)
  })

  it("opens the unified filter drawer when Filters button is clicked and closes on Close button", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Filter drawer should not be open initially
    expect(screen.queryByRole("dialog", { name: "Filter Products" })).toBeNull()

    // Click Filters button in toolbar
    const filterBtn = screen.getByRole("button", { name: "Filters" })
    fireEvent.click(filterBtn)

    // Drawer should open
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Filter Products" })).toBeDefined()
    })

    // Verify there is exactly ONE filter dialog in the document (no duplicate panels)
    const filterDialogs = screen.getAllByRole("dialog", { name: "Filter Products" })
    expect(filterDialogs.length).toBe(1)

    // Click Close button
    const closeBtn = screen.getByRole("button", { name: "Close filters" })
    fireEvent.click(closeBtn)

    // Wait for transition/unmount
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Filter Products" })).toBeNull()
    })
  })

  it("closes the filter drawer when Escape key is pressed", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    const filterBtn = screen.getByRole("button", { name: "Filters" })
    fireEvent.click(filterBtn)

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Filter Products" })).toBeDefined()
    })

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" })

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Filter Products" })).toBeNull()
    })
  })

  it("applies stock filters from drawer and filters product catalogue", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    const filterBtn = screen.getByRole("button", { name: "Filters" })
    fireEvent.click(filterBtn)

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Filter Products" })).toBeDefined()
    })

    // Uncheck In Stock
    const inStockCheckbox = screen.getByLabelText(/In Stock/i)
    fireEvent.click(inStockCheckbox)

    // Click Apply Filters
    const applyBtn = screen.getByRole("button", { name: /Apply Filters/i })
    fireEvent.click(applyBtn)

    // Both mock products have stock > 2 (In Stock), so unchecking In Stock should filter them out
    await waitFor(() => {
      expect(screen.getByText(/No products found/i)).toBeDefined()
    })
  })

  it("validates that a category is required before creating a product", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole("button", { name: /Add Product/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    const modal = screen.getByRole("dialog")
    fireEvent.change(within(modal).getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "New Raw Item" },
    })

    const dealerSelect = within(modal).getByLabelText(/Dealer/i)
    fireEvent.change(dealerSelect, { target: { value: "dealer-1" } })

    // Do NOT select category
    const form = modal.querySelector("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(within(modal).getAllByText(/Please select a product category/i).length).toBeGreaterThan(0)
    })

    expect(createProduct).not.toHaveBeenCalled()
  })

  it("allows updating category in EditProductModal and persists new category", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByLabelText("Edit California Almonds")[0])

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit Product" })).toBeDefined()
    })

    const modal = screen.getByRole("dialog")
    const categorySelect = within(modal).getByLabelText(/Category/i)
    expect((categorySelect as HTMLSelectElement).value).toBe("Dry Fruits & Nuts")

    // Change category to Honey
    fireEvent.change(categorySelect, { target: { value: "Honey" } })

    fireEvent.click(within(modal).getByRole("button", { name: /Save Changes/i }))

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith("prod-1", expect.objectContaining({
        category: "Honey",
      }))
    })
  })

  it("creates a retail-only product with absent wholesale price persisted as null", async () => {
    ;(createProduct as any).mockResolvedValueOnce({
      id: "prod-new-retail-only",
      name: "Retail Exclusive Saffron",
      category: "Spices & Masalas",
      dealer_id: "dealer-1",
      unit: "Gram",
      buying_cost: 200,
      wholesale_price: null,
      retail_price: 350,
      stock_quantity: 0,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole("button", { name: /Add Product/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    const modal = screen.getByRole("dialog")
    fireEvent.change(within(modal).getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "Retail Exclusive Saffron" },
    })
    fireEvent.change(within(modal).getByLabelText(/Category/i), {
      target: { value: "Spices & Masalas" },
    })
    fireEvent.change(within(modal).getByLabelText(/Dealer/i), {
      target: { value: "dealer-1" },
    })
    fireEvent.change(within(modal).getByLabelText(/Unit/i), {
      target: { value: "g" },
    })
    fireEvent.change(within(modal).getByLabelText(/Buying/i), {
      target: { value: "200" },
    })
    // Leave wholesale price blank!
    fireEvent.change(within(modal).getByLabelText(/Retail/i), {
      target: { value: "350" },
    })

    const form = modal.querySelector("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Retail Exclusive Saffron",
          wholesale_price: null,
          retail_price: 350,
          buying_cost: 200,
          category: "Spices & Masalas",
        }),
        expect.anything()
      )
    })
  })

  it("renders list and compact view modes with separate wholesale and retail profit columns", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Switch to List View
    const listBtn = screen.getByRole("button", { name: "List view" })
    fireEvent.click(listBtn)

    await waitFor(() => {
      expect(screen.getByText("Wholesale Profit")).toBeDefined()
      expect(screen.getByText("Retail Profit")).toBeDefined()
    })

    // Switch to Compact View
    const compactBtn = screen.getByRole("button", { name: "Compact view" })
    fireEvent.click(compactBtn)

    await waitFor(() => {
      expect(screen.getByText("Wholesale Profit")).toBeDefined()
      expect(screen.getByText("Retail Profit")).toBeDefined()
    })
  })
})
