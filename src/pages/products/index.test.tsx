import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

  it("renders the products catalog title, create form, and products table", async () => {
    renderComponent()

    expect(screen.getByText("Products Catalog")).toBeDefined()
    expect(screen.getByText("Add New Product")).toBeDefined()

    // Wait for data to load in table
    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Organic Walnuts").length).toBeGreaterThan(0)
    })

    // Check dealer badges in table
    expect(screen.getAllByText("Sunrise Agro Traders").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Valley Dry Fruits Co").length).toBeGreaterThan(0)
  })

  it("creates a new product successfully with correct input parameters", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "Green Cardamom" },
    })

    const selects = screen.getAllByRole("combobox")
    // First select is dealer, second is unit
    fireEvent.change(selects[0], { target: { value: "dealer-1" } })
    fireEvent.change(selects[1], { target: { value: "Kg" } })

    const inputs = screen.getAllByRole("spinbutton")
    // spinbuttons are: Buying Cost, Wholesale Rate, Retail Rate
    fireEvent.change(inputs[0], { target: { value: "1200" } })
    fireEvent.change(inputs[1], { target: { value: "1450" } })
    fireEvent.change(inputs[2], { target: { value: "1600" } })

    const submitBtn = screen.getByRole("button", { name: /Add Product/i })
    fireEvent.click(submitBtn)

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
    // Set to whitespace string to test trim validation
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
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "   Kashmiri Saffron   " },
    })

    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[0], { target: { value: "dealer-1" } })
    fireEvent.change(selects[1], { target: { value: "Box" } })

    const inputs = screen.getAllByRole("spinbutton")
    fireEvent.change(inputs[0], { target: { value: "250" } })
    fireEvent.change(inputs[1], { target: { value: "320" } })
    fireEvent.change(inputs[2], { target: { value: "400" } })

    const submitBtn = screen.getByRole("button", { name: /Add Product/i })
    fireEvent.click(submitBtn)

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
      expect(screen.getByPlaceholderText(/e\.g\. Sider Honey/i)).toBeDefined()
    })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sider Honey/i), {
      target: { value: "Invalid Product" },
    })

    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[0], { target: { value: "dealer-1" } })

    const inputs = screen.getAllByRole("spinbutton")
    fireEvent.change(inputs[0], { target: { value: "-100" } })
    fireEvent.change(inputs[1], { target: { value: "100" } })
    fireEvent.change(inputs[2], { target: { value: "120" } })

    const submitBtn = screen.getByRole("button", { name: /Add Product/i })
    fireEvent.click(submitBtn)

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
})
