import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppLayout } from "./AppLayout"

vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    user: { email: "admin@7time.com" },
    signOut: vi.fn(),
  }),
}))

vi.mock("../common/UpdateNotificationBanner", () => ({
  UpdateNotificationBanner: () => <div data-testid="update-banner" />,
}))

vi.mock("@/lib/versionManager", () => ({
  getCurrentAppVersion: () => "1.3.1",
  forceAppReload: vi.fn(),
}))

describe("AppLayout Navigation Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders Personal Ledger under the dedicated PERSONAL LEDGER section", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    )

    // Heading for PERSONAL LEDGER
    const personalLedgerHeadings = screen.getAllByRole("heading", { name: /PERSONAL LEDGER/i })
    expect(personalLedgerHeadings.length).toBeGreaterThan(0)

    // Personal Ledger link is present with correct route
    const personalLedgerLinks = screen.getAllByRole("link", { name: /Personal Ledger/i })
    expect(personalLedgerLinks.length).toBeGreaterThan(0)
    expect(personalLedgerLinks[0].getAttribute("href")).toBe("/local-customers")
  })

  it("renders Wholesale Sales under the WHOLESALE section separately from Local Customers", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    )

    // Heading for WHOLESALE
    const wholesaleHeadings = screen.getAllByRole("heading", { name: /WHOLESALE/i })
    expect(wholesaleHeadings.length).toBeGreaterThan(0)

    // Wholesale Sales link is present with correct route
    const wholesaleLinks = screen.getAllByRole("link", { name: /Wholesale Sales/i })
    expect(wholesaleLinks.length).toBeGreaterThan(0)
    expect(wholesaleLinks[0].getAttribute("href")).toBe("/wholesale")
  })

  it("confirms Local Customers and Wholesale Sales are segregated into separate sections", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    )

    // Query all navigation group section headings
    const sectionHeadings = Array.from(container.querySelectorAll("h3")).map(h => h.textContent?.trim())
    expect(sectionHeadings).toContain("PERSONAL LEDGER")
    expect(sectionHeadings).toContain("WHOLESALE")

    // Verify parent group structure: Local Customers must be under PERSONAL LEDGER, not WHOLESALE
    const localCustLink = container.querySelector('a[href="/local-customers"]')
    const localCustSectionHeading = localCustLink?.closest("div")?.parentElement?.querySelector("h3")?.textContent?.trim()
    expect(localCustSectionHeading).toBe("PERSONAL LEDGER")

    const wholesaleLink = container.querySelector('a[href="/wholesale"]')
    const wholesaleSectionHeading = wholesaleLink?.closest("div")?.parentElement?.querySelector("h3")?.textContent?.trim()
    expect(wholesaleSectionHeading).toBe("WHOLESALE")
  })

  it("preserves other navigation categories and mobile drawer toggle", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    )

    // Business, Deliveries, REPORTS, SYSTEM remain intact
    expect(screen.getByRole("heading", { name: /Business/i })).toBeDefined()
    expect(screen.getByRole("heading", { name: /Deliveries/i })).toBeDefined()
    expect(screen.getByRole("heading", { name: /REPORTS/i })).toBeDefined()
    expect(screen.getByRole("heading", { name: /SYSTEM/i })).toBeDefined()

    // Price Calculator link is present with /calculator
    const calcLinks = screen.getAllByRole("link", { name: /Price Calculator/i })
    expect(calcLinks.length).toBeGreaterThan(0)
    expect(calcLinks[0].getAttribute("href")).toBe("/calculator")

    // Mobile menu toggle button
    const mobileMenuBtn = screen.getByLabelText(/Open mobile navigation menu/i)
    expect(mobileMenuBtn).toBeDefined()
    expect(mobileMenuBtn.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(mobileMenuBtn)
    expect(mobileMenuBtn.getAttribute("aria-expanded")).toBe("true")
  })

  it("closes mobile navigation drawer on Escape key and close button", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    )

    const mobileMenuBtn = screen.getByLabelText(/Open mobile navigation menu/i)
    fireEvent.click(mobileMenuBtn)
    expect(mobileMenuBtn.getAttribute("aria-expanded")).toBe("true")

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" })
    expect(mobileMenuBtn.getAttribute("aria-expanded")).toBe("false")

    // Reopen and click close button
    fireEvent.click(mobileMenuBtn)
    expect(mobileMenuBtn.getAttribute("aria-expanded")).toBe("true")
    const closeBtn = screen.getByLabelText(/Close navigation menu/i)
    fireEvent.click(closeBtn)
    expect(mobileMenuBtn.getAttribute("aria-expanded")).toBe("false")
  })
})
