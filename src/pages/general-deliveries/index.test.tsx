import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import GeneralDeliveriesPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getGeneralDailyRecords } from "@/services/generalDeliveries"

vi.mock("@/services/generalDeliveries", () => ({
  getGeneralDailyRecords: vi.fn(),
  upsertDailySummary: vi.fn(),
  upsertDeliveryEntry: vi.fn(),
  deleteDeliveryEntry: vi.fn()
}))

vi.mock("@/lib/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/utils")>()
  return {
    ...mod,
    formatMoney: (val: any) => `₹${val}`
  }
})

// Mock recharts ResponsiveContainer to avoid SVG size errors in jsdom
vi.mock("recharts", async (importOriginal) => {
  const mod = await importOriginal<any>()
  return {
    ...mod,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>
  }
})

describe("GeneralDeliveriesPage", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    })
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <GeneralDeliveriesPage />
      </QueryClientProvider>
    )
  }

  it("renders page header and controls", () => {
    (getGeneralDailyRecords as any).mockResolvedValue([])
    renderComponent()

    expect(screen.getByText("General Daily Delivery")).toBeDefined()
    expect(screen.getByText("Daily Operations Log")).toBeDefined()
  })

  it("displays explicit 'Unavailable' state on summary cards when query fails with database error", async () => {
    (getGeneralDailyRecords as any).mockRejectedValue(
      new Error("Could not find the table 'public.general_daily_records' in the schema cache")
    )

    renderComponent()

    // Top-level error alert
    await waitFor(() => {
      expect(
        screen.getAllByText(/Could not find the table 'public.general_daily_records' in the schema cache/i).length
      ).toBeGreaterThanOrEqual(1)
    })

    // Summary cards must NOT show 0 or ₹0, but explicit Unavailable
    const unavailableElements = screen.getAllByText("Unavailable")
    expect(unavailableElements.length).toBe(4) // All 4 metric cards show Unavailable
  })

  it("calculates and displays correct metric totals when data is loaded successfully", async () => {
    const mockData = [
      {
        id: "rec-1",
        record_date: "2026-10-01",
        fuel_expenses: 400,
        opening_balance: 0,
        remarks: null,
        entries: [
          { id: "e-1", customer_name: "Customer A", amount: 1200, received_amount: 1200, payment_method: "Cash" },
          { id: "e-2", customer_name: "Customer B", amount: 800, received_amount: 800, payment_method: "Cash" }
        ]
      },
      {
        id: "rec-2",
        record_date: "2026-10-02",
        fuel_expenses: 250,
        opening_balance: 0,
        remarks: null,
        entries: [
          { id: "e-3", customer_name: "Customer C", amount: 1500, received_amount: 1500, payment_method: "UPI" }
        ]
      }
    ]

    ;(getGeneralDailyRecords as any).mockResolvedValue(mockData)

    renderComponent()

    // Active delivery days: 2 days have entries
    await waitFor(() => {
      expect(screen.getByText("2")).toBeDefined()
    })

    // Total Deliveries: 1200 + 800 + 1500 = 3500
    expect(screen.getByText("₹3500")).toBeDefined()

    // Total Fuel: 400 + 250 = 650
    expect(screen.getByText("₹650")).toBeDefined()

    // Net Total: 3500 - 650 = 2850
    expect(screen.getByText("₹2850")).toBeDefined()
  })

  it("displays genuine zero-valued metrics when month legitimately has no records", async () => {
    ;(getGeneralDailyRecords as any).mockResolvedValue([])

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText("0")).toBeDefined() // Active Days: 0
    })

    const zeroAmounts = screen.getAllByText("₹0")
    expect(zeroAmounts.length).toBe(3) // Total Deliveries: ₹0, Fuel: ₹0, Net: ₹0
  })
})
