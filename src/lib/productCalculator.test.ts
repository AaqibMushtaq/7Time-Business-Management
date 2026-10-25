import { describe, it, expect } from "vitest"
import {
  isContinuousUnit,
  roundCurrency,
  roundQuantity,
  calculateMoneyToQuantity,
  calculateQuantityToPrice
} from "./productCalculator"

describe("Product Calculator Engine", () => {
  describe("Unit Classification (isContinuousUnit)", () => {
    it("identifies continuous decimal units correctly", () => {
      expect(isContinuousUnit("Kg")).toBe(true)
      expect(isContinuousUnit("kg")).toBe(true)
      expect(isContinuousUnit("KGS")).toBe(true)
      expect(isContinuousUnit("kilogram")).toBe(true)
      expect(isContinuousUnit("Ltr")).toBe(true)
      expect(isContinuousUnit("liter")).toBe(true)
      expect(isContinuousUnit("litre")).toBe(true)
      expect(isContinuousUnit("gm")).toBe(true)
      expect(isContinuousUnit("gram")).toBe(true)
      expect(isContinuousUnit("ml")).toBe(true)
      expect(isContinuousUnit("mtr")).toBe(true)
      expect(isContinuousUnit("meter")).toBe(true)
    })

    it("identifies discrete / countable units correctly", () => {
      expect(isContinuousUnit("pcs")).toBe(false)
      expect(isContinuousUnit("pc")).toBe(false)
      expect(isContinuousUnit("piece")).toBe(false)
      expect(isContinuousUnit("Box")).toBe(false)
      expect(isContinuousUnit("boxes")).toBe(false)
      expect(isContinuousUnit("Bottle")).toBe(false)
      expect(isContinuousUnit("pkt")).toBe(false)
      expect(isContinuousUnit("packet")).toBe(false)
      expect(isContinuousUnit("tin")).toBe(false)
      expect(isContinuousUnit("can")).toBe(false)
      expect(isContinuousUnit("dozen")).toBe(false)
      expect(isContinuousUnit("")).toBe(false)
      expect(isContinuousUnit(null)).toBe(false)
      expect(isContinuousUnit(undefined)).toBe(false)
    })
  })

  describe("Rounding Helpers", () => {
    it("rounds currency safely to 2 decimals avoiding floating point artifacts", () => {
      expect(roundCurrency(10.004)).toBe(10.00)
      expect(roundCurrency(10.005)).toBe(10.01)
      expect(roundCurrency(19.999)).toBe(20.00)
      expect(roundCurrency(NaN)).toBe(0)
    })

    it("rounds quantity with specified precision", () => {
      expect(roundQuantity(2.34567, 3)).toBe(2.346)
      expect(roundQuantity(2.34567, 2)).toBe(2.35)
      expect(roundQuantity(2.34567, 0)).toBe(2)
    })
  })

  describe("Calculation Mode A: Money to Quantity", () => {
    it("calculates exact and practical quantity for whole units (₹500 at ₹250/unit = 2 units)", () => {
      const res = calculateMoneyToQuantity({
        amount: 500,
        unitPrice: 250,
        allowFractional: false
      })

      expect(res.isValid).toBe(true)
      expect(res.amount).toBe(500)
      expect(res.unitPrice).toBe(250)
      expect(res.exactQuantity).toBe(2)
      expect(res.practicalQuantity).toBe(2)
      expect(res.practicalValue).toBe(500)
      expect(res.remainingMoney).toBe(0)
      expect(res.hasStockDeficit).toBe(false)
    })

    it("calculates practical quantity with remainder when money does not evenly divide discrete units", () => {
      // ₹600 at ₹250 per piece => exact 2.4 pcs, practical 2 pcs, value ₹500, change ₹100
      const res = calculateMoneyToQuantity({
        amount: 600,
        unitPrice: 250,
        allowFractional: false
      })

      expect(res.isValid).toBe(true)
      expect(res.exactQuantity).toBe(2.4)
      expect(res.practicalQuantity).toBe(2)
      expect(res.practicalValue).toBe(500)
      expect(res.remainingMoney).toBe(100)
    })

    it("handles money less than 1 whole unit gracefully", () => {
      // ₹150 at ₹250 per piece => practical 0 pcs, change ₹150
      const res = calculateMoneyToQuantity({
        amount: 150,
        unitPrice: 250,
        allowFractional: false
      })

      expect(res.isValid).toBe(true)
      expect(res.exactQuantity).toBe(0.6)
      expect(res.practicalQuantity).toBe(0)
      expect(res.practicalValue).toBe(0)
      expect(res.remainingMoney).toBe(150)
    })

    it("calculates fractional quantities for continuous units (e.g. ₹600 at ₹250/kg = 2.400 kg)", () => {
      const res = calculateMoneyToQuantity({
        amount: 600,
        unitPrice: 250,
        allowFractional: true,
        decimalPlaces: 3
      })

      expect(res.isValid).toBe(true)
      expect(res.exactQuantity).toBe(2.4)
      expect(res.practicalQuantity).toBe(2.4)
      expect(res.practicalValue).toBe(600)
      expect(res.remainingMoney).toBe(0)
    })

    it("detects stock deficit when practical quantity exceeds available stock", () => {
      const res = calculateMoneyToQuantity({
        amount: 1000,
        unitPrice: 200, // buys 5 units
        allowFractional: false,
        availableStock: 3 // only 3 in stock
      })

      expect(res.isValid).toBe(true)
      expect(res.practicalQuantity).toBe(5)
      expect(res.hasStockDeficit).toBe(true)
      expect(res.stockDeficit).toBe(2)
      expect(res.availableStock).toBe(3)
    })

    it("does not report deficit when stock is sufficient or null", () => {
      const res1 = calculateMoneyToQuantity({
        amount: 500,
        unitPrice: 250,
        availableStock: 10
      })
      expect(res1.hasStockDeficit).toBe(false)
      expect(res1.stockDeficit).toBe(0)

      const res2 = calculateMoneyToQuantity({
        amount: 500,
        unitPrice: 250,
        availableStock: null
      })
      expect(res2.hasStockDeficit).toBe(false)
    })

    it("rejects zero or negative amount", () => {
      const resZero = calculateMoneyToQuantity({ amount: 0, unitPrice: 250 })
      expect(resZero.isValid).toBe(false)
      expect(resZero.errorMessage).toContain("Amount must be greater than zero")

      const resNeg = calculateMoneyToQuantity({ amount: -50, unitPrice: 250 })
      expect(resNeg.isValid).toBe(false)
      expect(resNeg.errorMessage).toContain("Amount must be greater than zero")
    })

    it("rejects zero or negative unit price", () => {
      const resZero = calculateMoneyToQuantity({ amount: 500, unitPrice: 0 })
      expect(resZero.isValid).toBe(false)
      expect(resZero.errorMessage).toContain("Unit selling price must be greater than zero")

      const resNeg = calculateMoneyToQuantity({ amount: 500, unitPrice: -10 })
      expect(resNeg.isValid).toBe(false)
      expect(resNeg.errorMessage).toContain("Unit selling price must be greater than zero")
    })

    it("rejects NaN or missing inputs", () => {
      const resNaN = calculateMoneyToQuantity({ amount: NaN, unitPrice: 250 })
      expect(resNaN.isValid).toBe(false)
    })
  })

  describe("Calculation Mode B: Quantity to Price", () => {
    it("calculates total price for integer quantity (5 units at ₹150 = ₹750)", () => {
      const res = calculateQuantityToPrice({
        quantity: 5,
        unitPrice: 150
      })

      expect(res.isValid).toBe(true)
      expect(res.quantity).toBe(5)
      expect(res.unitPrice).toBe(150)
      expect(res.totalPrice).toBe(750)
      expect(res.hasStockDeficit).toBe(false)
    })

    it("calculates total price for fractional quantity when allowed (2.5 kg at ₹400 = ₹1000)", () => {
      const res = calculateQuantityToPrice({
        quantity: 2.5,
        unitPrice: 400,
        allowFractional: true
      })

      expect(res.isValid).toBe(true)
      expect(res.quantity).toBe(2.5)
      expect(res.totalPrice).toBe(1000)
    })

    it("rejects fractional quantity when product requires whole discrete units", () => {
      const res = calculateQuantityToPrice({
        quantity: 2.5,
        unitPrice: 400,
        allowFractional: false // discrete unit (e.g. piece)
      })

      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("whole discrete units")
    })

    it("detects stock deficit when requested quantity exceeds available inventory", () => {
      const res = calculateQuantityToPrice({
        quantity: 12,
        unitPrice: 100,
        availableStock: 8
      })

      expect(res.isValid).toBe(true)
      expect(res.hasStockDeficit).toBe(true)
      expect(res.stockDeficit).toBe(4)
      expect(res.availableStock).toBe(8)
    })

    it("rejects zero or negative quantity", () => {
      const resZero = calculateQuantityToPrice({ quantity: 0, unitPrice: 100 })
      expect(resZero.isValid).toBe(false)
      expect(resZero.errorMessage).toContain("Quantity must be greater than zero")

      const resNeg = calculateQuantityToPrice({ quantity: -3, unitPrice: 100 })
      expect(resNeg.isValid).toBe(false)
      expect(resNeg.errorMessage).toContain("Quantity must be greater than zero")
    })

    it("rejects zero or negative unit price", () => {
      const resZero = calculateQuantityToPrice({ quantity: 5, unitPrice: 0 })
      expect(resZero.isValid).toBe(false)
      expect(resZero.errorMessage).toContain("Unit selling price must be greater than zero")
    })

    it("prevents floating-point artifacts (e.g. 3 * 33.33 = 99.99)", () => {
      const res = calculateQuantityToPrice({
        quantity: 3,
        unitPrice: 33.33
      })

      expect(res.isValid).toBe(true)
      expect(res.totalPrice).toBe(99.99)
    })
  })
})
