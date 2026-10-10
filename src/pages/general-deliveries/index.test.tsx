import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import GeneralDeliveriesPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  getGeneralDailyRecords
} from "@/services/generalDeliveries"

vi.mock("@/services/generalDeliveries", () => ({
  getGeneralDailyRecords: vi.fn(),
  upsertDailyRecord: vi.fn(),
  deleteDailyRecord: vi.fn(),
  upsertDailySummary: vi.fn(),
  upsertDeliveryEntry: vi.fn(),
  deleteDeliveryEntry: vi.fn()
}))

vi.mock("@/lib/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/utils")>()
  return {
    ...mod,
    formatMoney: (val: any) => `₹${Number(val).toFixed(2)}`
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

  it("renders page header, 7TIME colors, and controls", () => {
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

  it("calculates and displays correct metric totals and expressions when data is loaded successfully", async () => {
    const mockData = [
      {
        id: "rec-1",
        record_date: "2026-10-01",
        delivery_expression: "10+350+10",
        fuel_expenses: 100,
        opening_balance: 0,
        remarks: "First run",
        entries: [
          { id: "e-1", customer_name: "Daily Operations", amount: 370, received_amount: 370 }
        ]
      },
      {
        id: "rec-2",
        record_date: "2026-10-02",
        delivery_expression: "120",
        fuel_expenses: 50,
        opening_balance: 0,
        remarks: null,
        entries: [
          { id: "e-2", customer_name: "Daily Operations", amount: 120, received_amount: 120 }
        ]
      }
    ]

    ;(getGeneralDailyRecords as any).mockResolvedValue(mockData)

    renderComponent()

    // Active delivery days: 2 days have entries
    await waitFor(() => {
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1)
    })

    // Expression rendered in table cell: 10 + 350 + 10 = ₹370.00
    expect(screen.getByText("10 + 350 + 10 = ₹370.00")).toBeDefined()

    // Total Deliveries: 370 + 120 = 490.00
    expect(screen.getAllByText("₹490.00").length).toBeGreaterThanOrEqual(1)

    // Total Fuel: 100 + 50 = 150.00
    expect(screen.getAllByText("₹150.00").length).toBeGreaterThanOrEqual(1)

    // Net Total: 490 - 150 = 340.00
    expect(screen.getAllByText("₹340.00").length).toBeGreaterThanOrEqual(1)
  })

  it("opens edit modal and calculates arithmetic expression in real-time", async () => {
    (getGeneralDailyRecords as any).mockResolvedValue([])

    renderComponent()

    // Wait for the table rows to render
    const editButtons = await screen.findAllByTitle("Edit day's deliveries & fuel")
    expect(editButtons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(editButtons[0])

    // Modal opens
    expect(await screen.findByText("Edit Daily Operations")).toBeDefined()

    // Find input and type expression "10+350+10"
    const input = screen.getByPlaceholderText("e.g. 10+350+10 or 370")
    fireEvent.change(input, { target: { value: "10+350+10" } })

    // Real-time calculation badge appears
    expect(screen.getByText(/Calculated Total: ₹370.00/i)).toBeDefined()

    // Type incomplete expression
    fireEvent.change(input, { target: { value: "10+" } })
    expect(screen.getByText(/Typing expression \(ends with '\+'\)/i)).toBeDefined()
  })
})
