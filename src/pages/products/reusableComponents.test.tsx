import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ProductPricing } from "./ProductPricing"
import { ProductCategorySelector } from "./ProductCategorySelector"
import { HamburgerFilterButton } from "./HamburgerFilterButton"
import { ProductIdentity, ProductSelector, ProductFormFields } from "@/components/products"
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

  describe("ProductIdentity Component", () => {
    it("renders product name, unit badge, and category badge", () => {
      render(
        <ProductIdentity
          name="Saffron Gold"
          unit="g"
          category="Spices & Masalas"
          size="sm"
          showCategory={true}
          showUnit={true}
        />
      )

      expect(screen.getByText("Saffron Gold")).toBeDefined()
      expect(screen.getByText("g")).toBeDefined()
      expect(screen.getByText("Spices")).toBeDefined()
    })

    it("renders dealer name when showDealer is enabled", () => {
      render(
        <ProductIdentity
          name="Kashmir Honey"
          unit="Kg"
          dealerName="Himalayan Organics"
          showDealer={true}
        />
      )

      expect(screen.getByText("Kashmir Honey")).toBeDefined()
      expect(screen.getByText("Himalayan Organics")).toBeDefined()
    })

    it("renders link to detail page when linkToDetail is true", () => {
      render(
        <MemoryRouter>
          <ProductIdentity
            id="p-123"
            name="Raw Forest Honey"
            linkToDetail={true}
          />
        </MemoryRouter>
      )

      const link = screen.getByRole("link", { name: "Raw Forest Honey" })
      expect(link.getAttribute("href")).toBe("/products/p-123")
    })

    it("renders stock status indicator when showStock is true", () => {
      render(
        <ProductIdentity
          name="Olive Oil Extra Virgin"
          unit="Ltr"
          stockQuantity={15}
          showStock={true}
        />
      )

      expect(screen.getByText(/15 Ltr/)).toBeDefined()
    })
  })

  describe("ProductSelector Component", () => {
    const mockProducts = [
      { id: "p1", name: "Acacia Honey", unit: "Kg", buying_cost: 500, wholesale_price: 650, retail_price: 800, dealer_id: "d1" },
      { id: "p2", name: "Almond Giri", unit: "Kg", buying_cost: 700, wholesale_price: 850, retail_price: 1000, dealer_id: "d1" },
      { id: "p3", name: "Mustard Oil", unit: "Ltr", buying_cost: 150, wholesale_price: 180, retail_price: 220, dealer_id: "d2" },
    ] as any

    it("renders trigger and allows selecting a product via accessible select", () => {
      const handleSelect = vi.fn()
      render(
        <ProductSelector
          products={mockProducts}
          selectedProductId=""
          onSelectProduct={handleSelect}
        />
      )

      const select = screen.getByDisplayValue("Select Product")
      fireEvent.change(select, { target: { value: "p1" } })

      expect(handleSelect).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Acacia Honey" }))
    })

    it("filters products by dealer ID when filterByDealerId is passed", () => {
      render(
        <ProductSelector
          products={mockProducts}
          selectedProductId=""
          onSelectProduct={() => {}}
          filterByDealerId="d2"
        />
      )

      const select = screen.getByDisplayValue("Select Product")
      const options = select.querySelectorAll("option")
      // 1 placeholder + 1 product for d2 = 2 options
      expect(options.length).toBe(2)
      expect(screen.getByRole("option", { name: "Mustard Oil (Ltr)" })).toBeDefined()
      expect(screen.queryByRole("option", { name: "Acacia Honey (Kg)" })).toBeNull()
    })

    it("displays selected product identity inside the trigger button", () => {
      render(
        <ProductSelector
          products={mockProducts}
          selectedProductId="p1"
          onSelectProduct={() => {}}
        />
      )

      expect(screen.getByText("Acacia Honey")).toBeDefined()
      expect(screen.getByLabelText("Clear product selection")).toBeDefined()
    })

    it("clears selection when clear button is clicked", () => {
      const handleSelect = vi.fn()
      render(
        <ProductSelector
          products={mockProducts}
          selectedProductId="p1"
          onSelectProduct={handleSelect}
        />
      )

      fireEvent.click(screen.getByLabelText("Clear product selection"))
      expect(handleSelect).toHaveBeenCalledWith("", undefined)
    })
  })

  describe("ProductFormFields Component", () => {
    it("renders all form inputs and computes live dual margin preview", () => {
      const handleChange = vi.fn()
      render(
        <ProductFormFields
          values={{
            name: "Pure Shilajit",
            category: "Other Products",
            dealerId: "d1",
            unit: "g",
            buyingCost: "1000",
            wholesalePrice: "1400",
            retailPrice: "1800",
          }}
          onChange={handleChange}
          dealers={[{ id: "d1", name: "Kashmir Valley Suppliers" }]}
        />
      )

      expect(screen.getByLabelText(/Product Name/i)).toBeDefined()
      expect(screen.getByLabelText(/Category/i)).toBeDefined()
      expect(screen.getByLabelText(/Dealer/i)).toBeDefined()
      expect(screen.getByLabelText(/Unit/i)).toBeDefined()
      expect(screen.getByLabelText(/Buying/i)).toBeDefined()
      expect(screen.getByLabelText(/Wholesale/i)).toBeDefined()
      expect(screen.getByLabelText(/Retail/i)).toBeDefined()

      // Wholesale Profit = 1400 - 1000 = 400 (40%)
      expect(screen.getByText(/₹400\.00/)).toBeDefined()
      expect(screen.getByText(/\(40%\)/)).toBeDefined()

      // Retail Profit = 1800 - 1000 = 800 (80%)
      expect(screen.getByText(/₹800\.00/)).toBeDefined()
      expect(screen.getByText(/\(80%\)/)).toBeDefined()
    })

    it("triggers onChange with field and updated value", () => {
      const handleChange = vi.fn()
      render(
        <ProductFormFields
          values={{
            name: "",
            category: "Honey",
            dealerId: "",
            unit: "Kg",
            buyingCost: "",
            wholesalePrice: "",
            retailPrice: "",
          }}
          onChange={handleChange}
          dealers={[{ id: "d1", name: "Dealer 1" }]}
        />
      )

      fireEvent.change(screen.getByLabelText(/Product Name/i), {
        target: { value: "Sidr Honey Raw" },
      })
      expect(handleChange).toHaveBeenCalledWith("name", "Sidr Honey Raw")
    })
  })
})
