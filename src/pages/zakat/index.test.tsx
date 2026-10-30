import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ZakatPage from "./index"
import * as zakatService from "@/services/zakatService"
import type { ZakatWealthEntryRow, ZakatUserSettingsRow, ZakatEvaluationOutput } from "@/types/zakat"

// Mock useAuth hook
vi.mock("@/components/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-123", email: "user@7time.com" },
    signOut: vi.fn(),
  }),
}))

// Mock zakatService
vi.mock("@/services/zakatService", () => ({
  fetchWealthEntries: vi.fn(),
  fetchUserSettings: vi.fn(),
  fetchDailyMetalRates: vi.fn(),
  evaluateLiveUserZakat: vi.fn(),
  deleteOrdinaryEntry: vi.fn(),
  deletePairedConversion: vi.fn(),
  insertOrdinaryEntry: vi.fn(),
  createPairedConversion: vi.fn(),
  saveUserSettings: vi.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

describe("ZakatPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockEvaluation: ZakatEvaluationOutput = {
    evaluationDate: "2026-10-30",
    balances: {
      cashAndBank: 150000,
      goldValuation: 75000,
      silverValuation: 10000,
      businessInventory: 50000,
      strongReceivables: 20000,
      investments: 0,
      otherEligibleAssets: 0,
      totalEligibleAssets: 305000,
      deductibleLiabilities: 30000,
      netEligibleWealth: 275000,
      nonDeductibleLiabilities: 0,
      excludedDoubtfulReceivables: 0,
      totalPureGoldGrams: 9.375,
      totalPureSilverGrams: 111.11,
    },
    nisabStandardUsed: "SILVER",
    nisabGramsUsed: 612.36,
    ratePerGramUsed: 90.0,
    nisabValueInr: 55112.4,
    isNisabMet: true,
    amountAboveOrBelowNisab: 219887.6,
    nisabProgressPercent: 498.98,
    hawlStatus: "HAWL_COMPLETED_DUE",
    hawlStartDate: "2025-10-01",
    hawlAnniversaryDate: "2026-09-20",
    hijriStartDate: { day: 9, month: 4, year: 1447, monthName: "Rabi' al-Thani", formatted: "9 Rabi' al-Thani 1447 AH" },
    hijriAnniversaryDate: { day: 9, month: 4, year: 1448, monthName: "Rabi' al-Thani", formatted: "9 Rabi' al-Thani 1448 AH" },
    daysRemainingInHawl: 0,
    estimatedZakatDue: 6875,
    rateSourceStatus: "LIVE",
  }

  const mockRates = {
    silverRate: 90.0,
    goldRate: 8000.0,
    silverStatus: "LIVE" as const,
    goldStatus: "LIVE" as const,
  }

  const mockSettings: ZakatUserSettingsRow = {
    user_id: "test-user-123",
    preferred_nisab_standard: "SILVER",
    silver_nisab_grams: 612.36,
    gold_nisab_grams: 87.48,
    hijri_day_offset: 0,
    custom_hawl_start_date: "2025-10-01",
    is_hawl_start_date_confirmed: true,
    created_at: "2025-10-01T00:00:00Z",
    updated_at: "2025-10-01T00:00:00Z",
  }

  const mockEntries: ZakatWealthEntryRow[] = [
    {
      id: "entry-1",
      user_id: "test-user-123",
      entry_date: "2026-10-01",
      entry_type: "ACQUIRED",
      category: "CASH",
      source: "Salary",
      amount_inr: 150000,
      quantity: null,
      purity_carat: null,
      linked_entry_id: null,
      description: "October Salary Savings",
      notes: null,
      correction_of_entry_id: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "entry-2",
      user_id: "test-user-123",
      entry_date: "2026-10-15",
      entry_type: "CONVERSION",
      category: "GOLD",
      source: "Jewelry Purchase",
      amount_inr: 75000,
      quantity: 9.375,
      purity_carat: 24,
      linked_entry_id: "entry-3",
      description: "[Conversion In] Gold Bullion",
      notes: null,
      correction_of_entry_id: null,
      created_at: "2026-10-15T00:00:00Z",
      updated_at: "2026-10-15T00:00:00Z",
    },
  ]

  it("renders page title, Hanafi badge, and core metric summary cards", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    // Wait for content to render
    await waitFor(() => {
      expect(screen.getByText("Zakat Tracker")).toBeDefined()
    })

    // Check Hanafi badge
    expect(screen.getByText("Hanafi Fiqh Engine")).toBeDefined()

    // Check Metrics
    expect(screen.getByText("Net Eligible Wealth")).toBeDefined()
    expect(screen.getByText("Nisab Threshold (SILVER)")).toBeDefined()
    expect(screen.getByText("Hawl Status")).toBeDefined()
    expect(screen.getByText("Estimated Zakat Due (2.5%)")).toBeDefined()

    // Check Values
    expect(screen.getByText("ANNIVERSARY REACHED")).toBeDefined()
    expect(screen.getByText(/Nisab threshold satisfied/i)).toBeDefined()
  })

  it("displays metal spot rates with LIVE status tag", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("● LIVE RATES")).toBeDefined()
      expect(screen.getByText("₹8,000/g")).toBeDefined()
      expect(screen.getByText("₹90/g")).toBeDefined()
    })
  })

  it("renders ledger entries table with rows, types, and amounts", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("October Salary Savings")).toBeDefined()
      expect(screen.getByText("[Conversion In] Gold Bullion")).toBeDefined()
      expect(screen.getByText("9.375g (24k)")).toBeDefined()
    })
  })

  it("switches to Asset Breakdown tab and displays category cards", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Asset Breakdown")).toBeDefined()
    })

    // Click Asset Breakdown Tab
    fireEvent.click(screen.getByText("Asset Breakdown"))

    expect(screen.getByText("Cash & Bank Balances")).toBeDefined()
    expect(screen.getByText("Gold Assets Valuation")).toBeDefined()
    expect(screen.getByText("Silver Assets Valuation")).toBeDefined()
    expect(screen.getByText("Trade / Business Inventory")).toBeDefined()
    expect(screen.getByText("Deductible Immediate Liabilities")).toBeDefined()
  })

  it("switches to Hawl & Fiqh Rulings tab and displays lunar dates and rules", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Hawl & Fiqh Rulings")).toBeDefined()
    })

    // Click Hawl Tab
    fireEvent.click(screen.getByText("Hawl & Fiqh Rulings"))

    expect(screen.getByText("Hanafi Fiqh Hawl Methodology")).toBeDefined()
    expect(screen.getByText("Active Hawl Start Date")).toBeDefined()
    expect(screen.getByText("Hawl Anniversary (Due Date)")).toBeDefined()
    expect(screen.getByText(/Mid-Year Inflow & Zero Depletion Rules/i)).toBeDefined()
  })

  it("opens AddEntryModal when Add Wealth Entry button is clicked", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Add Wealth Entry")).toBeDefined()
    })

    fireEvent.click(screen.getByText("Add Wealth Entry"))

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined()
      expect(screen.getByText("Asset / Debt Category")).toBeDefined()
    })
  })

  it("opens TransferModal when Transfer / Convert button is clicked", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue(mockEntries)
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(mockSettings)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue(mockEvaluation)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Transfer / Convert")).toBeDefined()
    })

    fireEvent.click(screen.getByText("Transfer / Convert"))

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined()
      expect(screen.getByText(/Asset Transfer \/ Conversion/i)).toBeDefined()
      expect(screen.getByText(/Double-Entry Ledger Guarantee/i)).toBeDefined()
    })
  })

  it("renders EmptyState when entries array is empty", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockResolvedValue([])
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(null)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockResolvedValue({
      ...mockEvaluation,
      balances: {
        ...mockEvaluation.balances,
        netEligibleWealth: 0,
        totalEligibleAssets: 0,
      },
      isNisabMet: false,
      hawlStatus: "BELOW_NISAB",
      estimatedZakatDue: 0,
    })

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("No Wealth Entries Recorded")).toBeDefined()
      expect(screen.getByText("Add First Asset")).toBeDefined()
    })
  })

  it("renders ErrorState with retry button when query fails", async () => {
    vi.mocked(zakatService.fetchWealthEntries).mockRejectedValue(new Error("Database disconnected"))
    vi.mocked(zakatService.fetchUserSettings).mockResolvedValue(null)
    vi.mocked(zakatService.fetchDailyMetalRates).mockResolvedValue(mockRates)
    vi.mocked(zakatService.evaluateLiveUserZakat).mockRejectedValue(new Error("Database disconnected"))

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ZakatPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Zakat Tracker")).toBeDefined()
      expect(screen.getByRole("button", { name: /retry/i })).toBeDefined()
    })
  })
})

