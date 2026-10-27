import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProductPricing } from "./ProductPricing"
import { ProductCategorySelector } from "./ProductCategorySelector"
import { HamburgerFilterButton } from "./HamburgerFilterButton"
import { BUSINESS_CATEGORIES } from "@/lib/productCategories"

describe("Product Reusable Components Architecture", () => {
  describe("ProductPricing Component", () => {
    it("renders buying, wholesale, retail prices and calculated wholesale and retail profit in standard mode", () => {
      render(
        <ProductPricing
          buyingCost={650}
          wholesalePrice={750}
          retailPrice={850}
        />
      )

      expect(screen.getByText("BUYING")).toBeDefined()
      expect(screen.getByText("WHOLESALE")).toBeDefined()
      expect(screen.getByText("RETAIL")).toBeDefined()
      expect(screen.getAllByText("₹650.00").length).toBeGreaterThan(0)
      expect(screen.getAllByText("₹750.00").length).toBeGreaterThan(0)
      expect(screen.getAllByText("₹850.00").length).toBeGreaterThan(0)

      // Separate Wholesale Profit = 750 - 650 = 100 (15%)
      expect(screen.getByText("Wholesale Profit")).toBeDefined()
      expect(screen.getByText(/₹100\.00\s*\(15%\)/)).toBeDefined()

      // Separate Retail Profit = 850 - 650 = 200 (31%)
      expect(screen.getByText("Retail Profit")).toBeDefined()
      expect(screen.getByText(/₹200\.00\s*\(31%\)/)).toBeDefined()
    })

    it("renders compact 3-column micro pricing (B, W, R) for mobile 3-column grid", () => {
      render(
        <ProductPricing
          buyingCost={400}
          wholesalePrice={480}
          retailPrice={550}
          compact
        />
      )

      expect(screen.getByText("B")).toBeDefined()
      expect(screen.getByText("W")).toBeDefined()
      expect(screen.getByText("R")).toBeDefined()
      expect(screen.getAllByText("₹400.00").length).toBeGreaterThan(0)
      expect(screen.getAllByText("₹480.00").length).toBeGreaterThan(0)
      expect(screen.getAllByText("₹550.00").length).toBeGreaterThan(0)

      // Dual Micro Profit = W.Profit (480-400=80, 20%) & R.Profit (550-400=150, 38%)
      expect(screen.getByText("W.Profit")).toBeDefined()
      expect(screen.getByText(/₹80\.00\s*\(20%\)/)).toBeDefined()
      expect(screen.getByText("R.Profit")).toBeDefined()
      expect(screen.getByText(/₹150\.00\s*\(38%\)/)).toBeDefined()
    })

    it("handles Retail-only products without showing misleading wholesale profit", () => {
      render(
        <ProductPricing
          buyingCost={500}
          wholesalePrice={null}
          retailPrice={700}
        />
      )

      expect(screen.getByText("Wholesale Profit")).toBeDefined()
      expect(screen.getByText("Not sold in wholesale")).toBeDefined()
      expect(screen.getByText("Retail Profit")).toBeDefined()
      expect(screen.getByText(/₹200\.00\s*\(40%\)/)).toBeDefined()
    })

    it("handles Wholesale-only products without showing misleading retail profit", () => {
      render(
        <ProductPricing
          buyingCost={300}
          wholesalePrice={390}
          retailPrice={null}
        />
      )

      expect(screen.getByText("Wholesale Profit")).toBeDefined()
      expect(screen.getByText(/₹90\.00\s*\(30%\)/)).toBeDefined()
      expect(screen.getByText("Retail Profit")).toBeDefined()
      expect(screen.getByText("Not sold in retail")).toBeDefined()
    })

    it("handles neither selling price configured", () => {
      render(
        <ProductPricing
          buyingCost={200}
          wholesalePrice={null}
          retailPrice={null}
        />
      )

      expect(screen.getByText("Not sold in wholesale")).toBeDefined()
      expect(screen.getByText("Not sold in retail")).toBeDefined()
    })

    it("renders negative profit with negative styling when wholesale is lower than cost", () => {
      render(
        <ProductPricing
          buyingCost={500}
          wholesalePrice={450}
          retailPrice={600}
        />
      )

      expect(screen.getByText(/-₹50\.00\s*\(-10%\)/)).toBeDefined()
      expect(screen.getByText(/₹100\.00\s*\(20%\)/)).toBeDefined()
    })
  })

  describe("ProductCategorySelector Component", () => {
    it("renders the 9 canonical business categories without the filter-only 'all' option", () => {
      render(
        <ProductCategorySelector
          value=""
          onChange={() => {}}
        />
      )

      const select = screen.getByRole("combobox")
      expect(select).toBeDefined()

      // Should have 1 placeholder + 9 business categories = 10 options
      const options = select.querySelectorAll("option")
      expect(options.length).toBe(10)

      BUSINESS_CATEGORIES.forEach((cat) => {
        expect(screen.getByRole("option", { name: cat.name })).toBeDefined()
      })

      // Must NOT contain 'All Products'
      expect(screen.queryByRole("option", { name: "All Products" })).toBeNull()
    })

    it("triggers onChange with selected category name", () => {
      const handleChange = vi.fn()
      render(
        <ProductCategorySelector
          value=""
          onChange={handleChange}
        />
      )

      const select = screen.getByRole("combobox")
      fireEvent.change(select, { target: { value: "Honey" } })

      expect(handleChange).toHaveBeenCalledWith("Honey")
    })

    it("displays error message and invalid styling when error prop is present", () => {
      render(
        <ProductCategorySelector
          value=""
          onChange={() => {}}
          error="Please select a valid category"
        />
      )

      expect(screen.getByText("Please select a valid category")).toBeDefined()
      const select = screen.getByRole("combobox")
      expect(select.getAttribute("aria-invalid")).toBe("true")
    })
  })

  describe("HamburgerFilterButton Component", () => {
    it("renders desktop filter button with 3-bar icon and badge", () => {
      const handleClick = vi.fn()
      render(
        <HamburgerFilterButton
          isOpen={false}
          onClick={handleClick}
          activeCount={3}
        />
      )

      const button = screen.getByRole("button", { name: /Filters/i })
      expect(button).toBeDefined()
      expect(screen.getByText("Filters")).toBeDefined()
      expect(screen.getByText("3")).toBeDefined()

      fireEvent.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("renders mobile hamburger filter button with accessible label and active badge", () => {
      const handleClick = vi.fn()
      render(
        <HamburgerFilterButton
          isMobile
          isOpen={false}
          onClick={handleClick}
          activeCount={2}
        />
      )

      const button = screen.getByRole("button", { name: "Open filters panel" })
      expect(button).toBeDefined()
      expect(screen.getByText("2")).toBeDefined()

      fireEvent.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})
