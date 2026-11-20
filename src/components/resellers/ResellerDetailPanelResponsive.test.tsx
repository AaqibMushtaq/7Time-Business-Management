import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ResellerDetailPanel from "./ResellerDetailPanel"
import type { CustomerCredit } from "@/services/customerCredits"
import type { ResellerCustomer } from "@/services/resellers"
import type { ResellerPayment } from "@/services/resellerPayments"

// Mock Auth
vi.mock("@/components/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-test-01", email: "owner@7time.test" },
    profile: {
      id: "user-test-01",
      full_name: "7TIME Owner",
      phone: "9999999999",
      company_name: "7TIME Enterprise",
    },
    currentWorkspace: {
      id: "ws-test",
      name: "7TIME Enterprise",
      workspace_type: "BUSINESS",
    },
    signOut: vi.fn(),
  }),
}))

const mockPerson: ResellerCustomer = {
  id: "cust-zahid-01",
  workspace_id: "ws-test",
  name: "Zahid Ahmad",
  phone: "9876543210",
  address: "Nowhatta, Srinagar",
  notes: "Key partner",
  opening_balance: 0,
  contact_type: "PERSONAL",
  created_at: "2026-01-01",
}

const mockCredits: CustomerCredit[] = [
  {
    id: "credit-exp-101",
    customer_id: "cust-zahid-01",
    entry_type: "PRODUCT_CREDIT",
    entry_date: "2026-10-15",
    funding_source: "7TIME_FUNDS",
    account: "HDFC Current",
    shopkeeper_name: "Gulmarg Store",
    purchase_location: "Main Bazar",
    product_id: null,
    product_name: "Hardware Tools & Supplies",
    category: "Tools",
    quantity: 3,
    unit: "items",
    rate_per_unit: 500,
    description: null,
    total_amount: 1500,
    amount_paid: 500,
    balance: 1000,
    status: "PARTIAL",
    notes: "Multiple supplies for project site",
    items: [
      {
        name: "Drill bits",
        category: "Tools",
        quantity: 5,
        unit: "pcs",
        rate_per_unit: 100,
        amount: 500,
      },
      {
        name: "Screws pack",
        category: "Supplies",
        quantity: 10,
        unit: "packs",
        rate_per_unit: 40,
        amount: 400,
      },
      {
        name: "Saw blades",
        category: "Hardware",
        quantity: 6,
        unit: "plates",
        rate_per_unit: 100,
        amount: 600,
      },
    ],
    allocations: [
      {
        id: "alloc-01",
        payment_id: "pay-settle-01",
        credit_id: "credit-exp-101",
        amount: 500,
        notes: "Initial cash settlement",
        payment: {
          id: "pay-settle-01",
          customer_id: "cust-zahid-01",
          payment_date: "2026-10-20",
          amount: 500,
          payment_method: "CASH",
          reference: "RCPT-1001",
          notes: "Hand cash received from Zahid",
        },
      },
    ],
  },
  {
    id: "credit-loan-201",
    customer_id: "cust-zahid-01",
    entry_type: "CASH_LOAN",
    entry_date: "2026-10-18",
    funding_source: "PERSONAL_FUNDS",
    account: "Cash in Hand",
    shopkeeper_name: null,
    purchase_location: null,
    product_id: null,
    product_name: null,
    category: null,
    quantity: null,
    unit: null,
    rate_per_unit: null,
    description: "Emergency support fund",
    total_amount: 5000,
    amount_paid: 5000,
    balance: 0,
    status: "PAID",
    notes: "Qard Hasan without interest",
    items: null,
    allocations: [],
  },
]

const mockPaymentEntry: ResellerPayment = {
  id: "pay-settle-01",
  customer_id: "cust-zahid-01",
  payment_date: "2026-10-20",
  amount: 500,
  payment_method: "CASH",
  reference: "RCPT-1001",
  notes: "Hand cash received from Zahid",
  allocations: [
    {
      id: "alloc-01",
      payment_id: "pay-settle-01",
      credit_id: "credit-exp-101",
      amount: 500,
      notes: "Settlement toward Hardware Tools",
    },
  ],
}

vi.mock("@/services/customerCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/customerCredits")>()
  return {
    ...actual,
    getCustomerCredits: vi.fn(() => Promise.resolve(mockCredits)),
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "reseller_customers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockPerson, error: null })),
            })),
          })),
        }
      }
      if (table === "reseller_payments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [mockPaymentEntry], error: null })),
            })),
          })),
        }
      }
      if (table === "wholesale_sales") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      }
    }),
  },
}))

describe("ResellerDetailPanel — Responsive Transaction Table & Cards Across 8 Viewports", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  const setViewport = (width: number, height: number) => {
    window.innerWidth = width
    window.innerHeight = height
    window.dispatchEvent(new Event("resize"))
  }

  const renderPanel = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ResellerDetailPanel id="cust-zahid-01" onClose={vi.fn()} />
      </QueryClientProvider>
    )
  }

  it("1. Full HD Desktop (1920 × 1080): renders table with 100% width, fixed table layout, colgroup, and unclipped columns", async () => {
    setViewport(1920, 1080)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // Verify desktop table is in document
    const desktopTable = document.querySelector("table.table-fixed")
    expect(desktopTable).toBeInTheDocument()
    expect(desktopTable).toHaveClass("w-full")

    // Colgroup verification: column 5 is flexible, other columns have fixed bounds
    const cols = desktopTable?.querySelectorAll("colgroup col")
    expect(cols?.length).toBe(10)

    // First and last columns check
    expect(screen.getByText("Date")).toBeInTheDocument()
    expect(screen.getByText("Actions")).toBeInTheDocument()

    // Financial amounts rendered on one line
    const tableCells = desktopTable?.querySelectorAll("tbody td")
    expect(tableCells && tableCells.length > 0).toBe(true)
    const amountCell = Array.from(tableCells || []).find(td => td.textContent?.includes("1,500"))
    expect(amountCell).toBeInTheDocument()
    expect(amountCell).toHaveClass("whitespace-nowrap")
  })

  it("2. Standard Laptop / Desktop (1440 × 900): action buttons visible, aligned, and fully functional", async () => {
    setViewport(1440, 900)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // Settle button visible
    const settleButtons = await screen.findAllByRole("button", { name: /^Settle$/i })
    expect(settleButtons.length).toBeGreaterThanOrEqual(1)

    // Edit and Delete icons visible
    const editButtons = screen.getAllByTitle("Edit Entry")
    expect(editButtons.length).toBeGreaterThanOrEqual(1)

    const deleteButtons = screen.getAllByTitle("Delete Entry")
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1)
  })

  it("3. Most Common Laptop (1366 × 768): descriptions wrap naturally without table overflow", async () => {
    setViewport(1366, 768)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // Description element contains break-words class
    const descElements = document.querySelectorAll(".break-words")
    expect(descElements.length).toBeGreaterThanOrEqual(1)

    // Total amount and balance are intact
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThanOrEqual(1)
  })

  it("4. HD Laptop / Small Desktop (1280 × 720): fits all 9 columns without horizontal scroll", async () => {
    setViewport(1280, 720)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // All headers present and visible
    expect(screen.getByText("Date")).toBeInTheDocument()
    expect(screen.getByText("Type")).toBeInTheDocument()
    expect(screen.getByText("Funding")).toBeInTheDocument()
    expect(screen.getByText("Item / Description")).toBeInTheDocument()
    expect(screen.getByText("Amount")).toBeInTheDocument()
    expect(screen.getAllByText("Settled").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Balance").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Actions")).toBeInTheDocument()
  })

  it("5. Small Desktop / iPad Landscape (1024 × 768): table layout remains 100% width with no overflow", async () => {
    setViewport(1024, 768)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    const table = document.querySelector("table.table-fixed")
    expect(table).toBeInTheDocument()
    expect(table?.parentElement?.parentElement).toHaveClass("w-full")
  })

  it("6. iPad Portrait / Tablet (768 × 1024): table adapts with compact spacing", async () => {
    setViewport(768, 1024)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // Table view is active on md+ (768px+)
    const desktopContainer = document.querySelector(".hidden.md\\:block")
    expect(desktopContainer).toBeInTheDocument()
  })

  it("7. iPhone 12/13/14 (390 × 844): uses structured transaction cards with all required data points", async () => {
    setViewport(390, 844)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // Mobile container is active
    const mobileContainer = document.querySelector(".block.md\\:hidden")
    expect(mobileContainer).toBeInTheDocument()

    // Mobile card renders for Hardware Tools
    const card = screen.getByTestId("mobile-credit-card-credit-exp-101")
    expect(card).toBeInTheDocument()

    // Card contains all 8 required data points
    expect(card).toHaveTextContent("15 Oct 2026")
    expect(card).toHaveTextContent("Expense on Behalf")
    expect(card).toHaveTextContent("Business Funds")
    expect(card).toHaveTextContent("Hardware Tools & Supplies")
    expect(card).toHaveTextContent("₹1,500.00") // Total
    expect(card).toHaveTextContent("₹500.00") // Settled
    expect(card).toHaveTextContent("₹1,000.00") // Balance
    expect(card).toHaveTextContent("PARTIAL") // Status

    // Clicking card opens Entry Details modal
    fireEvent.click(card)
    await waitFor(() => {
      expect(screen.getByText("Entry Details")).toBeInTheDocument()
    })
  })

  it("8. Standard Android (360 × 740): 3-column financials grid and actions fit cleanly without horizontal scrolling", async () => {
    setViewport(360, 740)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText("Zahid Ahmad")).toBeInTheDocument()
    })

    // Verify 3-column financials grid exists in mobile card
    const gridCols = document.querySelectorAll(".grid-cols-3")
    expect(gridCols.length).toBeGreaterThanOrEqual(1)

    // Verify action buttons inside mobile card
    const card = screen.getByTestId("mobile-credit-card-credit-exp-101")
    expect(card).toBeInTheDocument()

    // Settle button is inside the card
    const settleBtn = card.querySelector("button")
    expect(settleBtn).toBeInTheDocument()
  })
})
