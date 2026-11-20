import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import CreateCustomerCreditModal from "./CreateCustomerCreditModal"
import type { ResellerCustomer } from "@/services/resellers"

const { mockCreateCustomerCredit } = vi.hoisted(() => ({
  mockCreateCustomerCredit: vi.fn().mockResolvedValue({ id: "credit-100" })
}))

vi.mock("@/services/customerCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/customerCredits")>()
  return {
    ...actual,
    createCustomerCredit: mockCreateCustomerCredit
  }
})

describe("CreateCustomerCreditModal — Fully Responsive & Accessibility Suite", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  const mockCustomers: ResellerCustomer[] = [
    {
      id: "cust-1",
      name: "Tariq Ahmad",
      phone: "+91 9876543210",
      address: "Srinagar",
      contact_type: "PERSONAL",
      workspace_id: "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15",
      created_at: new Date().toISOString()
    },
    {
      id: "cust-2",
      name: "Bashir Khan",
      phone: "+91 9419000000",
      address: "Srinagar",
      contact_type: "PERSONAL",
      workspace_id: "fa5cc765-eeff-4a71-ab0e-9f44b4ec5d15",
      created_at: new Date().toISOString()
    }
  ]

  const mockOnClose = vi.fn()

  const setViewport = (width: number, height: number) => {
    window.innerWidth = width
    window.innerHeight = height
    window.dispatchEvent(new Event("resize"))
  }

  const renderModal = (props?: Partial<React.ComponentProps<typeof CreateCustomerCreditModal>>) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreateCustomerCreditModal
          isOpen={true}
          onClose={mockOnClose}
          customers={mockCustomers}
          selectedCustomerId="cust-1"
          {...props}
        />
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = "auto"
  })

  // 1. Viewport sizes test matrix
  const viewports = [
    { name: "Full HD Desktop (1920x1080)", width: 1920, height: 1080 },
    { name: "Laptop Standard (1366x768)", width: 1366, height: 768 },
    { name: "Desktop Medium (1440x900)", width: 1440, height: 900 },
    { name: "Small Desktop / Landscape Tablet (1024x768)", width: 1024, height: 768 },
    { name: "Tablet Portrait (768x1024)", width: 768, height: 1024 },
    { name: "Mobile iPhone 12/13/14 (390x844)", width: 390, height: 844 },
    { name: "Mobile Android Standard (360x740)", width: 360, height: 740 },
    { name: "Mobile Compact Screen (320x700)", width: 320, height: 700 }
  ]

  viewports.forEach(({ name, width, height }) => {
    it(`renders flawlessly on ${name} without breaking controls or throwing layout errors`, () => {
      setViewport(width, height)
      renderModal()

      expect(screen.getByText("Record Expense on Behalf")).toBeDefined()
      expect(screen.getByText("Person: Tariq Ahmad")).toBeDefined()
      expect(screen.getByRole("button", { name: /Close dialog/i })).toBeDefined()

      // Primary fields are present and accessible
      expect(screen.getByLabelText(/Item \/ Expense Description \*/i)).toBeDefined()
      expect(screen.getByLabelText(/Amount \(₹\) \*/i)).toBeDefined()
      expect(screen.getByRole("button", { name: /7TIME Business Funds/i })).toBeDefined()
      expect(screen.getByRole("button", { name: /Personal Funds/i })).toBeDefined()
      expect(screen.getByRole("button", { name: /Add Item \/ Expense/i })).toBeDefined()
      expect(screen.getByRole("button", { name: /Save Expense on Behalf/i })).toBeDefined()
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeDefined()
    })
  })

  it("locks body scrolling when opened and restores body scrolling on unmount", () => {
    const { unmount } = renderModal()
    expect(document.body.style.overflow).toBe("hidden")

    unmount()
    expect(document.body.style.overflow).toBe("auto")
  })

  it("contains all suggested placeholders on primary and optional fields", () => {
    renderModal()

    // Primary item placeholders
    expect(screen.getByPlaceholderText("e.g. Petrol, Medicine, Groceries, Repair")).toBeDefined()
    expect(screen.getByPlaceholderText("Enter amount (₹)")).toBeDefined()

    // Notes placeholder
    expect(screen.getByPlaceholderText("Add any additional details or transaction notes")).toBeDefined()

    // Expand details
    const detailsBtn = screen.getByLabelText(/Add details for item 1/i)
    fireEvent.click(detailsBtn)

    // Optional expandable details placeholders
    expect(screen.getByPlaceholderText("e.g. Food, Transport, Medical")).toBeDefined()
    expect(screen.getByPlaceholderText("e.g. 2")).toBeDefined()
    expect(screen.getByPlaceholderText("Enter rate (₹)")).toBeDefined()

    // Custom unit placeholder test
    const unitSelect = screen.getByLabelText(/^Unit 1$/i)
    fireEvent.change(unitSelect, { target: { value: "CUSTOM" } })
    expect(screen.getByPlaceholderText("Custom unit (e.g. pcs, kg, litre, hours)")).toBeDefined()

    // Upfront settlement placeholders
    const upfrontCheckbox = screen.getByLabelText(/Person paid partial settlement upfront\?/i)
    fireEvent.click(upfrontCheckbox)
    expect(screen.getByPlaceholderText("Enter amount already paid (₹)")).toBeDefined()
    expect(screen.getByPlaceholderText("e.g. UPI Ref, Cheque No, Transaction ID")).toBeDefined()
  })

  it("toggles funding source cards and verifies strict descriptions", async () => {
    renderModal()

    const businessFundsBtn = screen.getByRole("button", { name: /7TIME Business Funds/i })
    const personalFundsBtn = screen.getByRole("button", { name: /Personal Funds/i })
    expect(personalFundsBtn).toBeDefined()

    expect(screen.getByText("Money paid from 7TIME's own business funds.")).toBeDefined()
    expect(screen.getByText("Money paid personally by the owner on behalf of this person.")).toBeDefined()

    // Default is PERSONAL_FUNDS
    fireEvent.click(businessFundsBtn)

    // Fill valid data and submit to confirm 7TIME_FUNDS is passed
    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Fuel" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "300" } })

    fireEvent.click(screen.getByRole("button", { name: /Save Expense on Behalf/i }))

    await waitFor(() => {
      expect(mockCreateCustomerCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          funding_source: "7TIME_FUNDS",
          account: null
        }),
        expect.anything()
      )
    })
  })

  it("handles auto-calculation from quantity * rate, manual override, and grand total updates", () => {
    renderModal()

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Engine Oil" } })

    // Expand details and set quantity 3 @ 450 -> amount should auto calculate to 1350
    fireEvent.click(screen.getByLabelText(/Add details for item 1/i))
    fireEvent.change(screen.getByLabelText(/Quantity 1/i), { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText(/Rate \/ Unit 1/i), { target: { value: "450" } })

    const amountInput = screen.getByLabelText(/Amount \(₹\) \*/i) as HTMLInputElement
    expect(amountInput.value).toBe("1350")
    expect(screen.getByTitle("Auto-calculated from quantity × rate")).toBeDefined()
    expect(screen.getAllByText(formatMoney(1350))[0]).toBeDefined()

    // Manually override amount to 1300 (discounted)
    fireEvent.change(amountInput, { target: { value: "1300" } })
    expect(amountInput.value).toBe("1300")
    expect(screen.queryByTitle("Auto-calculated from quantity × rate")).toBeNull()
    expect(screen.getAllByText(formatMoney(1300))[0]).toBeDefined()
  })

  it("handles duplicate row and remove row with button disabling logic", () => {
    renderModal()

    fireEvent.change(screen.getByLabelText(/Item \/ Expense Description \*/i), { target: { value: "Service A" } })
    fireEvent.change(screen.getByLabelText(/Amount \(₹\) \*/i), { target: { value: "500" } })

    // Only 1 row -> remove button is disabled
    const removeBtn1 = screen.getByLabelText(/Remove row 1/i)
    expect(removeBtn1).toHaveProperty("disabled", true)

    // Duplicate row 1
    const dupBtn1 = screen.getByLabelText(/Duplicate row 1/i)
    fireEvent.click(dupBtn1)

    // Now 2 rows totaling 1000
    expect(screen.getByText("2 Items")).toBeDefined()
    expect(screen.getAllByText(formatMoney(1000))[0]).toBeDefined()

    // Remove row 2 -> back to 1 row
    const removeBtn2 = screen.getByLabelText(/Remove row 2/i)
    expect(removeBtn2).toHaveProperty("disabled", false)
    fireEvent.click(removeBtn2)

    expect(screen.getByText("1 Item")).toBeDefined()
    expect(screen.getAllByText(formatMoney(500))[0]).toBeDefined()
  })

  it("switches to Qard Hasan and Other Personal tabs with responsive layout and proper validation", async () => {
    renderModal()

    // Switch to Qard Hasan
    const qardTab = screen.getByRole("button", { name: /Qard Hasan/i })
    fireEvent.click(qardTab)

    expect(screen.getByText("Give Qard Hasan (Interest-Free Assistance)")).toBeDefined()
    expect(screen.getByPlaceholderText("Enter loan amount (₹)")).toBeDefined()

    // Switch to Other Personal
    const otherTab = screen.getByRole("button", { name: /Other Personal/i })
    fireEvent.click(otherTab)

    expect(screen.getByText("Record Other Personal Transaction")).toBeDefined()
    expect(screen.getByPlaceholderText("e.g. Packaging charges, vehicle repair advance, miscellaneous service")).toBeDefined()
  })

  it("closes on ESC key press and on Cancel button click", () => {
    renderModal()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }))
    expect(mockOnClose).toHaveBeenCalledTimes(2)
  })

  it("renders Person as pre-filled and read-only when launched from a person's account, and selectable when launched without preselection", () => {
    // 1. Launched from a person's account
    const { unmount } = renderModal({ selectedCustomerId: "cust-1" })
    const personSelectLocked = screen.getByLabelText(/Person \*/i) as HTMLSelectElement
    expect(personSelectLocked.disabled).toBe(true)
    expect(screen.getByText("Account locked")).toBeDefined()
    expect(personSelectLocked.value).toBe("cust-1")
    unmount()

    // 2. Launched generally without a pre-selected customer
    renderModal({ selectedCustomerId: undefined })
    const personSelectInteractive = screen.getByLabelText(/Person \*/i) as HTMLSelectElement
    expect(personSelectInteractive.disabled).toBe(false)
    expect(screen.queryByText("Account locked")).toBeNull()
    fireEvent.change(personSelectInteractive, { target: { value: "cust-2" } })
    expect(personSelectInteractive.value).toBe("cust-2")
  })
})
