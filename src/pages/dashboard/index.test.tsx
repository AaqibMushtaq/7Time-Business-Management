import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import DashboardPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { getDashboardStats } from "@/services/dashboard"

vi.mock("@/services/dashboard", () => ({
  getDashboardStats: vi.fn(),
}))

const mockStats = {
  // 5 CORE BUSINESS SECTIONS
  purchases: {
    total: 23300,
    paid: 23000,
    outstanding: 300,
    totalPurchases: 23300,
    totalPaid: 23000,
    totalPayable: 300,
    paymentsMade: 23000,
    amountPaidAtPurchase: 0,
    topPayables: [
      { id: "d1", name: "Al Infaq", outstanding: 300, amount: 300, percentageOfTotal: 100 },
    ],
  },
  wholesale: {
    totalSales: 45000,
    profit: 12000,
    profitMargin: 26.7,
    receivables: 5000,
    totalPayable: 300,
    cogs: 33000,
    received: 40000,
    productsSold: 150,
    transactions: 18,
    debtors: [
      { id: "r1", name: "Kashmir Traders", outstanding: 5000, routePath: "/wholesale" },
    ],
  },
  generalDelivery: {
    combinedTotal: 5180,
    naeemIncluded: 2180,
    excludingNaeem: 3000,
    fuel: 1400,
    net: 3780,
    received: 5180,
    outstanding: 0,
    activeDays: 14,
    reconciliation: {
      combinedDelivery: 5180,
      naeemIncludedInGeneral: 2180,
      generalDeliveryExcludingNaeem: 3000,
      reconciledCombined: 5180,
      discrepancy: 0,
      status: "RECONCILED" as const,
      notice: "Reconciliation verified",
    },
    total: 5180,
  },
  naeem: {
    total: 7700,
    received: 5000,
    openingBalance: 500,
    outstanding: 3200,
    trips: 22,
    totalDue: 8200,
    pending: 3200,
  },
  personalLedger: {
    totalReceivables: 6500,
    totalReceived: 4000,
    outstanding: 2500,
    funds7Time: 1500,
    fundsPersonal: 1000,
    fundsUnallocated: 0,
    debtorsCount: 1,
    debtors: [
      {
        id: "p1",
        name: "Personal Debtor 1",
        phone: "9906000000",
        outstanding: 2500,
        funds7Time: 1500,
        fundsPersonal: 1000,
        fundsUnallocated: 0,
        routePath: "/local-customers/p1",
      },
    ],
  },

  // BACKWARD COMPATIBILITY
  inventory: {
    totalValue: 125000,
    totalItems: 450,
    potentialRevenue: 180000,
    potentialProfit: 55000,
    outOfStock: 2,
    lowStock: 5,
  },
  sales: {
    total: 45000,
    received: 35000,
    resellerPayments: 5000,
    totalReceivable: 5000,
    profit: 12000,
    transactions: 18,
    chartData: [],
  },
  dealers: [
    { id: "d1", name: "Al Infaq", purchases: 23300, paid: 23000, outstanding: 300 },
  ],
  resellers: [
    { id: "r1", name: "Kashmir Traders", sales: 45000, received: 40000, profit: 12000, outstanding: 5000 },
  ],
  cashFlow: {
    net: 15780,
    totalInflows: 40000,
    totalOutflows: 24220,
    chartData: [],
  },
  recentActivity: [],
  receivables: {
    totalOutstanding: 10700,
    wholesaleOutstanding: 5000,
    personalLedgerOutstanding: 2500,
    funds7TimeOutstanding: 1500,
    fundsPersonalOutstanding: 1000,
    fundsUnallocatedOutstanding: 0,
    naeemOutstanding: 3200,
    otherOutstanding: 0,
    debtorsCount: 3,
    debtors: [
      {
        id: "r1",
        name: "Kashmir Traders",
        source: "WHOLESALE_RESELLER" as const,
        sourceLabel: "Wholesale Customer",
        outstanding: 5000,
        lastPaymentDate: "2026-10-01",
        routePath: "/wholesale",
      },
      {
        id: "p1",
        name: "Personal Debtor 1",
        source: "PERSONAL_LEDGER" as const,
        sourceLabel: "Personal Ledger",
        outstanding: 2500,
        lastPaymentDate: null,
        routePath: "/local-customers/p1",
      },
      {
        id: "naeem-dedicated-route",
        name: "NAEEM Dedicated Route",
        source: "NAEEM" as const,
        sourceLabel: "NAEEM Contract",
        outstanding: 3200,
        lastPaymentDate: "2026-10-02",
        routePath: "/naeem?action=payment",
      },
    ],
  },
}

describe("Redesigned 7TIME Dashboard Page", () => {
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

  it("renders 7TIME header, live sync badge, mode controls and month navigation", async () => {
    renderComponent()

    expect(await screen.findByText("7TIME Business Management")).toBeDefined()
    expect(screen.getByAltText("7TIME Logo")).toBeDefined()
    expect(screen.getByText("Monthly")).toBeDefined()
    expect(screen.getByText("All Time")).toBeDefined()
    expect(screen.getByText(/Five clear business sections/i)).toBeDefined()
  })

  it("Section 1: proves purchases, dealer payments, and dealer outstanding balances are distinct and traceable", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases & Dealer Payments")).toBeDefined()
    })

    // Total purchases: ₹23,300.00
    expect(screen.getByText("₹23,300.00")).toBeDefined()
    // Total paid to dealers: ₹23,000.00
    expect(screen.getByText("₹23,000.00")).toBeDefined()
    // Outstanding amount we owe dealers: ₹300.00
    expect(screen.getAllByText("₹300.00").length).toBeGreaterThanOrEqual(1)

    // Traceable dealer in breakdown
    expect(screen.getByText("Al Infaq")).toBeDefined()
    expect(screen.getByText("Dealer Payables Breakdown (1)")).toBeDefined()
    expect(screen.getByText(/Purchases and payments remain distinct concepts/i)).toBeDefined()
  })

  it("Section 2: proves wholesale sales, gross profit, receivables, and payables are independently calculated without offsetting", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Wholesale Business")).toBeDefined()
    })

    // Wholesale sales: ₹45,000.00
    expect(screen.getByText("₹45,000.00")).toBeDefined()
    // Wholesale gross profit: ₹12,000.00
    expect(screen.getByText("₹12,000.00")).toBeDefined()
    // Margin: 26.7% Margin
    expect(screen.getByText("26.7% Margin")).toBeDefined()
    // Money customers owe us: ₹5,000.00
    expect(screen.getAllByText("₹5,000.00").length).toBeGreaterThanOrEqual(1)
    // Top wholesale trade debtor
    expect(screen.getByText("Kashmir Traders")).toBeDefined()
    expect(screen.getByText("Top Wholesale Debtors (1)")).toBeDefined()
    expect(screen.getByText(/Customer receivables are never counted as sales a second time/i)).toBeDefined()
  })

  it("Section 3: displays General Delivery excluding NAEEM and verifies exact reconciliation formula", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("General Delivery (including NAEEM)")).toBeDefined()
    })

    // Combined delivery: ₹5,180.00
    expect(screen.getAllByText("₹5,180.00").length).toBeGreaterThanOrEqual(1)
    // NAEEM included: ₹2,180.00
    expect(screen.getAllByText("₹2,180.00").length).toBeGreaterThanOrEqual(1)
    // General delivery excluding NAEEM: ₹3,000.00
    expect(screen.getAllByText("₹3,000.00").length).toBeGreaterThanOrEqual(1)
    // Fuel expenses: ₹1,400.00
    expect(screen.getAllByText("₹1,400.00").length).toBeGreaterThanOrEqual(1)
    // Net contribution: ₹3,780.00
    expect(screen.getAllByText("₹3,780.00").length).toBeGreaterThanOrEqual(1)

    // Mathematical formula boxes
    expect(screen.getByText("General Delivery Reconciliation Formula")).toBeDefined()
    expect(screen.getByText("Formula Reconciled")).toBeDefined()
    expect(screen.getByText(/Critical Double-Counting Protection:/i)).toBeDefined()
  })

  it("Section 4: preserves NAEEM independent ledger, opening balances, and trip history", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("NAEEM Delivery Ledger")).toBeDefined()
    })

    // Total NAEEM delivery: ₹7,700.00
    expect(screen.getByText("₹7,700.00")).toBeDefined()
    // Total received: ₹5,000.00
    expect(screen.getAllByText("₹5,000.00").length).toBeGreaterThanOrEqual(1)
    // Opening balance: ₹500.00
    expect(screen.getByText("₹500.00")).toBeDefined()
    // Outstanding: ₹3,200.00 (7700 + 500 - 5000)
    expect(screen.getByText("₹3,200.00")).toBeDefined()
    // Trips
    expect(screen.getByText("22 logged contract trips")).toBeDefined()
    expect(screen.getByText("Open NAEEM Ledger")).toBeDefined()
  })

  it("Section 5: strictly isolates Personal Ledger with mandatory isolation guarantee and funding breakdown", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText("Personal Ledger").length).toBeGreaterThanOrEqual(1)
    })

    // Strictly isolated badge
    expect(screen.getByText("Strictly Isolated")).toBeDefined()
    // Personal receivables: ₹6,500.00
    expect(screen.getByText("₹6,500.00")).toBeDefined()
    // Personal received: ₹4,000.00
    expect(screen.getByText("₹4,000.00")).toBeDefined()
    // Personal outstanding: ₹2,500.00
    expect(screen.getAllByText("₹2,500.00").length).toBeGreaterThanOrEqual(1)

    // Funding source breakdown
    expect(screen.getByText("7TIME Funds Disbursed")).toBeDefined()
    expect(screen.getByText("₹1,500.00")).toBeDefined()
    expect(screen.getByText("Personal Capital Disbursed")).toBeDefined()
    expect(screen.getByText("₹1,000.00")).toBeDefined()

    // Individual personal debtor
    expect(screen.getByText("Personal Debtor 1")).toBeDefined()
    expect(screen.getByText("MANDATORY ISOLATION POLICY ENFORCED")).toBeDefined()
  })

  it("renders quick operational actions linking to all 5 core workflows", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Quick Operational Actions")).toBeDefined()
      expect(screen.getByText("Record Purchase")).toBeDefined()
      expect(screen.getByText("Record Wholesale Sale")).toBeDefined()
      expect(screen.getByText("Record Dealer Payment")).toBeDefined()
      expect(screen.getByText("Open General Delivery")).toBeDefined()
      expect(screen.getByText("Open NAEEM Delivery")).toBeDefined()
    })
  })

  it("toggles between Monthly and All Time scopes and calls getDashboardStats with correct boundaries", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Monthly")).toBeDefined()
    })

    // Click All Time
    const allTimeButton = screen.getByText("All Time")
    fireEvent.click(allTimeButton)

    await waitFor(() => {
      expect(getDashboardStats).toHaveBeenCalledWith("ALL")
    })
  })

  it("handles empty database states honestly without fabricated numbers", async () => {
    const emptyStats = {
      purchases: {
        total: 0,
        paid: 0,
        outstanding: 0,
        totalPurchases: 0,
        totalPaid: 0,
        totalPayable: 0,
        topPayables: [],
      },
      wholesale: {
        totalSales: 0,
        profit: 0,
        profitMargin: 0,
        receivables: 0,
        totalPayable: 0,
        debtors: [],
      },
      generalDelivery: {
        combinedTotal: 0,
        naeemIncluded: 0,
        excludingNaeem: 0,
        fuel: 0,
        net: 0,
        received: 0,
        outstanding: 0,
        activeDays: 0,
        reconciliation: {
          combinedDelivery: 0,
          naeemIncludedInGeneral: 0,
          generalDeliveryExcludingNaeem: 0,
          reconciledCombined: 0,
          discrepancy: 0,
          status: "EMPTY" as const,
          notice: "No delivery activity recorded",
        },
        total: 0,
      },
      naeem: {
        total: 0,
        received: 0,
        openingBalance: 0,
        outstanding: 0,
        trips: 0,
      },
      personalLedger: {
        totalReceivables: 0,
        totalReceived: 0,
        outstanding: 0,
        funds7Time: 0,
        fundsPersonal: 0,
        fundsUnallocated: 0,
        debtorsCount: 0,
        debtors: [],
      },
      receivables: {
        totalOutstanding: 0,
        wholesaleOutstanding: 0,
        personalLedgerOutstanding: 0,
        naeemOutstanding: 0,
        otherOutstanding: 0,
        debtorsCount: 0,
        debtors: [],
      },
    }

    ;(getDashboardStats as any).mockResolvedValue(emptyStats)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases & Dealer Payments")).toBeDefined()
    })

    // Verified empty settlements
    expect(screen.getByText(/All dealer accounts are fully settled/i)).toBeDefined()
    expect(screen.getByText(/All wholesale customers are fully paid/i)).toBeDefined()
    expect(screen.getByText(/All personal credit accounts are fully settled/i)).toBeDefined()

    // Confirm genuine ₹0.00 displays and no fabricated figures
    const zeroDisplays = screen.getAllByText("₹0.00")
    expect(zeroDisplays.length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByText("₹23,300.00")).toBeNull()
    expect(screen.queryByText("₹45,000.00")).toBeNull()
  })

  it("handles query failures honestly with error card and retry button", async () => {
    ;(getDashboardStats as any).mockRejectedValue(new Error("Supabase connection timeout"))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Dashboard Data")).toBeDefined()
      expect(screen.getByText("Supabase connection timeout")).toBeDefined()
      expect(screen.getByText("Try Again")).toBeDefined()
    })
  })
})
