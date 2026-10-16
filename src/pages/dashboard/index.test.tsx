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
  receivables: {
    totalOutstanding: 7700,
    wholesaleOutstanding: 5000,
    naeemOutstanding: 2700,
    otherOutstanding: 0,
    debtorsCount: 2,
    debtors: [
      {
        id: "r1",
        name: "Kashmir Traders",
        source: "WHOLESALE_RESELLER" as const,
        sourceLabel: "Wholesale Reseller",
        outstanding: 5000,
        lastPaymentDate: "2026-10-01",
        routePath: "/resellers/r1",
      },
      {
        id: "naeem-dedicated-route",
        name: "NAEEM Dedicated Route",
        source: "NAEEM" as const,
        sourceLabel: "NAEEM Contract",
        outstanding: 2700,
        lastPaymentDate: "2026-10-02",
        routePath: "/naeem?action=payment",
      },
    ],
  },
  monthlyTrends: [
    {
      month: "2026-05",
      monthLabel: "May 2026",
      shortLabel: "May '26",
      purchases: 20000,
      sales: 30000,
      profit: 8000,
      cogs: 22000,
      cashReceived: 28000,
      cashPaid: 18000,
      netCash: 10000,
    },
    {
      month: "2026-10",
      monthLabel: "October 2026",
      shortLabel: "Oct '26",
      purchases: 23300,
      sales: 45000,
      profit: 12000,
      cogs: 33000,
      cashReceived: 40000,
      cashPaid: 23000,
      netCash: 17000,
    },
  ],
  insights: {
    comparisonMonthLabel: "September 2026",
    salesMoM: {
      current: 45000,
      previous: 30000,
      changeAmount: 15000,
      changePercentage: 50,
      trend: "UP" as const,
      label: "+50.0% vs prior month",
    },
    grossProfitMoM: {
      current: 12000,
      previous: 8000,
      changeAmount: 4000,
      changePercentage: 50,
      trend: "UP" as const,
      label: "+50.0% vs prior month",
    },
    wholesaleMargin: {
      marginPercentage: 26.7,
      status: "HEALTHY" as const,
      label: "Healthy Margin",
    },
    cashCollectionRatio: {
      ratioPercentage: 88.9,
      totalCashCollected: 40000,
      totalSales: 45000,
      label: "Strong Inflow",
    },
    supplierActivity: {
      purchases: 23300,
      payments: 23000,
      netObligationChange: 300,
      cumulativePayable: 300,
    },
    fleetContribution: {
      billed: 5180,
      fuel: 1400,
      netContribution: 3780,
      activeDays: 14,
    },
    topExposureDebtors: [
      {
        id: "r1",
        name: "Kashmir Traders",
        amount: 5000,
        sourceLabel: "Wholesale Reseller",
        routePath: "/resellers/r1",
      },
    ],
  },
  balancesBreakdown: {
    receivables: {
      total: 7700,
      wholesale: 5000,
      personalLedger: 0,
      personalLedger7Time: 0,
      personalLedgerPersonal: 0,
      personalLedgerUnallocated: 0,
      naeem: 2700,
      other: 0,
    },
    payables: {
      total: 300,
      dealersCount: 1,
      topPayables: [
        {
          id: "d1",
          name: "Al Infaq",
          amount: 300,
          percentageOfTotal: 100,
        },
      ],
    },
    netWorkingPosition: 7400,
  },
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

  it("renders all 8 executive KPI cards with accurate formatted values", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases")).toBeDefined()
      expect(screen.getByText("Wholesale Sales")).toBeDefined()
      expect(screen.getByText("Wholesale Gross Profit")).toBeDefined()
      expect(screen.getAllByText("General Delivery").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Cash In")).toBeDefined()
      expect(screen.getByText("Cash Out")).toBeDefined()
      expect(screen.getByText("Total Receivables")).toBeDefined()
      expect(screen.getByText("Total Payables")).toBeDefined()
    })

    // Purchases: 23,300 -> ₹23,300.00
    expect(screen.getAllByText("₹23,300.00").length).toBeGreaterThanOrEqual(1)
    // Wholesale Sales: 45,000 -> ₹45,000.00
    expect(screen.getAllByText("₹45,000.00").length).toBeGreaterThanOrEqual(1)
    // Wholesale Gross Profit: 12,000 -> ₹12,000.00
    expect(screen.getAllByText("₹12,000.00").length).toBeGreaterThanOrEqual(1)
    // General Delivery Net: 3,780 -> ₹3,780.00
    expect(screen.getAllByText("₹3,780.00").length).toBeGreaterThanOrEqual(1)
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
    expect(screen.getAllByText("General Delivery").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("NAEEM Dedicated").length).toBeGreaterThanOrEqual(1)
  })

  it("renders dedicated Wholesale and Delivery performance sections with operational breakdowns", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Wholesale Distribution Performance")).toBeDefined()
      expect(screen.getByText("Cost of Goods Sold")).toBeDefined()
      expect(screen.getByText("Cash Collected at Dispatch")).toBeDefined()
      expect(screen.getByText("Uncollected Trade Credit")).toBeDefined()
      expect(screen.getByText("Delivery & Fleet Operations")).toBeDefined()
      expect(screen.getByText("Contribution after fuel:")).toBeDefined()
    })
  })

  it("renders compact Outstanding Receivables and Payments to Make sections with unified balances and debtors", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Outstanding Receivables")).toBeDefined()
      expect(screen.getByText("Payments to Make")).toBeDefined()
      expect(screen.getByText("Wholesale/Resellers")).toBeDefined()
      expect(screen.getAllByText("NAEEM Dedicated").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Other Receivables")).toBeDefined()
      expect(screen.getByText("Manage Dealers")).toBeDefined()
    })

    // Dealer Al Infaq
    expect(screen.getAllByText("Al Infaq").length).toBeGreaterThanOrEqual(1)
    // Reseller Kashmir Traders
    expect(screen.getAllByText("Kashmir Traders").length).toBeGreaterThanOrEqual(1)
    // NAEEM Dedicated debtor
    expect(screen.getAllByText("NAEEM Dedicated Route").length).toBeGreaterThanOrEqual(1)
    // Receive payment button available
    expect(screen.getAllByText("Receive").length).toBeGreaterThanOrEqual(1)
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
      receivables: {
        totalOutstanding: 0,
        wholesaleOutstanding: 0,
        naeemOutstanding: 0,
        otherOutstanding: 0,
        debtorsCount: 0,
        debtors: [],
      },
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

  it("renders Business Performance Insights with MoM changes, gross margin %, and follow-up debtors", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Business Performance Insights")).toBeDefined()
      expect(screen.getByText("VERIFIED METRICS")).toBeDefined()
      expect(screen.getByText("Wholesale Sales MoM")).toBeDefined()
      expect(screen.getByText("Wholesale Gross Profit MoM")).toBeDefined()
      expect(screen.getByText("Cash Collected vs Wholesale Sales")).toBeDefined()
      expect(screen.getByText("Supplier Payables Activity")).toBeDefined()
      expect(screen.getByText("General Delivery Fleet Activity")).toBeDefined()
      expect(screen.getByText("Follow-up Priority (Largest Balances)")).toBeDefined()
    })

    // Check MoM % badges and margin text
    expect(screen.getAllByText("+50.0%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("26.7% margin")).toBeDefined()
    expect(screen.getByText("88.9%")).toBeDefined()
    expect(screen.getByText("Strong Inflow")).toBeDefined()
    expect(screen.getByText("Net Contribution After Fuel:")).toBeDefined()
  })

  it("renders Outstanding Balances & Exposure Breakdown card with non-netting enforcement and reconciled balance claims", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Outstanding Balances & Exposure Breakdown")).toBeDefined()
      expect(screen.getByText("Strict Non-Netting Enforced")).toBeDefined()
      expect(screen.getByText("Total Receivables (They Owe Us)")).toBeDefined()
      expect(screen.getByText("Total Payables (We Owe Suppliers)")).toBeDefined()
      expect(screen.getByText("Net Outstanding Position")).toBeDefined()
    })

    // Receivables breakdown labels
    expect(screen.getByText("Wholesale Trade Receivables")).toBeDefined()
    expect(screen.getByText("NAEEM Dedicated Route Contract")).toBeDefined()
    // Net working capital: ₹7,700 - ₹300 = ₹7,400 -> ₹7,400.00
    expect(screen.getAllByText("₹7,400.00").length).toBeGreaterThanOrEqual(1)
  })

  it("strictly enforces dynamic data only: displays genuine zero/empty states with zero fabricated numbers or fallback balances when database has zero records", async () => {
    const zeroStats = {
      inventory: {
        totalValue: 0,
        totalItems: 0,
        potentialRevenue: 0,
        potentialProfit: 0,
        outOfStock: 0,
        lowStock: 0,
      },
      purchases: {
        total: 0,
        paymentsMade: 0,
        amountPaidAtPurchase: 0,
        totalPayable: 0,
      },
      sales: {
        total: 0,
        received: 0,
        resellerPayments: 0,
        totalReceivable: 0,
        profit: 0,
        transactions: 0,
        chartData: [],
      },
      dealers: [],
      resellers: [],
      generalDelivery: {
        activeDays: 0,
        total: 0,
        fuel: 0,
        net: 0,
      },
      naeem: {
        trips: 0,
        total: 0,
        received: 0,
        pending: 0,
      },
      cashFlow: {
        net: 0,
        totalInflows: 0,
        totalOutflows: 0,
        chartData: [],
      },
      recentActivity: [],
      receivables: {
        totalOutstanding: 0,
        wholesaleOutstanding: 0,
        naeemOutstanding: 0,
        otherOutstanding: 0,
        debtorsCount: 0,
        debtors: [],
      },
      monthlyTrends: [],
      insights: {
        comparisonMonthLabel: "Prior Month",
        salesMoM: {
          current: 0,
          previous: 0,
          changeAmount: 0,
          changePercentage: null,
          trend: "FLAT" as const,
          label: "Baseline",
        },
        grossProfitMoM: {
          current: 0,
          previous: 0,
          changeAmount: 0,
          changePercentage: null,
          trend: "FLAT" as const,
          label: "Baseline",
        },
        wholesaleMargin: {
          marginPercentage: 0,
          status: "NO_SALES" as const,
          label: "No Sales",
        },
        cashCollectionRatio: {
          ratioPercentage: null,
          totalCashCollected: 0,
          totalSales: 0,
          label: "No Sales",
        },
        supplierActivity: {
          purchases: 0,
          payments: 0,
          netObligationChange: 0,
          cumulativePayable: 0,
        },
        fleetContribution: {
          billed: 0,
          fuel: 0,
          netContribution: 0,
          activeDays: 0,
        },
        topExposureDebtors: [],
      },
      balancesBreakdown: {
        receivables: {
          total: 0,
          wholesale: 0,
          personalLedger: 0,
          personalLedger7Time: 0,
          personalLedgerPersonal: 0,
          personalLedgerUnallocated: 0,
          naeem: 0,
          other: 0,
        },
        payables: {
          total: 0,
          dealersCount: 0,
          topPayables: [],
        },
        netWorkingPosition: 0,
      },
    }
    ;(getDashboardStats as any).mockResolvedValue(zeroStats)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("Total Purchases")).toBeDefined()
    })

    // 1. KPI cards show genuine ₹0.00
    const zeroDisplays = screen.getAllByText("₹0.00")
    expect(zeroDisplays.length).toBeGreaterThanOrEqual(6)

    // 2. Confirmed zero fabricated rupee amounts appear anywhere in the document
    expect(screen.queryByText("₹23,300.00")).toBeNull()
    expect(screen.queryByText("₹45,000.00")).toBeNull()
    expect(screen.queryByText("₹10,000.00")).toBeNull()
    expect(screen.queryByText("₹8,000.00")).toBeNull()
    expect(screen.queryByText("₹12,000.00")).toBeNull()

    // 3. Confirmed no fabricated customer or dealer entities appear
    expect(screen.queryByText("Al Infaq")).toBeNull()
    expect(screen.queryByText("Kashmir Traders")).toBeNull()

    // 4. Honest empty states are properly displayed
    expect(screen.getByText("All customer accounts are settled.")).toBeDefined()
    expect(screen.getByText("All supplier accounts are settled.")).toBeDefined()
    expect(screen.getByText("No Historical Financial Activity Recorded")).toBeDefined()
    expect(screen.getByText("No active receivables")).toBeDefined()
    expect(screen.getByText("All supplier accounts settled")).toBeDefined()
  })
})
