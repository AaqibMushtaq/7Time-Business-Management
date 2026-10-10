import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import DashboardPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { getDashboardStats } from "@/services/dashboard"

vi.mock("@/services/dashboard", () => ({
  getDashboardStats: vi.fn(),
}))

const mockStats = {
  inventory: {
    totalValue: 125000,
    totalItems: 450,
    potentialRevenue: 180000,
    potentialProfit: 55000,
    outOfStock: 2,
    lowStock: 5,
  },
  purchases: {
    total: 23300,
    paymentsMade: 23000,
    amountPaidAtPurchase: 0,
    totalPayable: 300,
  },
  sales: {
    total: 45000,
    received: 35000,
    resellerPayments: 5000,
    totalReceivable: 5000,
    profit: 12000,
    transactions: 18,
    chartData: [
      { date: "2026-10-01", sales: 15000, cost: 11000, profit: 4000 },
      { date: "2026-10-02", sales: 30000, cost: 22000, profit: 8000 },
    ],
  },
  dealers: [
    { id: "d1", name: "Al Infaq", outstanding: 300 },
  ],
  resellers: [
    { id: "r1", name: "Kashmir Traders", outstanding: 5000 },
  ],
  generalDelivery: {
    activeDays: 14,
    total: 5180,
    fuel: 1400,
    net: 3780,
  },
  naeem: {
    trips: 22,
    total: 7700,
    received: 5000,
    pending: 2700,
  },
  recentActivity: [
    { id: "1", type: "PURCHASE", name: "Al Infaq", date: "2026-10-05", amount: 23300 },
    { id: "2", type: "WHOLESALE SALE", name: "Kashmir Traders", date: "2026-10-06", amount: 15000 },
  ],
}

describe("DashboardPage Component", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    ;(getDashboardStats as any).mockResolvedValue(mockStats)
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("renders page title, dashboard badge, and period selector", async () => {
    renderComponent()

    expect(await screen.findByText("7TIME Business Management")).toBeDefined()
    expect(screen.getByText("DASHBOARD")).toBeDefined()
    expect(screen.getByLabelText("Select reporting period")).toBeDefined()
  })

  it("renders compact quick action tiles", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Purchases")).toBeDefined()
      expect(screen.getByText("Wholesale")).toBeDefined()
      expect(screen.getByText("Dealers")).toBeDefined()
      expect(screen.getByText("Products")).toBeDefined()
      expect(screen.getByText("Deliveries")).toBeDefined()
      expect(screen.getByText("Reports")).toBeDefined()
    })
  })

  it("renders all 8 primary financial metrics with accurate formatted values", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases")).toBeDefined()
      expect(screen.getByText("Wholesale Sales")).toBeDefined()
      expect(screen.getByText("Realized Profit")).toBeDefined()
      expect(screen.getByText("Current Inventory")).toBeDefined()
      expect(screen.getByText("We Owe Dealers")).toBeDefined()
      expect(screen.getByText("Resellers Owe Us")).toBeDefined()
      expect(screen.getByText("Net Cash Flow")).toBeDefined()
      expect(screen.getAllByText("General Delivery").length).toBeGreaterThanOrEqual(1)
    })

    // Financial values verified:
    // Purchases: 23,300 -> ₹23,300.00
    expect(screen.getAllByText("₹23,300.00").length).toBeGreaterThanOrEqual(1)
    // Wholesale sales: 45,000 -> ₹45,000.00
    expect(screen.getAllByText("₹45,000.00").length).toBeGreaterThanOrEqual(1)
    // Profit: 12,000 -> ₹12,000.00
    expect(screen.getAllByText("₹12,000.00").length).toBeGreaterThanOrEqual(1)
    // Inventory: 125,000 -> ₹1,25,000.00
    expect(screen.getAllByText("₹1,25,000.00").length).toBeGreaterThanOrEqual(1)
    // Payable: 300 -> ₹300.00
    expect(screen.getAllByText("₹300.00").length).toBeGreaterThanOrEqual(1)
    // Receivable: 5,000 -> ₹5,000.00
    expect(screen.getAllByText("₹5,000.00").length).toBeGreaterThanOrEqual(1)
  })

  it("renders secondary sections for top dealer/reseller positions, inventory, and deliveries", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Top Dealer Payables")).toBeDefined()
      expect(screen.getByText("Top Reseller Receivables")).toBeDefined()
      expect(screen.getByText("Inventory Overview")).toBeDefined()
      expect(screen.getByText("Recent Business Activity")).toBeDefined()
    })

    // Dealer Al Infaq
    expect(screen.getAllByText("Al Infaq").length).toBeGreaterThanOrEqual(1)
    // Reseller Kashmir Traders
    expect(screen.getAllByText("Kashmir Traders").length).toBeGreaterThanOrEqual(1)
  })
})
