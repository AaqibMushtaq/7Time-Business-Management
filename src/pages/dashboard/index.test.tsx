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
    totalPaidToDealers: 23000,
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
    payables: 300,
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

describe("Phase 16: Cards-Only 7TIME Dashboard Page", () => {
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

  it("renders 7TIME header, live sync badge, mode controls and subtitle", async () => {
    renderComponent()

    expect(await screen.findByText("7TIME Business Management")).toBeDefined()
    expect(screen.getByAltText("7TIME Logo")).toBeDefined()
    expect(screen.getByText("Monthly")).toBeDefined()
    expect(screen.getByText("All Time")).toBeDefined()
    expect(screen.getByText(/Five clear business sections/i)).toBeDefined()
  })

  it("renders the 5 approved compact business summary cards with live figures", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /Executive Financial Overview/i })).toBeDefined()
    })

    // CARD 1: Purchases & Dealer Payments
    const card1 = screen.getByRole("region", { name: "Summary Card 1: Purchases & Dealer Payments" })
    expect(card1).toBeDefined()
    expect(card1.textContent).toContain("Purchases & Dealers")
    expect(card1.textContent).toContain("₹23,300.00") // Total Purchases
    expect(card1.textContent).toContain("Paid to Dealers")
    expect(card1.textContent).toContain("₹23,000.00")
    expect(card1.textContent).toContain("Outstanding Payables")
    expect(card1.textContent).toContain("₹300.00")

    // CARD 2: Wholesale Business
    const card2 = screen.getByRole("region", { name: "Summary Card 2: Wholesale Business" })
    expect(card2).toBeDefined()
    expect(card2.textContent).toContain("Wholesale Business")
    expect(card2.textContent).toContain("₹45,000.00") // Wholesale Sales
    expect(card2.textContent).toContain("Gross Profit (26.7%)")
    expect(card2.textContent).toContain("₹12,000.00")
    expect(card2.textContent).toContain("Customer Receivables")
    expect(card2.textContent).toContain("₹5,000.00")
    expect(card2.textContent).toContain("Supplier Payables")
    expect(card2.textContent).toContain("₹300.00")

    // CARD 3: General Delivery
    const card3 = screen.getByRole("region", { name: "Summary Card 3: General Delivery" })
    expect(card3).toBeDefined()
    expect(card3.textContent).toContain("General Delivery")
    expect(card3.textContent).toContain("₹5,180.00") // Combined Delivery
    expect(card3.textContent).toContain("Excl. NAEEM")
    expect(card3.textContent).toContain("₹3,000.00")
    expect(card3.textContent).toContain("Fuel Expenses")
    expect(card3.textContent).toContain("₹1,400.00")
    expect(card3.textContent).toContain("Net Contribution")
    expect(card3.textContent).toContain("₹3,780.00")

    // CARD 4: NAEEM Delivery
    const card4 = screen.getByRole("region", { name: "Summary Card 4: NAEEM Delivery" })
    expect(card4).toBeDefined()
    expect(card4.textContent).toContain("NAEEM Delivery")
    expect(card4.textContent).toContain("₹7,700.00") // Total Delivery
    expect(card4.textContent).toContain("Total Received")
    expect(card4.textContent).toContain("₹5,000.00")
    expect(card4.textContent).toContain("Outstanding Balance")
    expect(card4.textContent).toContain("₹3,200.00")

    // CARD 5: Personal Ledger
    const card5 = screen.getByRole("region", { name: "Summary Card 5: Personal Ledger" })
    expect(card5).toBeDefined()
    expect(card5.textContent).toContain("Personal Ledger")
    expect(card5.textContent).toContain("Isolated")
    expect(card5.textContent).toContain("₹6,500.00") // Personal Receivables
    expect(card5.textContent).toContain("Amount Received")
    expect(card5.textContent).toContain("₹4,000.00")
    expect(card5.textContent).toContain("Outstanding Balances")
    expect(card5.textContent).toContain("₹2,500.00")
  })

  it("ensures each compact summary card provides View details link to the correct destination", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /Executive Financial Overview/i })).toBeDefined()
    })

    const card1 = screen.getByRole("region", { name: "Summary Card 1: Purchases & Dealer Payments" })
    expect(card1.querySelector("a[href='/dealers']")).toBeDefined()

    const card2 = screen.getByRole("region", { name: "Summary Card 2: Wholesale Business" })
    expect(card2.querySelector("a[href='/wholesale']")).toBeDefined()

    const card3 = screen.getByRole("region", { name: "Summary Card 3: General Delivery" })
    expect(card3.querySelector("a[href='/general-deliveries']")).toBeDefined()

    const card4 = screen.getByRole("region", { name: "Summary Card 4: NAEEM Delivery" })
    expect(card4.querySelector("a[href='/naeem']")).toBeDefined()

    const card5 = screen.getByRole("region", { name: "Summary Card 5: Personal Ledger" })
    expect(card5.querySelector("a[href='/local-customers']")).toBeDefined()
  })

  it("Phase 16 cleanup: verifies Quick Operational Actions and Detailed Ledgers & Audit Reconciliation are completely removed", async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /Executive Financial Overview/i })).toBeDefined()
    })

    // Quick Operational Actions must NOT be present
    expect(screen.queryByText("Quick Operational Actions")).toBeNull()
    expect(screen.queryByText("Record Purchase")).toBeNull()
    expect(screen.queryByText("Record Wholesale Sale")).toBeNull()
    expect(screen.queryByText("Record Dealer Payment")).toBeNull()
    expect(screen.queryByText("Open General Delivery")).toBeNull()
    expect(screen.queryByText("Open NAEEM Delivery")).toBeNull()

    // Detailed Ledgers & Audit Reconciliation drawer must NOT be present
    expect(screen.queryByText("Detailed Ledgers & Audit Reconciliation")).toBeNull()
    expect(screen.queryByText("General Delivery Reconciliation Formula")).toBeNull()
    expect(screen.queryByText("Critical Double-Counting Protection:")).toBeNull()
    expect(screen.queryByText("Dealer Payables Breakdown (1)")).toBeNull()
    expect(screen.queryByText("Top Wholesale Debtors (1)")).toBeNull()
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

    // Click back to Monthly
    const monthlyButton = screen.getByText("Monthly")
    fireEvent.click(monthlyButton)

    await waitFor(() => {
      expect(getDashboardStats).toHaveBeenCalledWith("CUSTOM", expect.any(String), expect.any(String))
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
      expect(screen.getByRole("region", { name: /Executive Financial Overview/i })).toBeDefined()
    })

    // Confirm genuine ₹0.00 displays across all 5 cards
    const zeroDisplays = screen.getAllByText("₹0.00")
    expect(zeroDisplays.length).toBeGreaterThanOrEqual(10)
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
