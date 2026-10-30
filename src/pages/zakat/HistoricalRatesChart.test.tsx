import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HistoricalRatesChart } from "./HistoricalRatesChart"
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
    goldRate: 12050.91,
    silverRate: 151.88,
    source: "GoldAPI.io",
    status: "LIVE",
  },
]

describe("HistoricalRatesChart Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders header, controls, and valuation source footer", async () => {
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

  it("renders honest empty state when fewer than 2 records are available (single data point)", async () => {
    const singlePointData: HistoricalMetalRatePoint[] = [
      {
        date: "2026-10-30",
        goldRate: 12050.91,
        silverRate: 151.8801,
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
      expect(screen.getByTestId("chart-empty-state")).toBeDefined()
      expect(screen.getByText("Insufficient Historical Data")).toBeDefined()
      expect(screen.getByText(/Historical rate tracking began on/i)).toBeDefined()
      expect(screen.getByText(/12,050\.91/)).toBeDefined()
      expect(screen.getByText(/151\.88/)).toBeDefined()
    })
  })

  it("renders empty state when zero records are returned", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue([])

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-empty-state")).toBeDefined()
      expect(screen.getByText("Insufficient Historical Data")).toBeDefined()
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

  it("renders active chart container when 2 or more distinct dates exist", async () => {
    vi.mocked(zakatService.fetchHistoricalMetalRates).mockResolvedValue(mockMultiDayData)

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <HistoricalRatesChart />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("chart-active-container")).toBeDefined()
      expect(screen.getByTestId("mock-responsive-container")).toBeDefined()
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
    })
  })
})
