import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HistoricalRatesChart, CustomTooltip } from "./HistoricalRatesChart"
import * as zakatService from "@/services/zakatService"
import type { HistoricalMetalRatePoint } from "@/types/zakat"

// Mock Recharts ResponsiveContainer to ensure deterministic rendering in jsdom
vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal<typeof import("recharts")>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }} data-testid="mock-responsive-container">
        {children}
      </div>
    ),
  }
})

vi.mock("@/services/zakatService", async (importOriginal) => {
  const actual = await importOriginal<typeof zakatService>()
  return {
    ...actual,
    fetchHistoricalMetalRates: vi.fn(),
  }
})

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

const mockMultiDayData: HistoricalMetalRatePoint[] = [
  {
    date: "2026-10-24",
    goldRate: 11850.5,
    silverRate: 148.2,
    source: "GoldAPI.io",
    status: "LIVE",
  },
  {
    date: "2026-10-25",
    goldRate: 11900.0,
    silverRate: 149.0,
    source: "GoldAPI.io",
    status: "LIVE",
  },
  {
    date: "2026-10-26",
    goldRate: 11950.25,
    silverRate: 150.1,
    source: "GoldAPI.io",
    status: "LIVE",
  },
  {
    date: "2026-10-27",
    goldRate: 12000.0,
    silverRate: 150.8,
    source: "GoldAPI.io",
    status: "LIVE",
  },
  {
    date: "2026-10-30",
    goldRate: 11943.5651,
    silverRate: 150.4976,
    source: "GoldAPI.io",
    status: "LIVE",
  },
]

describe("HistoricalRatesChart Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders chart header and controls", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    expect(screen.getByText("Precious Metal Rate History")).toBeDefined()
    expect(screen.getByTestId("filter-7-days")).toBeDefined()
    expect(screen.getByTestId("filter-30-days")).toBeDefined()
    expect(screen.getByTestId("filter-both-metals")).toBeDefined()
    expect(screen.getByTestId("filter-gold-only")).toBeDefined()
    expect(screen.getByTestId("filter-silver-only")).toBeDefined()
    expect(screen.getByText(/International Spot \(INR\) via GoldAPI\.io/i)).toBeDefined()
  })

  it("renders available data immediately when 1 historical date exists without requiring 2 dates", async () => {
    const singlePointData: HistoricalMetalRatePoint[] = [
      {
        date: "2026-10-30",
        goldRate: 11943.5651,
        silverRate: 150.4976,
        source: "GoldAPI.io",
        status: "LIVE",
      },
    ]

    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(singlePointData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      // Must NOT render full empty state
      expect(screen.queryByTestId("chart-empty-state")).toBeNull()
      // MUST render active chart container with Recharts
      expect(screen.getByTestId("chart-active-container")).toBeDefined()
      expect(screen.getByTestId("mock-responsive-container")).toBeDefined()
      // MUST render subtle single-day info banner
      expect(screen.getByTestId("single-day-info-banner")).toBeDefined()
      expect(
        screen.getByText(
          "Historical tracking has started. Only one day's rates are available; trend lines will develop as additional daily rates are collected."
        )
      ).toBeDefined()
      // Footer shows latest rate date
      expect(screen.getByText("2026-10-30")).toBeDefined()
    })
  })

  it("renders full empty state ONLY when zero records are returned", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue([])

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-empty-state")).toBeDefined()
      expect(screen.getByText("No Historical Rates Recorded")).toBeDefined()
      expect(screen.queryByTestId("chart-active-container")).toBeNull()
      expect(screen.queryByTestId("single-day-info-banner")).toBeNull()
    })
  })

  it("renders active chart with multi-day data without single-day info banner", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-active-container")).toBeDefined()
      expect(screen.queryByTestId("chart-empty-state")).toBeNull()
      expect(screen.queryByTestId("single-day-info-banner")).toBeNull()
    })
  })

  it("triggers 7-day and 30-day timeframe filtering", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(zakatService.fetchHistoricalMetalRates).toHaveBeenCalledWith(30)
    })

    fireEvent.click(screen.getByTestId("filter-7-days"))

    await waitFor(() => {
      expect(zakatService.fetchHistoricalMetalRates).toHaveBeenCalledWith(7)
    })
  })

  it("switches metal series filters (Both Metals, Gold Only, Silver Only)", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-active-container")).toBeDefined()
    })

    const goldBtn = screen.getByTestId("filter-gold-only")
    const silverBtn = screen.getByTestId("filter-silver-only")
    const bothBtn = screen.getByTestId("filter-both-metals")

    fireEvent.click(goldBtn)
    expect(goldBtn.className).toContain("text-blue-700")

    fireEvent.click(silverBtn)
    expect(silverBtn.className).toContain("text-amber-800")

    fireEvent.click(bothBtn)
    expect(bothBtn.className).toContain("bg-white")
  })

  it("handles missing historical rates gracefully without treating null as zero", async () => {
    const dataWithMissingRates: HistoricalMetalRatePoint[] = [
      {
        date: "2026-10-25",
        goldRate: 11900.0,
        silverRate: null, // missing market day for silver
        source: "GoldAPI.io",
        status: "LIVE",
      },
      {
        date: "2026-10-26",
        goldRate: null, // missing market day for gold
        silverRate: 150.1,
        source: "GoldAPI.io",
        status: "LIVE",
      },
    ]

    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(dataWithMissingRates)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-active-container")).toBeDefined()
      expect(screen.queryByTestId("single-day-info-banner")).toBeNull()
    })
  })

  it("renders error state with retry button when query fails", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockRejectedValue(new Error("Database disconnected"))

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-error-state")).toBeDefined()
      expect(screen.getByText("Failed to load historical rate data")).toBeDefined()
      expect(screen.getByRole("button", { name: /retry/i })).toBeDefined()
    })
  })

  it("renders CustomTooltip with localized date and formatted currency values for market close", () => {
    const mockPayload = [
      {
        name: "Gold (24k INR/g)",
        value: 11943.5651,
        color: "#2563EB",
        payload: {
          isLive: false,
          status: "MARKET_CLOSE",
        },
      },
      {
        name: "Silver (Pure INR/g)",
        value: 150.4976,
        color: "#D97706",
        payload: {
          isLive: false,
          status: "MARKET_CLOSE",
        },
      },
    ]

    render(<CustomTooltip active={true} payload={mockPayload} label="2026-10-30" />)

    expect(screen.getByTestId("chart-custom-tooltip")).toBeDefined()
    expect(screen.getByText(/30 Oct.*2026/)).toBeDefined()
    expect(screen.getByText(/11,943\.5651/)).toBeDefined()
    expect(screen.getByText(/150\.4976/)).toBeDefined()
    expect(screen.getByText(/Source: GoldAPI\.io \(LBMA Market Close\)/)).toBeDefined()
  })

  it("renders CustomTooltip with Live Spot badge when point is live quote", () => {
    const mockPayload = [
      {
        name: "Gold (24k INR/g)",
        value: 11943.5651,
        color: "#2563EB",
        payload: {
          isLive: true,
          status: "LIVE_SPOT",
        },
      },
    ]

    render(<CustomTooltip active={true} payload={mockPayload} label="2026-10-30" />)

    expect(screen.getByTestId("chart-custom-tooltip")).toBeDefined()
    expect(screen.getByText("Live Spot Quote")).toBeDefined()
    expect(screen.getByText(/Source: GoldAPI\.io \(Live Spot\)/)).toBeDefined()
    expect(screen.getByText("Real-time")).toBeDefined()
  })

  it("calculates day-over-day percentage change in CustomTooltip when fullData is available", () => {
    const mockPayload = [
      {
        name: "Gold (24k INR/g)",
        value: 11900.0,
        color: "#2563EB",
        payload: {
          goldRate: 11900.0,
          date: "2026-10-25",
        },
      },
    ]

    render(
      <CustomTooltip
        active={true}
        payload={mockPayload}
        label="2026-10-25"
        fullData={mockMultiDayData}
      />
    )

    // 11900 vs previous 11850.5 -> +0.42%
    expect(screen.getByText("+0.42%")).toBeDefined()
  })

  it("toggles Live Spot prices filter on and off", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("toggle-live-prices")).toBeDefined()
    })

    const liveToggle = screen.getByTestId("toggle-live-prices")
    expect(liveToggle.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(liveToggle)
    expect(liveToggle.getAttribute("aria-pressed")).toBe("false")
  })

  it("renders performance insight cards with calculated period metrics", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("performance-insights-grid")).toBeDefined()
      expect(screen.getByText("Gold Period Change")).toBeDefined()
      expect(screen.getByText("Silver Period Change")).toBeDefined()
      expect(screen.getByText("Period High")).toBeDefined()
      expect(screen.getByText("Period Low")).toBeDefined()
    })
  })
})
