import { describe, it, expect } from "vitest"
import {
  isContinuousUnit,
  normalizeUnit,
  areUnitsCompatible,
  convertQuantity,
  getCompatibleUnits,
  formatConvenientQuantity,
  registerUnit,
  calculateMoneyToQuantity,
  calculateQuantityToPrice
} from "./productCalculator"

describe("Product Calculator & Metric Unit Conversion Engine", () => {
  describe("Unit Classification & Normalization", () => {
    it("identifies continuous decimal units correctly", () => {
      expect(isContinuousUnit("Kg")).toBe(true)
      expect(isContinuousUnit("kg")).toBe(true)
      expect(isContinuousUnit("KGS")).toBe(true)
      expect(isContinuousUnit("kilogram")).toBe(true)
      expect(isContinuousUnit("Ltr")).toBe(true)
      expect(isContinuousUnit("liter")).toBe(true)
      expect(isContinuousUnit("litre")).toBe(true)
      expect(isContinuousUnit("L")).toBe(true)
      expect(isContinuousUnit("gm")).toBe(true)
      expect(isContinuousUnit("gram")).toBe(true)
      expect(isContinuousUnit("g")).toBe(true)
      expect(isContinuousUnit("ml")).toBe(true)
      expect(isContinuousUnit("mL")).toBe(true)
    })

    it("identifies discrete count and packaging units correctly", () => {
      expect(isContinuousUnit("pcs")).toBe(false)
      expect(isContinuousUnit("pc")).toBe(false)
      expect(isContinuousUnit("piece")).toBe(false)
      expect(isContinuousUnit("unit")).toBe(false)
      expect(isContinuousUnit("Box")).toBe(false)
      expect(isContinuousUnit("boxes")).toBe(false)
      expect(isContinuousUnit("Bottle")).toBe(false)
      expect(isContinuousUnit("bottles")).toBe(false)
      expect(isContinuousUnit("jar")).toBe(false)
      expect(isContinuousUnit("pack")).toBe(false)
      expect(isContinuousUnit("tin")).toBe(false)
      expect(isContinuousUnit("carton")).toBe(false)
      expect(isContinuousUnit("")).toBe(false)
      expect(isContinuousUnit(null)).toBe(false)
      expect(isContinuousUnit(undefined)).toBe(false)
    })

    it("normalizes alias variations to canonical unit definitions", () => {
      const kgDef = normalizeUnit("KILOGRAMS")
      expect(kgDef?.code).toBe("kg")
      expect(kgDef?.category).toBe("WEIGHT")
      expect(kgDef?.conversionToBase).toBe(1)

      const gDef = normalizeUnit("gms")
      expect(gDef?.code).toBe("g")
      expect(gDef?.category).toBe("WEIGHT")
      expect(gDef?.conversionToBase).toBe(0.001)

      const lDef = normalizeUnit("ltrs")
      expect(lDef?.code).toBe("l")
      expect(lDef?.category).toBe("VOLUME")

      const mlDef = normalizeUnit("milliliters")
      expect(mlDef?.code).toBe("ml")
      expect(mlDef?.category).toBe("VOLUME")
      expect(mlDef?.conversionToBase).toBe(0.001)

      const btlDef = normalizeUnit("bottles")
      expect(btlDef?.code).toBe("bottle")
      expect(btlDef?.category).toBe("PACKAGING")
    })
  })

  describe("Metric Unit Conversions (L <-> mL and kg <-> g)", () => {
    it("converts Volume: Litre to Millilitre (1 L = 1,000 mL)", () => {
      const conv1 = convertQuantity(1, "L", "mL")
      expect(conv1.success).toBe(true)
      expect(conv1.convertedValue).toBe(1000)

      const conv2 = convertQuantity(2.5, "L", "ml")
      expect(conv2.success).toBe(true)
      expect(conv2.convertedValue).toBe(2500)
    })

    it("converts Volume: Millilitre to Litre (500 mL = 0.5 L)", () => {
      const conv1 = convertQuantity(500, "mL", "L")
      expect(conv1.success).toBe(true)
      expect(conv1.convertedValue).toBe(0.5)

      const conv2 = convertQuantity(250, "ml", "ltr")
      expect(conv2.success).toBe(true)
      expect(conv2.convertedValue).toBe(0.25)
    })

    it("converts Weight: Kilogram to Gram (1 kg = 1,000 g)", () => {
      const conv1 = convertQuantity(1, "kg", "g")
      expect(conv1.success).toBe(true)
      expect(conv1.convertedValue).toBe(1000)

      const conv2 = convertQuantity(0.75, "kg", "g")
      expect(conv2.success).toBe(true)
      expect(conv2.convertedValue).toBe(750)
    })

    it("converts Weight: Gram to Kilogram (750 g = 0.75 kg)", () => {
      const conv1 = convertQuantity(750, "g", "kg")
      expect(conv1.success).toBe(true)
      expect(conv1.convertedValue).toBe(0.75)

      const conv2 = convertQuantity(500, "gm", "kilogram")
      expect(conv2.success).toBe(true)
      expect(conv2.convertedValue).toBe(0.5)
    })
  })

  describe("Unit Compatibility & Prevention of Incompatible Conversions", () => {
    it("recognizes compatible units in same category", () => {
      expect(areUnitsCompatible("kg", "g")).toBe(true)
      expect(areUnitsCompatible("L", "mL")).toBe(true)
      expect(areUnitsCompatible("pc", "unit")).toBe(true)
    })

    it("prevents cross-category conversions like Grams to Litres (Weight vs Volume)", () => {
      expect(areUnitsCompatible("g", "L")).toBe(false)
      const res = convertQuantity(500, "g", "L")
      expect(res.success).toBe(false)
      expect(res.error).toContain("incompatible unit categories")
      expect(res.error).toContain("Density information is required")
    })

    it("prevents converting packaged items to weight or volume without explicit contents", () => {
      expect(areUnitsCompatible("bottle", "kg")).toBe(false)
      const res = convertQuantity(3, "bottle", "kg")
      expect(res.success).toBe(false)
      expect(res.error).toContain("Packaged items cannot be converted to weight or volume")
    })

    it("lists only compatible units for a product", () => {
      const kgUnits = getCompatibleUnits("kg")
      expect(kgUnits.map((u) => u.code)).toEqual(["kg", "g"])

      const lUnits = getCompatibleUnits("L")
      expect(lUnits.map((u) => u.code)).toEqual(["l", "ml"])

      const jarUnits = getCompatibleUnits("jar")
      expect(jarUnits.map((u) => u.code)).toEqual(["jar"])
    })
  })

  describe("Extensible Unit Registry", () => {
    it("allows registering custom units without duplicating calculation logic", () => {
      registerUnit(
        {
          code: "tonne",
          name: "Metric Tonne",
          symbol: "t",
          category: "WEIGHT",
          baseUnit: "kg",
          conversionToBase: 1000,
          isFractional: true,
          decimalPrecision: 3
        },
        ["t", "ton", "tonnes"]
      )

      expect(areUnitsCompatible("tonne", "kg")).toBe(true)
      const res = convertQuantity(2, "tonne", "kg")
      expect(res.success).toBe(true)
      expect(res.convertedValue).toBe(2000)

      const resGram = convertQuantity(1, "tonne", "g")
      expect(resGram.success).toBe(true)
      expect(resGram.convertedValue).toBe(1000000)
    })
  })

  describe("Convenient Metric Formatting", () => {
    it("formats sub-kilogram weight as convenient grams", () => {
      const conv = formatConvenientQuantity(0.5, "kg")
      expect(conv.primary).toBe("500 g")
      expect(conv.secondary).toBe("0.5 kg")
      expect(conv.convenientUnit).toBe("g")
      expect(conv.convenientValue).toBe(500)
    })

    it("formats sub-litre volume as convenient millilitres", () => {
      const conv = formatConvenientQuantity(0.25, "L")
      expect(conv.primary).toBe("250 mL")
      expect(conv.secondary).toBe("0.25 L")
      expect(conv.convenientUnit).toBe("mL")
      expect(conv.convenientValue).toBe(250)
    })

    it("formats multi-litre volume with both L and mL", () => {
      const conv = formatConvenientQuantity(2.5, "L")
      expect(conv.primary).toBe("2.5 L")
      expect(conv.secondary).toBe("2,500 mL")
    })

    it("formats count and packaging as whole discrete units", () => {
      const conv = formatConvenientQuantity(3, "piece")
      expect(conv.primary).toBe("3 pc")
      expect(conv.convenientValue).toBe(3)
    })
  })

  describe("Calculation Mode A: Money to Quantity", () => {
    it("Example 1: ₹100 for product priced at ₹200/kg = 500 g (0.500 kg)", () => {
      const res = calculateMoneyToQuantity({
        amount: 100,
        unitPrice: 200,
        productUnit: "kg"
      })

      expect(res.isValid).toBe(true)
      expect(res.amount).toBe(100)
      expect(res.unitPrice).toBe(200)
      expect(res.exactQuantityBase).toBe(0.5)
      expect(res.practicalQuantityBase).toBe(0.5)
      expect(res.convenientQuantity.primary).toBe("500 g")
      expect(res.practicalValue).toBe(100)
      expect(res.remainingMoney).toBe(0)
    })

    it("Example 2: ₹60 for product priced at ₹120/L = 500 mL (0.500 L)", () => {
      const res = calculateMoneyToQuantity({
        amount: 60,
        unitPrice: 120,
        productUnit: "L"
      })

      expect(res.isValid).toBe(true)
      expect(res.exactQuantityBase).toBe(0.5)
      expect(res.practicalQuantityBase).toBe(0.5)
      expect(res.convenientQuantity.primary).toBe("500 mL")
      expect(res.practicalValue).toBe(60)
      expect(res.remainingMoney).toBe(0)
    })

    it("Example 3: ₹150 for product priced at ₹50/piece = 3 pieces", () => {
      const res = calculateMoneyToQuantity({
        amount: 150,
        unitPrice: 50,
        productUnit: "piece"
      })

      expect(res.isValid).toBe(true)
      expect(res.practicalQuantityBase).toBe(3)
      expect(res.convenientQuantity.primary).toBe("3 pc")
      expect(res.practicalValue).toBe(150)
      expect(res.remainingMoney).toBe(0)
    })

    it("allows viewing calculated quantity directly in grams for a kg product", () => {
      const res = calculateMoneyToQuantity({
        amount: 50,
        unitPrice: 200, // 0.25 kg = 250 g
        productUnit: "kg",
        displayUnit: "g"
      })

      expect(res.isValid).toBe(true)
      expect(res.exactQuantity).toBe(250)
      expect(res.practicalQuantity).toBe(250)
      expect(res.displayUnit).toBe("g")
    })

    it("floors discrete packaged goods to whole integer packages with change remaining", () => {
      // ₹100 for jars priced at ₹60/jar -> 1 jar, ₹40 change
      const res = calculateMoneyToQuantity({
        amount: 100,
        unitPrice: 60,
        productUnit: "jar"
      })

      expect(res.isValid).toBe(true)
      expect(res.practicalQuantity).toBe(1)
      expect(res.practicalValue).toBe(60)
      expect(res.remainingMoney).toBe(40)
    })

    it("detects stock deficit against available inventory", () => {
      const res = calculateMoneyToQuantity({
        amount: 1000,
        unitPrice: 100, // buys 10 kg
        productUnit: "kg",
        availableStock: 6 // only 6 kg in stock
      })

      expect(res.isValid).toBe(true)
      expect(res.hasStockDeficit).toBe(true)
      expect(res.stockDeficit).toBe(4)
      expect(res.availableStock).toBe(6)
    })

    it("rejects missing or empty product unit", () => {
      const res = calculateMoneyToQuantity({
        amount: 100,
        unitPrice: 50,
        productUnit: ""
      })
      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("Product has no defined measurement unit")
    })

    it("rejects zero or negative cash amounts", () => {
      const res = calculateMoneyToQuantity({
        amount: 0,
        unitPrice: 50,
        productUnit: "kg"
      })
      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("Amount must be greater than zero")
    })
  })

  describe("Calculation Mode B: Quantity to Price", () => {
    it("Example 1: 750 g for product priced at ₹200/kg = ₹150", () => {
      const res = calculateQuantityToPrice({
        quantity: 750,
        inputUnit: "g",
        productUnit: "kg",
        unitPrice: 200
      })

      expect(res.isValid).toBe(true)
      expect(res.quantity).toBe(750)
      expect(res.inputUnit).toBe("g")
      expect(res.baseQuantity).toBe(0.75)
      expect(res.productBaseUnit).toBe("kg")
      expect(res.equivalentUnitPrice).toBe(0.2) // ₹0.20 per gram
      expect(res.totalPrice).toBe(150)
    })

    it("Example 2: 250 mL for product priced at ₹120/L = ₹30", () => {
      const res = calculateQuantityToPrice({
        quantity: 250,
        inputUnit: "mL",
        productUnit: "L",
        unitPrice: 120
      })

      expect(res.isValid).toBe(true)
      expect(res.quantity).toBe(250)
      expect(res.baseQuantity).toBe(0.25)
      expect(res.totalPrice).toBe(30)
    })

    it("Example 3: 2.5 L for product priced at ₹120/L = ₹300", () => {
      const res = calculateQuantityToPrice({
        quantity: 2.5,
        inputUnit: "L",
        productUnit: "L",
        unitPrice: 120
      })

      expect(res.isValid).toBe(true)
      expect(res.quantity).toBe(2.5)
      expect(res.baseQuantity).toBe(2.5)
      expect(res.totalPrice).toBe(300)
    })

    it("rejects incompatible unit entered for a product (e.g. 500 g for ₹120/L juice)", () => {
      const res = calculateQuantityToPrice({
        quantity: 500,
        inputUnit: "g",
        productUnit: "L",
        unitPrice: 120
      })

      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("Cannot convert between incompatible units")
    })

    it("rejects fractional quantity for discrete packaging products (e.g. 2.5 boxes)", () => {
      const res = calculateQuantityToPrice({
        quantity: 2.5,
        inputUnit: "box",
        productUnit: "box",
        unitPrice: 400
      })

      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("whole discrete units (no fractions)")
    })

    it("calculates discrete packaged units accurately (3 bottles at ₹75 = ₹225)", () => {
      const res = calculateQuantityToPrice({
        quantity: 3,
        inputUnit: "bottle",
        productUnit: "bottle",
        unitPrice: 75
      })

      expect(res.isValid).toBe(true)
      expect(res.quantity).toBe(3)
      expect(res.totalPrice).toBe(225)
    })

    it("warns about stock deficit converted from input unit to base unit", () => {
      // Available stock is 10 kg. User enters 15,000 g (15 kg).
      const res = calculateQuantityToPrice({
        quantity: 15000,
        inputUnit: "g",
        productUnit: "kg",
        unitPrice: 100,
        availableStock: 10
      })

      expect(res.isValid).toBe(true)
      expect(res.hasStockDeficit).toBe(true)
      expect(res.stockDeficitBase).toBe(5) // 5 kg deficit
      expect(res.stockDeficit).toBe(5000) // 5,000 g deficit
      expect(res.availableStock).toBe(10)
    })

    it("rejects missing or empty product unit", () => {
      const res = calculateQuantityToPrice({
        quantity: 5,
        productUnit: "",
        unitPrice: 100
      })
      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("Product has no defined measurement unit")
    })

    it("rejects zero or negative quantities", () => {
      const resZero = calculateQuantityToPrice({
        quantity: 0,
        productUnit: "kg",
        unitPrice: 100
      })
      expect(resZero.isValid).toBe(false)
      expect(resZero.errorMessage).toContain("Quantity must be greater than zero")

      const resNeg = calculateQuantityToPrice({
        quantity: -2,
        productUnit: "kg",
        unitPrice: 100
      })
      expect(resNeg.isValid).toBe(false)
      expect(resNeg.errorMessage).toContain("Quantity must be greater than zero")
    })

    it("rejects zero or negative unit prices", () => {
      const res = calculateQuantityToPrice({
        quantity: 5,
        productUnit: "kg",
        unitPrice: 0
      })
      expect(res.isValid).toBe(false)
      expect(res.errorMessage).toContain("Unit selling price must be greater than zero")
    })
  })
})
