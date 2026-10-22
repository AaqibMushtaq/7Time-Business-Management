import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import InventoryPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
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

describe("InventoryPage Component", () => {
  let queryClient: QueryClient

  const mockProducts: Product[] = [
    {
      id: "prod-1",
      dealer_id: "dealer-1",
      name: "California Almonds",
      unit: "Kg",
      buying_cost: 600,
      wholesale_price: 750,
      retail_price: 850,
      stock_quantity: 100, // Cost value: 60,000, Pot Profit: 15,000
      dealer: { id: "dealer-1", name: "Sunrise Agro Traders" } as any,
    },
    {
      id: "prod-2",
      dealer_id: "dealer-2",
      name: "Organic Walnuts",
      unit: "Box",
      buying_cost: 400,
      wholesale_price: 500,
      retail_price: 600,
      stock_quantity: 2, // Low stock: <= 2. Cost value: 800, Pot profit: 200
      dealer: { id: "dealer-2", name: "Valley Dry Fruits Co" } as any,
    },
    {
      id: "prod-3",
      dealer_id: "dealer-1",
      name: "Pistachios Roasted",
      unit: "Kg",
      buying_cost: 1000,
      wholesale_price: 1200,
      retail_price: 1400,
      stock_quantity: 0, // Out of stock: 0. Cost value: 0, Pot profit: 0
      dealer: { id: "dealer-1", name: "Sunrise Agro Traders" } as any,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    ;(getProducts as any).mockResolvedValue(mockProducts)
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === "app_settings") {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { low_stock_threshold: 2 },
              error: null,
            }),
          }),
        }
      }
      return {}
    })
  })

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InventoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

  it("renders page header and calculates total stock units and asset valuation", async () => {
    renderComponent()

    expect(screen.getByText("Inventory Management")).toBeDefined()
    expect(screen.getByText("STOCK & VALUATION")).toBeDefined()

    // 100 + 2 + 0 = 102 units
    await waitFor(() => {
      expect(screen.getByText("102")).toBeDefined()
    })

    // Total Stock Value = (100 * 600) + (2 * 400) + (0 * 1000) = 60,000 + 800 = 60,800
    expect(screen.getAllByText(/₹60,800/i).length).toBeGreaterThan(0)

    // Projected Wholesale Profit = (100 * 150) + (2 * 100) + 0 = 15,000 + 200 = 15,200
    expect(screen.getAllByText(/₹15,200/i).length).toBeGreaterThan(0)

    // Low stock count: stock <= 2 -> prod-2 (2) and prod-3 (0) -> 2 items
    expect(screen.getByText("2")).toBeDefined()
  })

  it("renders status badges correctly based on stock level thresholds", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("California Almonds").length).toBeGreaterThan(0)
    })

    // Healthy badge for California Almonds (stock = 100)
    expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0)

    // Low Stock badge for Organic Walnuts (stock = 2)
    expect(screen.getAllByText("Low Stock").length).toBeGreaterThan(0)

    // Out of Stock badge for Pistachios Roasted (stock = 0)
    expect(screen.getAllByText("Out of Stock").length).toBeGreaterThan(0)
  })
})
