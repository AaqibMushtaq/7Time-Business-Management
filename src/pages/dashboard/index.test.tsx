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
    { id: "d1", name: "Al Infaq", purchases: 23300, paid: 23000, outstanding: 300 },
  ],
  resellers: [
    { id: "r1", name: "Kashmir Traders", sales: 45000, received: 40000, profit: 12000, outstanding: 5000 },
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
  cashFlow: {
    net: 15780,
    totalInflows: 40000,
    totalOutflows: 24220,
    chartData: [],
  },
  recentActivity: [
    { id: "1", type: "PURCHASE", name: "Al Infaq", date: "2026-10-05", amount: 23300 },
  ],
}

describe("Executive DashboardPage Component", () => {
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

  it("renders executive title, badge, mode controls and month navigation", async () => {
    renderComponent()

    expect(await screen.findByText("7TIME Business Management")).toBeDefined()
    expect(screen.getByText("EXECUTIVE DASHBOARD")).toBeDefined()
    expect(screen.getByText("Monthly")).toBeDefined()
    expect(screen.getByText("All Time")).toBeDefined()
  })

  it("renders all 6 executive KPI cards with accurate formatted values", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases")).toBeDefined()
      expect(screen.getByText("Sales / Delivery Revenue")).toBeDefined()
      expect(screen.getByText("Cash In")).toBeDefined()
      expect(screen.getByText("Cash Out")).toBeDefined()
      expect(screen.getByText("Receivables")).toBeDefined()
      expect(screen.getByText("Payables")).toBeDefined()
    })

    // Purchases: 23,300 -> ₹23,300.00
    expect(screen.getAllByText("₹23,300.00").length).toBeGreaterThanOrEqual(1)
    // Revenue: 45,000 (wholesale) + 5,180 (gen delivery) + 7,700 (naeem) = 57,880 -> ₹57,880.00
    expect(screen.getAllByText("₹57,880.00").length).toBeGreaterThanOrEqual(1)
    // Payables: 300 -> ₹300.00
    expect(screen.getAllByText("₹300.00").length).toBeGreaterThanOrEqual(1)
    // Receivables: 5,000 (reseller) + 2,700 (naeem) = 7,700 -> ₹7,700.00
    expect(screen.getAllByText("₹7,700.00").length).toBeGreaterThanOrEqual(1)
  })

  it("renders the single Unified Business Performance container with 4-area breakdown", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Unified Business Performance")).toBeDefined()
      expect(screen.getByText("Dealer · Wholesale · General Delivery · NAEEM")).toBeDefined()
      expect(screen.getByLabelText("Select performance metric")).toBeDefined()
      expect(screen.getAllByText("View Reports").length).toBeGreaterThanOrEqual(1)
    })

    // Check 4-area breakdown cards
    expect(screen.getByText("Dealer Operations")).toBeDefined()
    expect(screen.getByText("Wholesale & Resellers")).toBeDefined()
    expect(screen.getByText("General Delivery")).toBeDefined()
    expect(screen.getByText("NAEEM Dedicated")).toBeDefined()
  })

  it("renders compact Accounts to Collect and Payments to Make sections with top balances", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Accounts to Collect")).toBeDefined()
      expect(screen.getByText("Payments to Make")).toBeDefined()
      expect(screen.getByText("Manage Resellers")).toBeDefined()
      expect(screen.getByText("Manage Dealers")).toBeDefined()
    })

    // Dealer Al Infaq
    expect(screen.getAllByText("Al Infaq").length).toBeGreaterThanOrEqual(1)
    // Reseller Kashmir Traders
    expect(screen.getAllByText("Kashmir Traders").length).toBeGreaterThanOrEqual(1)
  })

  it("renders compact quick action tiles linking to core operational modules", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Record Purchase")).toBeDefined()
      expect(screen.getByText("Record Wholesale Sale")).toBeDefined()
      expect(screen.getByText("Record Dealer Payment")).toBeDefined()
      expect(screen.getByText("Open General Delivery")).toBeDefined()
      expect(screen.getByText("Open NAEEM Delivery")).toBeDefined()
      expect(screen.getAllByText("View Reports").length).toBeGreaterThanOrEqual(1)
    })
  })

  it("renders honest empty states when all customer and supplier accounts are settled", async () => {
    const settledStats = {
      ...mockStats,
      dealers: [],
      resellers: [],
      purchases: { ...mockStats.purchases, totalPayable: 0 },
      sales: { ...mockStats.sales, totalReceivable: 0 },
      naeem: { ...mockStats.naeem, pending: 0 },
    }
    ;(getDashboardStats as any).mockResolvedValue(settledStats)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("All customer accounts are settled.")).toBeDefined()
      expect(screen.getByText("All supplier accounts are settled.")).toBeDefined()
    })
  })

  it("renders meaningful error state with retry button when query fails", async () => {
    ;(getDashboardStats as any).mockRejectedValue(new Error("Supabase network failure"))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Dashboard Data")).toBeDefined()
      expect(screen.getByText("Supabase network failure")).toBeDefined()
      expect(screen.getByText("Try Again")).toBeDefined()
    })
  })
})
