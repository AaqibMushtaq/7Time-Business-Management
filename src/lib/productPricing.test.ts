import { describe, it, expect } from "vitest"
import {
  isPriceConfigured,
  normalizePrice,
  calculateDualProfit,
} from "./productPricing"

describe("Product Pricing & Dual Profit Calculations", () => {
  describe("isPriceConfigured", () => {
    it("returns true for valid positive numbers", () => {
      expect(isPriceConfigured(100)).toBe(true)
      expect(isPriceConfigured("250.50")).toBe(true)
    })

    it("returns true for explicitly configured zero", () => {
      expect(isPriceConfigured(0)).toBe(true)
      expect(isPriceConfigured("0")).toBe(true)
    })

    it("returns false for null, undefined, or empty string", () => {
      expect(isPriceConfigured(null)).toBe(false)
      expect(isPriceConfigured(undefined)).toBe(false)
      expect(isPriceConfigured("")).toBe(false)
      expect(isPriceConfigured("   ")).toBe(false)
      expect(isPriceConfigured(NaN)).toBe(false)
    })
  })

  describe("normalizePrice", () => {
    it("converts valid numbers and numeric strings", () => {
      expect(normalizePrice(700)).toBe(700)
      expect(normalizePrice("1000")).toBe(1000)
      expect(normalizePrice(0)).toBe(0)
    })

    it("returns null for unconfigured prices", () => {
      expect(normalizePrice(null)).toBe(null)
      expect(normalizePrice(undefined)).toBe(null)
      expect(normalizePrice("")).toBe(null)
    })
  })

  describe("calculateDualProfit", () => {
    it("calculates separate wholesale and retail profit when both prices are configured", () => {
      // Buying: 700, Wholesale: 1000 (profit 300, 43%), Retail: 1300 (profit 600, 86%)
      const result = calculateDualProfit(700, 1000, 1300)

      expect(result.hasBuyingCost).toBe(true)
      expect(result.buyingCost).toBe(700)

      // Wholesale
      expect(result.wholesale.isConfigured).toBe(true)
      expect(result.wholesale.profit).toBe(300)
      expect(result.wholesale.profitPercent).toBe(43)
      expect(result.wholesale.isPositive).toBe(true)
      expect(result.wholesale.isNegative).toBe(false)

      // Retail
      expect(result.retail.isConfigured).toBe(true)
      expect(result.retail.profit).toBe(600)
      expect(result.retail.profitPercent).toBe(86)
      expect(result.retail.isPositive).toBe(true)
      expect(result.retail.isNegative).toBe(false)
    })

    it("handles Retail-only products without calculating misleading wholesale profit", () => {
      const result = calculateDualProfit(500, null, 750)

      // Wholesale is not configured
      expect(result.wholesale.isConfigured).toBe(false)
      expect(result.wholesale.profit).toBe(null)
      expect(result.wholesale.profitPercent).toBe(null)
      expect(result.wholesale.displayPrice).toBe("Not set")
      expect(result.wholesale.statusText).toBe("Not sold in wholesale")

      // Retail is calculated
      expect(result.retail.isConfigured).toBe(true)
      expect(result.retail.profit).toBe(250)
      expect(result.retail.profitPercent).toBe(50)
      expect(result.retail.displayPrice).toBe("₹750.00")
    })

    it("handles Wholesale-only products without calculating misleading retail profit", () => {
      const result = calculateDualProfit(400, 500, undefined)

      // Wholesale is calculated
      expect(result.wholesale.isConfigured).toBe(true)
      expect(result.wholesale.profit).toBe(100)
      expect(result.wholesale.profitPercent).toBe(25)

      // Retail is not configured
      expect(result.retail.isConfigured).toBe(false)
      expect(result.retail.profit).toBe(null)
      expect(result.retail.profitPercent).toBe(null)
      expect(result.retail.displayPrice).toBe("Not set")
      expect(result.retail.statusText).toBe("Not sold in retail")
    })

    it("handles neither selling price configured", () => {
      const result = calculateDualProfit(300, null, null)

      expect(result.wholesale.isConfigured).toBe(false)
      expect(result.wholesale.profit).toBe(null)
      expect(result.retail.isConfigured).toBe(false)
      expect(result.retail.profit).toBe(null)
    })

    it("preserves negative profit (loss) without clamping to zero", () => {
      // Buying 1000, Wholesale 800 (-200 loss, -20%), Retail 900 (-100 loss, -10%)
      const result = calculateDualProfit(1000, 800, 900)

      expect(result.wholesale.profit).toBe(-200)
      expect(result.wholesale.profitPercent).toBe(-20)
      expect(result.wholesale.isNegative).toBe(true)
      expect(result.wholesale.isPositive).toBe(false)

      expect(result.retail.profit).toBe(-100)
      expect(result.retail.profitPercent).toBe(-10)
      expect(result.retail.isNegative).toBe(true)
      expect(result.retail.isPositive).toBe(false)
    })

    it("preserves valid zero profit when selling price matches buying price", () => {
      const result = calculateDualProfit(500, 500, 500)

      expect(result.wholesale.profit).toBe(0)
      expect(result.wholesale.profitPercent).toBe(0)
      expect(result.wholesale.isZero).toBe(true)

      expect(result.retail.profit).toBe(0)
      expect(result.retail.profitPercent).toBe(0)
      expect(result.retail.isZero).toBe(true)
    })

    it("handles missing buying price gracefully without throwing", () => {
      const result = calculateDualProfit(null, 1000, 1200)

      expect(result.hasBuyingCost).toBe(false)
      expect(result.wholesale.isConfigured).toBe(true)
      expect(result.wholesale.profit).toBe(null)
      expect(result.wholesale.displayProfit).toBe("No buying cost")

      expect(result.retail.isConfigured).toBe(true)
      expect(result.retail.profit).toBe(null)
      expect(result.retail.displayProfit).toBe("No buying cost")
    })

    it("handles zero buying cost without division-by-zero errors", () => {
      const result = calculateDualProfit(0, 100, 150)

      expect(result.hasBuyingCost).toBe(true)
      expect(result.wholesale.profit).toBe(100)
      expect(result.wholesale.profitPercent).toBe(0) // division by zero avoided
      expect(result.retail.profit).toBe(150)
      expect(result.retail.profitPercent).toBe(0)
    })
  })
})
