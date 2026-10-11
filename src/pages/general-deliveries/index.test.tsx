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

  it("clicking date cell opens the daily operations edit modal", async () => {
    (getGeneralDailyRecords as any).mockResolvedValue([
      {
        id: "rec-1",
        record_date: "2026-10-01",
        delivery_expression: "100",
        fuel_expenses: 0,
        opening_balance: 0,
        remarks: null,
        entries: []
      }
    ])

    renderComponent()

    const dateCells = await screen.findAllByTitle("Click date to view or edit day's operations")
    expect(dateCells.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(dateCells[0])

    expect(await screen.findByText("Edit Daily Operations")).toBeDefined()
  })

  it("supports inline editing for deliveries cell with expression evaluation and save", async () => {
    const { upsertDailyRecord } = await import("@/services/generalDeliveries")
    ;(upsertDailyRecord as any).mockResolvedValue({ id: "rec-1" })
    ;(getGeneralDailyRecords as any).mockResolvedValue([
      {
        id: "rec-1",
        record_date: "2026-10-01",
        delivery_expression: "100",
        fuel_expenses: 0,
        opening_balance: 0,
        remarks: null,
        entries: [{ id: "e-1", amount: 100, received_amount: 100 }]
      }
    ])

    renderComponent()

    const deliveryCells = await screen.findAllByTitle("Click to edit delivery expression")
    expect(deliveryCells.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(deliveryCells[0])

    // Inline input should appear
    const inlineInput = screen.getByPlaceholderText("e.g. 500+300")
    expect(inlineInput).toBeDefined()

    // Change expression
    fireEvent.change(inlineInput, { target: { value: "500+300" } })
    expect(screen.getByText("Total: ₹800.00")).toBeDefined()

    // Click save
    const saveButton = screen.getByTitle("Save expression (Enter)")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(upsertDailyRecord).toHaveBeenCalledWith("2026-10-01", {
        delivery_expression: "500 + 300"
      })
    })
  })

  it("supports inline editing for fuel expenses cell and saves", async () => {
    const { upsertDailyRecord } = await import("@/services/generalDeliveries")
    ;(upsertDailyRecord as any).mockResolvedValue({ id: "rec-1" })
    ;(getGeneralDailyRecords as any).mockResolvedValue([
      {
        id: "rec-1",
        record_date: "2026-10-01",
        delivery_expression: "100",
        fuel_expenses: 0,
        opening_balance: 0,
        remarks: null,
        entries: []
      }
    ])

    renderComponent()

    const fuelCells = await screen.findAllByTitle("Click to edit fuel expense")
    expect(fuelCells.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(fuelCells[0])

    const fuelInput = screen.getByPlaceholderText("0.00")
    fireEvent.change(fuelInput, { target: { value: "150" } })

    const saveButton = screen.getByTitle("Save fuel expense")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(upsertDailyRecord).toHaveBeenCalledWith("2026-10-01", {
        fuel_expenses: 150
      })
    })
  })

  it("supports inline editing for remarks cell and saves without altering financial fields", async () => {
    const { upsertDailyRecord } = await import("@/services/generalDeliveries")
    ;(upsertDailyRecord as any).mockResolvedValue({ id: "rec-1" })
    ;(getGeneralDailyRecords as any).mockResolvedValue([
      {
        id: "rec-1",
        record_date: "2026-10-01",
        delivery_expression: "200",
        fuel_expenses: 50,
        opening_balance: 0,
        remarks: null,
        entries: []
      }
    ])

    renderComponent()

    const noteCells = await screen.findAllByTitle("Click to add or edit note")
    expect(noteCells.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(noteCells[0])

    const textarea = screen.getByPlaceholderText("Enter note / remarks...")
    fireEvent.change(textarea, { target: { value: "Deliveries completed by 4 PM" } })

    const saveBtn = screen.getByRole("button", { name: "Save" })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(upsertDailyRecord).toHaveBeenCalledWith("2026-10-01", {
        remarks: "Deliveries completed by 4 PM"
      })
    })
  })

  it("supports toggling between table view and cards view", async () => {
    (getGeneralDailyRecords as any).mockResolvedValue([])
    renderComponent()

    const cardsBtn = screen.getByTitle("Card view")
    fireEvent.click(cardsBtn)

    // Should switch to cards
    const tableBtn = screen.getByTitle("Table view")
    expect(tableBtn).toBeDefined()
    fireEvent.click(tableBtn)
  })

  it("clicking Active Delivery Days summary card toggles active-days filter", async () => {
    (getGeneralDailyRecords as any).mockResolvedValue([
      {
        id: "rec-1",
        record_date: "2026-10-01",
        delivery_expression: "100",
        fuel_expenses: 0,
        opening_balance: 0,
        remarks: null,
        entries: [{ id: "e-1", amount: 100, received_amount: 100 }]
      }
    ])

    renderComponent()

    const activeDaysCard = await screen.findByTitle("Click to toggle filtering active delivery days")
    fireEvent.click(activeDaysCard)

    // Filter indicator should show
    expect(screen.getByText("Filtered: Active days")).toBeDefined()
  })
})
