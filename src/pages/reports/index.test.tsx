import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ReportsPage from "./index"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe("ReportsPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.URL.createObjectURL = vi.fn(() => "mock-blob-url")
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it("renders page header and all report cards", () => {
    render(<ReportsPage />)

    expect(screen.getByText("Business Reports & Export")).toBeInTheDocument()
    expect(screen.getByText("Personal Ledger Entries Report")).toBeInTheDocument()
    expect(screen.getByText("Wholesale Sales Report")).toBeInTheDocument()
    expect(screen.getByText("Purchase Report")).toBeInTheDocument()
    expect(screen.getByText("Inventory Report")).toBeInTheDocument()
    expect(screen.getByText("Settlements Received Report")).toBeInTheDocument()
    expect(screen.getByText("Dealer Payment Report")).toBeInTheDocument()
    expect(screen.getByText("General Delivery Report")).toBeInTheDocument()
    expect(screen.getByText("Naeem Uncle Report")).toBeInTheDocument()
  })

  it("exports purchases CSV with buying_rate and derived status", async () => {
    const mockPurchases = [
      {
        id: "purch-1",
        purchase_date: "2026-10-20",
        quantity_bought: 50,
        buying_rate: 200,
        total_amount: 10000,
        amount_paid: 10000,
        balance: 0,
        dealer: { name: "Prime Agro" },
        product: { name: "Almonds Premium" },
      },
    ]

    const selectMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }),
    })
    ;(supabase.from as any).mockReturnValue({ select: selectMock })

    render(<ReportsPage />)

    const exportButtons = screen.getAllByRole("button", { name: /Export to CSV/i })
    const purchaseExportBtn = exportButtons[2]

    fireEvent.click(purchaseExportBtn)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("purchases")
      expect(selectMock).toHaveBeenCalledWith("*, dealer:dealers(name), product:products(name)")
    })
  })

  it("exports wholesale sales CSV with joined customer and product names", async () => {
    const mockSales = [
      {
        id: "sale-1",
        sale_date: "2026-10-21",
        quantity: 20,
        buying_cost: 200,
        wholesale_price: 250,
        total_sale: 5000,
        amount_received: 5000,
        balance: 0,
        profit: 1000,
        payment_status: "PAID",
        payment_method: "CASH",
        customer: { name: "Iqbal Dry Fruits" },
        product: { name: "Walnuts Inshell" },
      },
    ]

    const selectMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: mockSales, error: null }),
    })
    ;(supabase.from as any).mockReturnValue({ select: selectMock })

    render(<ReportsPage />)

    const exportButtons = screen.getAllByRole("button", { name: /Export to CSV/i })
    const wholesaleExportBtn = exportButtons[1]

    fireEvent.click(wholesaleExportBtn)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("wholesale_sales")
      expect(selectMock).toHaveBeenCalledWith("*, customer:reseller_customers(name), product:products(name)")
    })
  })
})
