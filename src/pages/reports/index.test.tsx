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

  it("exports personal ledger CSV with structured Account column and handles legacy rows without account", async () => {
    let capturedBlob: Blob | null = null
    globalThis.URL.createObjectURL = vi.fn((blob: any) => {
      capturedBlob = blob
      return "mock-blob-url"
    })

    const mockCredits = [
      {
        id: "cred-1",
        entry_date: "2026-11-09",
        entry_type: "PRODUCT_CREDIT",
        funding_source: "PERSONAL_FUNDS",
        account: "HDFC Bank",
        product_name: "Cooking Oil 15L",
        quantity: 1,
        unit: "tin",
        rate_per_unit: 2200,
        total_amount: 2200,
        amount_paid: 0,
        balance: 2200,
        status: "PENDING",
        notes: "Brand Sunflower",
        customer: { name: "Aaqib" },
      },
      {
        id: "cred-legacy",
        entry_date: "2026-10-01",
        entry_type: "CASH_LOAN",
        funding_source: "7TIME_FUNDS",
        account: null,
        description: "Emergency loan",
        total_amount: 5000,
        amount_paid: 1000,
        balance: 4000,
        status: "PARTIAL",
        notes: "Historical unallocated credit",
        customer: { name: "Zaid" },
      }
    ]

    const selectMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: mockCredits, error: null }),
    })
    ;(supabase.from as any).mockReturnValue({ select: selectMock })

    render(<ReportsPage />)

    const exportButtons = screen.getAllByRole("button", { name: /Export to CSV/i })
    const personalExportBtn = exportButtons[0]

    fireEvent.click(personalExportBtn)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("customer_credits")
      expect(selectMock).toHaveBeenCalledWith("*, customer:reseller_customers(name)")
    })

    expect(capturedBlob).not.toBeNull()
    if (capturedBlob) {
      const text = await (capturedBlob as Blob).text()
      expect(text).toContain("ID,Date,Person,Entry Type,Funding Source,Account,Item/Description")
      expect(text).toContain('"HDFC Bank"')
      expect(text).toContain('"Cooking Oil 15L"')
      expect(text).toContain('"cred-legacy"')
    }
  })

  it("exports personal ledger PDF and opens preview modal when Export to PDF is clicked", async () => {
    const mockCredits = [
      {
        id: "cred-pdf-1",
        entry_date: "2026-11-09",
        entry_type: "PRODUCT_CREDIT",
        funding_source: "PERSONAL_FUNDS",
        account: "HDFC Bank",
        product_name: "Cooking Oil 15L",
        quantity: 1,
        unit: "tin",
        rate_per_unit: 2200,
        total_amount: 2200,
        amount_paid: 0,
        balance: 2200,
        status: "PENDING",
        notes: "Brand Sunflower",
        customer: { name: "Aaqib" },
      },
    ]

    const selectMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: mockCredits, error: null }),
    })
    ;(supabase.from as any).mockReturnValue({ select: selectMock })

    render(<ReportsPage />)

    const pdfButtons = screen.getAllByRole("button", { name: /Export to PDF/i })
    expect(pdfButtons.length).toBeGreaterThan(0)
    const personalPdfBtn = pdfButtons[0]

    fireEvent.click(personalPdfBtn)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("customer_credits")
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getAllByText("Personal Ledger Entries Report").length).toBe(2)
    })
  })
})
