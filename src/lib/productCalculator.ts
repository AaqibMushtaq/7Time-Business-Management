/**
 * Product Price and Quantity Calculator Engine
 *
 * Implements authoritative retail and wholesale calculation rules:
 * - Mode A: Money to Quantity (Customer cash -> exact & practical sellable quantity, change to return)
 * - Mode B: Quantity to Price (Ordered quantity -> exact total price)
 * - Safe currency rounding preventing floating-point precision artifacts
 * - Dynamic unit classification: continuous (decimal kg/ltr) vs discrete (whole pcs/box)
 * - Stock bounds checking and deficit detection without silent capping
 * - Pure, preview-only computation (0 side-effects, 0 database writes)
 */

export type UnitType = "CONTINUOUS" | "DISCRETE"

const CONTINUOUS_UNIT_REGEX = /^(kg|kgs|kilogram|kilograms|gm|gram|grams|ltr|liter|liters|litre|litres|ml|milliliter|milliliters|mtr|meter|meters|m)$/i

/**
 * Determines whether a unit supports fractional decimal measurements (e.g., Kg, Ltr)
 * or requires whole discrete units (e.g., pcs, box, bottle).
 */
export function isContinuousUnit(unit?: string | null): boolean {
  if (!unit) return false
  const clean = unit.trim().toLowerCase()
  return CONTINUOUS_UNIT_REGEX.test(clean)
}

/**
 * Standard monetary rounding to 2 decimal places preventing IEEE-754 floating point issues.
 */
export function roundCurrency(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Quantity rounding with specified decimal precision.
 */
export function roundQuantity(value: number, decimals: number = 3): number {
  if (isNaN(value) || !isFinite(value)) return 0
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export interface MoneyToQuantityInput {
  amount: number
  unitPrice: number
  allowFractional?: boolean
  decimalPlaces?: number
  availableStock?: number | null
}

export interface MoneyToQuantityResult {
  isValid: boolean
  errorMessage?: string
  amount: number
  unitPrice: number
  exactQuantity: number
  practicalQuantity: number
  practicalValue: number
  remainingMoney: number
  isFractional: boolean
  decimalPlaces: number
  hasStockDeficit: boolean
  stockDeficit: number
  availableStock?: number | null
}

/**
 * Mode A: Calculates how much product can be purchased with a given amount of money.
 *
 * Formula:
 * Quantity = Amount ÷ Unit Price
 *
 * Rules:
 * - If whole units required: practical quantity is floored to integer.
 * - If fractional allowed: practical quantity is floored to supported precision (e.g. 3 decimal places for grams).
 * - Floored practical quantity guarantees the customer never owes extra money.
 * - Remaining money = Amount - (Practical Quantity × Unit Price).
 */
export function calculateMoneyToQuantity(input: MoneyToQuantityInput): MoneyToQuantityResult {
  const {
    amount,
    unitPrice,
    allowFractional = false,
    decimalPlaces = 3,
    availableStock
  } = input

  if (isNaN(amount) || amount === null || amount === undefined) {
    return {
      isValid: false,
      errorMessage: "Please enter a valid cash amount.",
      amount: 0,
      unitPrice: unitPrice || 0,
      exactQuantity: 0,
      practicalQuantity: 0,
      practicalValue: 0,
      remainingMoney: 0,
      isFractional: allowFractional,
      decimalPlaces,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  if (amount <= 0) {
    return {
      isValid: false,
      errorMessage: "Amount must be greater than zero.",
      amount,
      unitPrice: unitPrice || 0,
      exactQuantity: 0,
      practicalQuantity: 0,
      practicalValue: 0,
      remainingMoney: 0,
      isFractional: allowFractional,
      decimalPlaces,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  if (isNaN(unitPrice) || unitPrice <= 0) {
    return {
      isValid: false,
      errorMessage: "Unit selling price must be greater than zero.",
      amount,
      unitPrice: unitPrice || 0,
      exactQuantity: 0,
      practicalQuantity: 0,
      practicalValue: 0,
      remainingMoney: 0,
      isFractional: allowFractional,
      decimalPlaces,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  // Exact mathematical quantity
  const exactQuantity = roundQuantity(amount / unitPrice, 4)

  // Practical sellable quantity
  let practicalQuantity: number
  if (allowFractional) {
    const factor = Math.pow(10, decimalPlaces)
    // Floor to precision so customer never pays more than the cash provided
    practicalQuantity = Math.floor((amount / unitPrice + 1e-9) * factor) / factor
  } else {
    // Whole discrete units
    practicalQuantity = Math.floor(amount / unitPrice + 1e-9)
  }

  const practicalValue = roundCurrency(practicalQuantity * unitPrice)
  const remainingMoney = roundCurrency(Math.max(0, amount - practicalValue))

  const hasStock = availableStock !== null && availableStock !== undefined && !isNaN(availableStock)
  const hasStockDeficit = hasStock ? practicalQuantity > availableStock : false
  const stockDeficit = hasStock && hasStockDeficit ? roundQuantity(practicalQuantity - availableStock, 3) : 0

  return {
    isValid: true,
    amount: roundCurrency(amount),
    unitPrice: roundCurrency(unitPrice),
    exactQuantity,
    practicalQuantity,
    practicalValue,
    remainingMoney,
    isFractional: allowFractional,
    decimalPlaces,
    hasStockDeficit,
    stockDeficit,
    availableStock: hasStock ? Number(availableStock) : undefined
  }
}

export interface QuantityToPriceInput {
  quantity: number
  unitPrice: number
  allowFractional?: boolean
  availableStock?: number | null
}

export interface QuantityToPriceResult {
  isValid: boolean
  errorMessage?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  hasStockDeficit: boolean
  stockDeficit: number
  availableStock?: number | null
}

/**
 * Mode B: Calculates total selling price for a requested product quantity.
 *
 * Formula:
 * Total Price = Quantity × Unit Price
 */
export function calculateQuantityToPrice(input: QuantityToPriceInput): QuantityToPriceResult {
  const {
    quantity,
    unitPrice,
    allowFractional = true,
    availableStock
  } = input

  if (isNaN(quantity) || quantity === null || quantity === undefined) {
    return {
      isValid: false,
      errorMessage: "Please enter a valid quantity.",
      quantity: 0,
      unitPrice: unitPrice || 0,
      totalPrice: 0,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  if (quantity <= 0) {
    return {
      isValid: false,
      errorMessage: "Quantity must be greater than zero.",
      quantity,
      unitPrice: unitPrice || 0,
      totalPrice: 0,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  if (!allowFractional && !Number.isInteger(quantity)) {
    return {
      isValid: false,
      errorMessage: "This product must be sold in whole discrete units (no fractions).",
      quantity,
      unitPrice: unitPrice || 0,
      totalPrice: 0,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  if (isNaN(unitPrice) || unitPrice <= 0) {
    return {
      isValid: false,
      errorMessage: "Unit selling price must be greater than zero.",
      quantity,
      unitPrice: unitPrice || 0,
      totalPrice: 0,
      hasStockDeficit: false,
      stockDeficit: 0,
      availableStock
    }
  }

  const roundedQty = roundQuantity(quantity, 4)
  const totalPrice = roundCurrency(roundedQty * unitPrice)

  const hasStock = availableStock !== null && availableStock !== undefined && !isNaN(availableStock)
  const hasStockDeficit = hasStock ? roundedQty > availableStock : false
  const stockDeficit = hasStock && hasStockDeficit ? roundQuantity(roundedQty - availableStock, 3) : 0

  return {
    isValid: true,
    quantity: roundedQty,
    unitPrice: roundCurrency(unitPrice),
    totalPrice,
    hasStockDeficit,
    stockDeficit,
    availableStock: hasStock ? Number(availableStock) : undefined
  }
}
