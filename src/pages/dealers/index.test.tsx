import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import DealersPage from "./index"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { getDealersWithBalances, createDealer, updateDealer } from "@/services/dealers"

vi.mock("@/services/dealers", () => ({
  getDealersWithBalances: vi.fn(),
  createDealer: vi.fn(),
  updateDealer: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockDealers = [
  {
    id: "dealer-1",
    name: "Al Infaq Traders",
    phone: "+91 99060 11223",
    whatsapp: "+91 99060 11223",
    address: "Main Market, Pulwama, Kashmir",
    notes: "Primary beverage supplier",
    opening_balance: 1000,
    outstanding: 4500, // We Owe Dealer (> 0)
    created_at: "2026-01-01T00:00:00Z"
  },
  {
    id: "dealer-2",
    name: "Kashmir Agro Foods",
    phone: "94190 99887",
    whatsapp: "94190 55443", // Distinct whatsapp
    address: "Fruit Complex, Srinagar",
    notes: null,
    opening_balance: 0,
    outstanding: -2000, // Advance (< 0)
    created_at: "2026-01-02T00:00:00Z"
  },
  {
    id: "dealer-3",
    name: "Valley Wholesale Supplies",
    phone: null, // Missing phone
    whatsapp: null,
    address: null, // Missing address
    notes: null,
    opening_balance: 0,
    outstanding: 0, // Settled (= 0)
    created_at: "2026-01-03T00:00:00Z"
  }
]

describe("Dealers & Suppliers Modernized Page", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    ;(getDealersWithBalances as any).mockResolvedValue(mockDealers)
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DealersPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("renders page title, subtitle, search input, and Add New Dealer button", async () => {
    renderComponent()

    expect(await screen.findByText("Dealers & Suppliers")).toBeDefined()
    expect(screen.getByText(/Manage dealer contacts, purchase ledgers, and payment settlements/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/Search dealers by name or phone.../i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Add New Dealer/i })).toBeDefined()
  })

  it("renders all dealer cards with correct details, badges, and balance statuses", async () => {
    renderComponent()

    expect(await screen.findByText("Al Infaq Traders")).toBeDefined()
    expect(screen.getByText("Kashmir Agro Foods")).toBeDefined()
    expect(screen.getByText("Valley Wholesale Supplies")).toBeDefined()

    // Dealer 1: We Owe Dealer (> 0)
    expect(screen.getByText("₹4,500.00")).toBeDefined()
    expect(screen.getByText("We Owe Dealer")).toBeDefined()
    expect(screen.getByText("+91 99060 11223")).toBeDefined()
    expect(screen.getByText(/Main Market, Pulwama/i)).toBeDefined()
    expect(screen.getByText("Opening Balance:")).toBeDefined()

    // Dealer 2: Advance (< 0)
    expect(screen.getByText("-₹2,000.00")).toBeDefined()
    expect(screen.getByText("Advance / Dealer Owes Us")).toBeDefined()
    expect(screen.getByText("94190 99887")).toBeDefined()
    expect(screen.getByText("94190 55443")).toBeDefined() // Distinct whatsapp

    // Dealer 3: Settled (= 0) with empty state pills for missing phone and address
    expect(screen.getByText("₹0.00")).toBeDefined()
    expect(screen.getByText("Settled")).toBeDefined()
    expect(screen.getByText("No phone registered")).toBeDefined()
    expect(screen.getByText("No address registered")).toBeDefined()
  })

  it("filters dealers in real-time by name and by phone number", async () => {
    renderComponent()

    await screen.findByText("Al Infaq Traders")
    const searchInput = screen.getByPlaceholderText(/Search dealers by name or phone.../i)

    // Filter by name
    fireEvent.change(searchInput, { target: { value: "Kashmir" } })
    expect(screen.getByText("Kashmir Agro Foods")).toBeDefined()
    expect(screen.queryByText("Al Infaq Traders")).toBeNull()
    expect(screen.queryByText("Valley Wholesale Supplies")).toBeNull()
    expect(screen.getByText(/Search Results \(1\)/i)).toBeDefined()

    // Filter by phone
    fireEvent.change(searchInput, { target: { value: "99060" } })
    expect(screen.getByText("Al Infaq Traders")).toBeDefined()
    expect(screen.queryByText("Kashmir Agro Foods")).toBeNull()

    // Clear search using the inline X button
    const clearBtn = screen.getByLabelText("Clear search query")
    fireEvent.click(clearBtn)
    expect(screen.getByText("Al Infaq Traders")).toBeDefined()
    expect(screen.getByText("Kashmir Agro Foods")).toBeDefined()
    expect(screen.getByText("Valley Wholesale Supplies")).toBeDefined()
  })

  it("shows an empty state with Clear Search button when no dealers match query", async () => {
    renderComponent()

    await screen.findByText("Al Infaq Traders")
    const searchInput = screen.getByPlaceholderText(/Search dealers by name or phone.../i)

    fireEvent.change(searchInput, { target: { value: "Nonexistent Supplier 999" } })
    expect(screen.getByText("No matching dealers found")).toBeDefined()
    expect(screen.getByText(/No dealer records matched "Nonexistent Supplier 999"/i)).toBeDefined()

    // Click Clear Search button
    const clearSearchBtn = screen.getByRole("button", { name: "Clear Search" })
    fireEvent.click(clearSearchBtn)

    expect(screen.getByText("Al Infaq Traders")).toBeDefined()
    expect(screen.getByText("Kashmir Agro Foods")).toBeDefined()
  })

  it("opens Add New Dealer modal, validates required fields, and calls createDealer", async () => {
    ;(createDealer as any).mockResolvedValue({ id: "new-1", name: "New Supplier" })

    renderComponent()

    await screen.findByText("Al Infaq Traders")
    const addBtn = screen.getByRole("button", { name: /Add New Dealer/i })
    fireEvent.click(addBtn)

    expect(screen.getByRole("dialog", { name: /Add New Dealer/i })).toBeDefined()
    expect(screen.getByText("Provide supplier details, contact info, and opening ledger balance.")).toBeDefined()

    // Fill form
    const nameInput = screen.getByPlaceholderText("e.g., AL INFAQ TRADERS")
    const phoneInput = screen.getByPlaceholderText("+91...")
    const balanceInput = screen.getByPlaceholderText("0.00")

    fireEvent.change(nameInput, { target: { value: "Himalayan Wholesale" } })
    fireEvent.change(phoneInput, { target: { value: "9876543210" } })
    fireEvent.change(balanceInput, { target: { value: "1500" } })

    const submitBtn = screen.getByRole("button", { name: "Add Dealer" })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createDealer).toHaveBeenCalledWith({
        name: "Himalayan Wholesale",
        phone: "9876543210",
        whatsapp: null,
        address: null,
        notes: null,
        opening_balance: 1500
      })
    })
  })

  it("opens Edit Dealer modal with prefilled data and submits updates without triggering card click", async () => {
    ;(updateDealer as any).mockResolvedValue({ id: "dealer-1", name: "Al Infaq Traders Updated" })

    renderComponent()

    await screen.findByText("Al Infaq Traders")
    const editBtn = screen.getByLabelText("Edit Al Infaq Traders")
    fireEvent.click(editBtn)

    // Confirm edit dialog opened
    expect(screen.getByRole("dialog", { name: /Edit Dealer/i })).toBeDefined()
    const nameInput = screen.getByPlaceholderText("e.g., AL INFAQ TRADERS") as HTMLInputElement
    expect(nameInput.value).toBe("Al Infaq Traders")

    // Confirm detail panel was NOT opened because stopPropagation was used
    expect(screen.queryByTestId("dealer-detail-panel")).toBeNull()

    // Update name
    fireEvent.change(nameInput, { target: { value: "Al Infaq Premium Traders" } })
    const saveBtn = screen.getByRole("button", { name: "Save Changes" })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateDealer).toHaveBeenCalledWith("dealer-1", expect.objectContaining({
        name: "Al Infaq Premium Traders"
      }))
    })
  })

  it("navigates to dedicated dealer details page on card click and keyboard navigation", async () => {
    mockNavigate.mockClear()
    renderComponent()

    await screen.findByText("Al Infaq Traders")
    const card = screen.getByLabelText("Dealer card for Al Infaq Traders")
    fireEvent.click(card)

    // Direct route navigation to /dealers/dealer-1
    expect(mockNavigate).toHaveBeenCalledWith("/dealers/dealer-1")

    // Keyboard navigation using Enter key
    mockNavigate.mockClear()
    fireEvent.keyDown(card, { key: "Enter" })
    expect(mockNavigate).toHaveBeenCalledWith("/dealers/dealer-1")
  })

  it("handles Call, WhatsApp, and Directions actions correctly", async () => {
    const originalOpen = window.open
    window.open = vi.fn()

    renderComponent()

    await screen.findByText("Al Infaq Traders")

    // Dealer 1 has phone: Call button should be active and call window.open with tel:
    const callBtn1 = screen.getByLabelText("Call Al Infaq Traders") as HTMLButtonElement
    expect(callBtn1.disabled).toBe(false)
    fireEvent.click(callBtn1)
    expect(window.open).toHaveBeenCalledWith("tel:+919906011223")

    // Dealer 1 has address: Directions button should call window.open with maps query
    const directionsBtn1 = screen.getByLabelText("Directions to Al Infaq Traders") as HTMLButtonElement
    expect(directionsBtn1.disabled).toBe(false)
    fireEvent.click(directionsBtn1)
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://maps.google.com/?q="),
      "_blank",
      "noopener,noreferrer"
    )

    // Dealer 3 has NO phone and NO address: Call, WhatsApp, and Directions must be disabled
    const callBtn3 = screen.getByLabelText("Call Valley Wholesale Supplies (unavailable)") as HTMLButtonElement
    expect(callBtn3.disabled).toBe(true)

    const whatsappBtn3 = screen.getByLabelText("WhatsApp Valley Wholesale Supplies (unavailable)") as HTMLButtonElement
    expect(whatsappBtn3.disabled).toBe(true)

    const directionsBtn3 = screen.getByLabelText("Directions to Valley Wholesale Supplies (unavailable)") as HTMLButtonElement
    expect(directionsBtn3.disabled).toBe(true)

    window.open = originalOpen
  })
})
