/**
 * Product Price, Quantity & Metric Unit Calculator Engine
 *
 * Implements authoritative retail and wholesale calculation rules:
 * - Dynamic Unit Architecture & Registry (Volume, Weight, Count, Packaging)
 * - Metric Conversions: 1 L = 1,000 mL; 1 kg = 1,000 g; discrete counts and packages
 * - Safe numeric calculation preventing floating-point precision artifacts
 * - Mode A: Money to Quantity (Customer cash -> exact & practical sellable quantity, change to return)
 * - Mode B: Quantity to Price (Ordered quantity in any compatible unit -> total price)
 * - Incompatible conversion prevention (e.g. grams to litres, jars to kg without density)
 * - Stock bounds checking and deficit detection across base and converted units
 * - Extensible unit model supporting future units without calculation duplication
 * - Pure, preview-only computation (0 side-effects, 0 database writes)
 */

export type UnitCategory = "VOLUME" | "WEIGHT" | "COUNT" | "PACKAGING" | "OTHER"

export interface UnitDefinition {
  code: string              // Normalized code: "kg", "g", "L", "ml", "pc", "unit", "bottle", "jar", "pack", "box"
  name: string              // Display name: "Kilogram", "Gram", "Litre", etc.
  symbol: string            // Symbol: "kg", "g", "L", "mL", "pc", etc.
  category: UnitCategory
  baseUnit: string          // Base unit code within category: "kg", "L", "pc", etc.
  conversionToBase: number  // Multiplier to convert 1 of this unit into base unit (e.g. 1 g = 0.001 kg)
  isFractional: boolean     // Whether decimal fractional quantities are supported
  decimalPrecision: number  // Standard decimal precision for rounding
}

/**
 * Registry of supported units across Volume, Weight, Count, and Packaging.
 * Extensible: new units can be registered dynamically via registerUnit().
 */
const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  // Volume Category (Base: L)
  "l": {
    code: "l",
    name: "Litre",
    symbol: "L",
    category: "VOLUME",
    baseUnit: "l",
    conversionToBase: 1,
    isFractional: true,
    decimalPrecision: 3
  },
  "ml": {
    code: "ml",
    name: "Millilitre",
    symbol: "mL",
    category: "VOLUME",
    baseUnit: "l",
    conversionToBase: 0.001,
    isFractional: true,
    decimalPrecision: 1
  },

  // Weight Category (Base: kg)
  "kg": {
    code: "kg",
    name: "Kilogram",
    symbol: "kg",
    category: "WEIGHT",
    baseUnit: "kg",
    conversionToBase: 1,
    isFractional: true,
    decimalPrecision: 3
  },
  "g": {
    code: "g",
    name: "Gram",
    symbol: "g",
    category: "WEIGHT",
    baseUnit: "kg",
    conversionToBase: 0.001,
    isFractional: true,
    decimalPrecision: 1
  },

  // Count Category (Base: pc)
  "pc": {
    code: "pc",
    name: "Piece",
    symbol: "pc",
    category: "COUNT",
    baseUnit: "pc",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },
  "unit": {
    code: "unit",
    name: "Unit",
    symbol: "unit",
    category: "COUNT",
    baseUnit: "pc",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },

  // Packaging Category (Discrete Package Units - Base is self)
  "bottle": {
    code: "bottle",
    name: "Bottle",
    symbol: "bottle",
    category: "PACKAGING",
    baseUnit: "bottle",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },
  "jar": {
    code: "jar",
    name: "Jar",
    symbol: "jar",
    category: "PACKAGING",
    baseUnit: "jar",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },
  "pack": {
    code: "pack",
    name: "Pack",
    symbol: "pack",
    category: "PACKAGING",
    baseUnit: "pack",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },
  "box": {
    code: "box",
    name: "Box",
    symbol: "box",
    category: "PACKAGING",
    baseUnit: "box",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },
  "tin": {
    code: "tin",
    name: "Tin",
    symbol: "tin",
    category: "PACKAGING",
    baseUnit: "tin",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  },
  "carton": {
    code: "carton",
    name: "Carton",
    symbol: "carton",
    category: "PACKAGING",
    baseUnit: "carton",
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  }
}

/**
 * Normalization alias map for common abbreviations, plurals, and user inputs.
 */
const UNIT_ALIASES: Record<string, string> = {
  // Volume aliases
  "l": "l",
  "ltr": "l",
  "ltrs": "l",
  "liter": "l",
  "liters": "l",
  "litre": "l",
  "litres": "l",
  "ml": "ml",
  "mls": "ml",
  "milliliter": "ml",
  "milliliters": "ml",
  "millilitre": "ml",
  "millilitres": "ml",

  // Weight aliases
  "kg": "kg",
  "kgs": "kg",
  "kilogram": "kg",
  "kilograms": "kg",
  "kilo": "kg",
  "kilos": "kg",
  "g": "g",
  "gm": "g",
  "gms": "g",
  "gram": "g",
  "grams": "g",

  // Count aliases
  "pc": "pc",
  "pcs": "pc",
  "piece": "pc",
  "pieces": "pc",
  "unit": "unit",
  "units": "unit",
  "item": "pc",
  "items": "pc",

  // Packaging aliases
  "bottle": "bottle",
  "bottles": "bottle",
  "btl": "bottle",
  "btls": "bottle",
  "jar": "jar",
  "jars": "jar",
  "pack": "pack",
  "packs": "pack",
  "packet": "pack",
  "packets": "pack",
  "box": "box",
  "boxes": "box",
  "tin": "tin",
  "tins": "tin",
  "carton": "carton",
  "cartons": "carton",
  "crate": "carton",
  "crates": "carton"
}

/**
 * Register a new unit definition into the unit model.
 * Extensible hook for custom units without modifying existing code.
 */
export function registerUnit(unit: UnitDefinition, aliases: string[] = []): void {
  const code = unit.code.toLowerCase()
  UNIT_DEFINITIONS[code] = unit
  UNIT_ALIASES[code] = code
  for (const alias of aliases) {
    UNIT_ALIASES[alias.toLowerCase()] = code
  }
}

/**
 * Normalizes any raw unit string into its authoritative UnitDefinition.
 * Returns null if the unit is missing, empty, or unknown.
 */
export function normalizeUnit(rawUnit?: string | null): UnitDefinition | null {
  if (!rawUnit) return null
  const clean = rawUnit.trim().toLowerCase()
  if (!clean) return null

  const canonicalCode = UNIT_ALIASES[clean]
  if (canonicalCode && UNIT_DEFINITIONS[canonicalCode]) {
    return UNIT_DEFINITIONS[canonicalCode]
  }

  // Fallback for custom or unrecognized discrete unit
  return {
    code: clean,
    name: rawUnit.trim(),
    symbol: rawUnit.trim(),
    category: "OTHER",
    baseUnit: clean,
    conversionToBase: 1,
    isFractional: false,
    decimalPrecision: 0
  }
}

/**
 * Determines whether a unit supports fractional decimal measurements (e.g., Kg, Ltr).
 */
export function isContinuousUnit(unit?: string | null): boolean {
  const def = normalizeUnit(unit)
  return def ? def.isFractional : false
}

/**
 * Checks whether two units belong to the same category and can be converted.
 */
export function areUnitsCompatible(unitA?: string | null, unitB?: string | null): boolean {
  const defA = normalizeUnit(unitA)
  const defB = normalizeUnit(unitB)
  if (!defA || !defB) return false
  if (defA.category === "OTHER" || defB.category === "OTHER") {
    return defA.code === defB.code
  }
  return defA.category === defB.category && defA.baseUnit === defB.baseUnit
}

/**
 * Converts a quantity from one unit to another within the same category.
 * Prevents incompatible conversions (e.g. grams to litres, jars to kg).
 */
export function convertQuantity(
  value: number,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined
): { success: boolean; convertedValue: number; error?: string } {
  if (isNaN(value) || !isFinite(value)) {
    return { success: false, convertedValue: 0, error: "Invalid numeric quantity." }
  }

  const defFrom = normalizeUnit(fromUnit)
  const defTo = normalizeUnit(toUnit)

  if (!defFrom) {
    return { success: false, convertedValue: 0, error: `Unrecognized source unit: "${fromUnit}".` }
  }
  if (!defTo) {
    return { success: false, convertedValue: 0, error: `Unrecognized target unit: "${toUnit}".` }
  }

  if (defFrom.code === defTo.code) {
    return { success: true, convertedValue: value }
  }

  // Prevent cross-category conversion (e.g., grams to litres, bottles to kg)
  if (defFrom.category !== defTo.category) {
    let extraHelp = ""
    if (
      (defFrom.category === "WEIGHT" && defTo.category === "VOLUME") ||
      (defFrom.category === "VOLUME" && defTo.category === "WEIGHT")
    ) {
      extraHelp = " Density information is required; 1 litre does not automatically equal 1 kilogram."
    } else if (defFrom.category === "PACKAGING" || defTo.category === "PACKAGING") {
      extraHelp = " Packaged items cannot be converted to weight or volume without explicit net content records."
    }
    return {
      success: false,
      convertedValue: 0,
      error: `Cannot convert between incompatible unit categories (${defFrom.category} to ${defTo.category}).${extraHelp}`
    }
  }

  // Convert: valueInBase = value * fromToBase; valueInTarget = valueInBase / toToBase
  const valueInBase = value * defFrom.conversionToBase
  const targetValue = valueInBase / defTo.conversionToBase

  return {
    success: true,
    convertedValue: roundQuantity(targetValue, 4)
  }
}

/**
 * Returns all compatible unit definitions available for a given product unit.
 * For example:
 * - "kg" -> [Kilogram (kg), Gram (g)]
 * - "L" -> [Litre (L), Millilitre (mL)]
 * - "bottle" -> [Bottle]
 */
export function getCompatibleUnits(unit?: string | null): UnitDefinition[] {
  const def = normalizeUnit(unit)
  if (!def) return []

  if (def.category === "WEIGHT") {
    return [UNIT_DEFINITIONS["kg"], UNIT_DEFINITIONS["g"]]
  }
  if (def.category === "VOLUME") {
    return [UNIT_DEFINITIONS["l"], UNIT_DEFINITIONS["ml"]]
  }
  if (def.category === "COUNT") {
    return [UNIT_DEFINITIONS["pc"], UNIT_DEFINITIONS["unit"]]
  }
  // Packaging or other
  return [def]
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

/**
 * Generates a convenient, user-friendly display for quantities in metric units.
 * Examples:
 * - 0.5 kg -> convenient: "500 g" (secondary: "0.500 kg")
 * - 1.25 kg -> convenient: "1.250 kg" (secondary: "1,250 g")
 * - 0.25 L -> convenient: "250 mL" (secondary: "0.250 L")
 * - 3 pc -> convenient: "3 pc"
 */
export function formatConvenientQuantity(
  quantityInBase: number,
  baseUnitCode?: string | null
): { primary: string; secondary?: string; convenientValue: number; convenientUnit: string } {
  const def = normalizeUnit(baseUnitCode)
  if (!def || quantityInBase <= 0) {
    return {
      primary: `${roundQuantity(quantityInBase, 3)} ${def?.symbol || ""}`.trim(),
      convenientValue: roundQuantity(quantityInBase, 3),
      convenientUnit: def?.symbol || ""
    }
  }

  if (def.category === "WEIGHT") {
    if (quantityInBase < 1) {
      const inGrams = roundQuantity(quantityInBase * 1000, 1)
      return {
        primary: `${inGrams} g`,
        secondary: `${roundQuantity(quantityInBase, 3)} kg`,
        convenientValue: inGrams,
        convenientUnit: "g"
      }
    } else {
      const inKg = roundQuantity(quantityInBase, 3)
      const inGrams = roundQuantity(quantityInBase * 1000, 0)
      return {
        primary: `${inKg} kg`,
        secondary: `${inGrams.toLocaleString()} g`,
        convenientValue: inKg,
        convenientUnit: "kg"
      }
    }
  }

  if (def.category === "VOLUME") {
    if (quantityInBase < 1) {
      const inMl = roundQuantity(quantityInBase * 1000, 1)
      return {
        primary: `${inMl} mL`,
        secondary: `${roundQuantity(quantityInBase, 3)} L`,
        convenientValue: inMl,
        convenientUnit: "mL"
      }
    } else {
      const inL = roundQuantity(quantityInBase, 3)
      const inMl = roundQuantity(quantityInBase * 1000, 0)
      return {
        primary: `${inL} L`,
        secondary: `${inMl.toLocaleString()} mL`,
        convenientValue: inL,
        convenientUnit: "L"
      }
    }
  }

  // Count / Packaging
  const rounded = roundQuantity(quantityInBase, 0)
  return {
    primary: `${rounded} ${def.symbol}`,
    convenientValue: rounded,
    convenientUnit: def.symbol
  }
}

export interface MoneyToQuantityInput {
  amount: number
  unitPrice: number
  productUnit?: string | null
  displayUnit?: string | null
  allowFractional?: boolean
  decimalPlaces?: number
  availableStock?: number | null
}

export interface MoneyToQuantityResult {
  isValid: boolean
  errorMessage?: string
  amount: number
  unitPrice: number
  productBaseUnit: string
  displayUnit: string
  exactQuantity: number
  practicalQuantity: number
  exactQuantityBase: number
  practicalQuantityBase: number
  convenientQuantity: {
    primary: string
    secondary?: string
    convenientValue: number
    convenientUnit: string
  }
  practicalValue: number
  remainingMoney: number
  isFractional: boolean
  decimalPlaces: number
  hasStockDeficit: boolean
  stockDeficit: number
  availableStock?: number | null
}

/**
 * Mode A: Calculates how much product can be purchased with customer cash.
 *
 * Formula:
 * QuantityInBase = Amount ÷ Unit Selling Price
 *
 * Rules:
 * - If whole discrete units required: floored to integer.
 * - If fractional allowed: floored to precision factor so customer never owes extra money.
 * - Converted to display unit if selected (e.g. g or mL).
 * - Remaining money = Amount - (Practical Quantity × Unit Price).
 * - Stock deficit warnings evaluate against available stock in base unit.
 */
export function calculateMoneyToQuantity(input: MoneyToQuantityInput): MoneyToQuantityResult {
  const {
    amount,
    unitPrice,
    productUnit,
    displayUnit,
    allowFractional: overrideFractional,
    decimalPlaces: customDecimals,
    availableStock
  } = input

  const baseDef = normalizeUnit(productUnit)
  const baseCode = baseDef?.code || productUnit || "unit"
  const targetDef = displayUnit ? normalizeUnit(displayUnit) : baseDef
  const displayCode = targetDef?.code || baseCode

  const isFractional =
    overrideFractional !== undefined
      ? overrideFractional
      : baseDef
      ? baseDef.isFractional
      : false

  const decimalPlaces = customDecimals !== undefined ? customDecimals : isFractional ? 3 : 0

  const defaultErrorState = (errorMessage: string): MoneyToQuantityResult => ({
    isValid: false,
    errorMessage,
    amount: isNaN(amount) ? 0 : amount,
    unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
    productBaseUnit: baseDef?.symbol || baseCode,
    displayUnit: targetDef?.symbol || displayCode,
    exactQuantity: 0,
    practicalQuantity: 0,
    exactQuantityBase: 0,
    practicalQuantityBase: 0,
    convenientQuantity: { primary: "0", convenientValue: 0, convenientUnit: targetDef?.symbol || displayCode },
    practicalValue: 0,
    remainingMoney: 0,
    isFractional,
    decimalPlaces,
    hasStockDeficit: false,
    stockDeficit: 0,
    availableStock
  })

  if (!productUnit || !productUnit.trim()) {
    return defaultErrorState("Product has no defined measurement unit. Please specify a unit in catalog.")
  }

  if (isNaN(amount) || amount === null || amount === undefined) {
    return defaultErrorState("Please enter a valid cash amount.")
  }

  if (amount <= 0) {
    return defaultErrorState("Amount must be greater than zero.")
  }

  if (isNaN(unitPrice) || unitPrice <= 0) {
    return defaultErrorState("Unit selling price must be greater than zero.")
  }

  if (displayUnit && !areUnitsCompatible(productUnit, displayUnit)) {
    return defaultErrorState(`Cannot display results in ${displayUnit} for a product sold in ${productUnit}.`)
  }

  // Exact math quantity in base unit
  const exactQuantityBase = roundQuantity(amount / unitPrice, 4)

  // Practical sellable quantity in base unit
  let practicalQuantityBase: number
  if (isFractional) {
    const factor = Math.pow(10, decimalPlaces)
    practicalQuantityBase = Math.floor((amount / unitPrice + 1e-9) * factor) / factor
  } else {
    practicalQuantityBase = Math.floor(amount / unitPrice + 1e-9)
  }

  const practicalValue = roundCurrency(practicalQuantityBase * unitPrice)
  const remainingMoney = roundCurrency(Math.max(0, amount - practicalValue))

  // Stock check in base unit
  const hasStock = availableStock !== null && availableStock !== undefined && !isNaN(availableStock)
  const hasStockDeficit = hasStock ? practicalQuantityBase > availableStock : false
  const stockDeficitBase = hasStock && hasStockDeficit ? roundQuantity(practicalQuantityBase - availableStock, 3) : 0

  // Conversion to display unit (if different from base unit, e.g. displaying grams for kg product)
  const targetConversion = targetDef ? targetDef.conversionToBase : 1
  const exactQuantity = roundQuantity(exactQuantityBase / targetConversion, 4)
  const practicalQuantity = roundQuantity(practicalQuantityBase / targetConversion, targetDef?.decimalPrecision ?? 3)
  const stockDeficit = roundQuantity(stockDeficitBase / targetConversion, targetDef?.decimalPrecision ?? 3)

  // Convenient display (e.g. 500 g for 0.5 kg)
  const convenientQuantity = formatConvenientQuantity(practicalQuantityBase, baseCode)

  return {
    isValid: true,
    amount: roundCurrency(amount),
    unitPrice: roundCurrency(unitPrice),
    productBaseUnit: baseDef?.symbol || baseCode,
    displayUnit: targetDef?.symbol || displayCode,
    exactQuantity,
    practicalQuantity,
    exactQuantityBase,
    practicalQuantityBase,
    convenientQuantity,
    practicalValue,
    remainingMoney,
    isFractional,
    decimalPlaces,
    hasStockDeficit,
    stockDeficit,
    availableStock: hasStock ? Number(availableStock) : undefined
  }
}

export interface QuantityToPriceInput {
  quantity: number
  unitPrice: number
  productUnit?: string | null
  inputUnit?: string | null
  allowFractional?: boolean
  availableStock?: number | null
}

export interface QuantityToPriceResult {
  isValid: boolean
  errorMessage?: string
  quantity: number
  inputUnit: string
  baseQuantity: number
  productBaseUnit: string
  unitPrice: number
  equivalentUnitPrice: number
  totalPrice: number
  hasStockDeficit: boolean
  stockDeficit: number
  stockDeficitBase: number
  availableStock?: number | null
}

/**
 * Mode B: Calculates total selling price for a requested quantity.
 *
 * Converts input unit to product base unit before calculating price:
 * BaseQuantity = EnteredQuantity × (InputUnit.conversionToBase ÷ BaseUnit.conversionToBase)
 * Total Price = BaseQuantity × Unit Selling Price
 *
 * Rules:
 * - Incompatible conversions (e.g. grams to litres) are rejected.
 * - Non-fractional products reject decimal quantities.
 * - Warns if requested quantity in base unit exceeds available stock.
 */
export function calculateQuantityToPrice(input: QuantityToPriceInput): QuantityToPriceResult {
  const {
    quantity,
    unitPrice,
    productUnit,
    inputUnit,
    allowFractional: overrideFractional,
    availableStock
  } = input

  const baseDef = normalizeUnit(productUnit)
  const baseCode = baseDef?.code || productUnit || "unit"
  const entryDef = inputUnit ? normalizeUnit(inputUnit) : baseDef
  const entryCode = entryDef?.code || baseCode

  const isFractional =
    overrideFractional !== undefined
      ? overrideFractional
      : baseDef
      ? baseDef.isFractional
      : true

  const defaultErrorState = (errorMessage: string): QuantityToPriceResult => ({
    isValid: false,
    errorMessage,
    quantity: isNaN(quantity) ? 0 : quantity,
    inputUnit: entryDef?.symbol || entryCode,
    baseQuantity: 0,
    productBaseUnit: baseDef?.symbol || baseCode,
    unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
    equivalentUnitPrice: 0,
    totalPrice: 0,
    hasStockDeficit: false,
    stockDeficit: 0,
    stockDeficitBase: 0,
    availableStock
  })

  if (!productUnit || !productUnit.trim()) {
    return defaultErrorState("Product has no defined measurement unit. Please specify a unit in catalog.")
  }

  if (isNaN(quantity) || quantity === null || quantity === undefined) {
    return defaultErrorState("Please enter a valid quantity.")
  }

  if (quantity <= 0) {
    return defaultErrorState("Quantity must be greater than zero.")
  }

  if (isNaN(unitPrice) || unitPrice <= 0) {
    return defaultErrorState("Unit selling price must be greater than zero.")
  }

  // Check unit compatibility
  if (entryDef && baseDef && !areUnitsCompatible(entryDef.code, baseDef.code)) {
    const errorMsg =
      entryDef.category !== baseDef.category
        ? `Cannot convert between incompatible units: ${entryDef.name} (${entryDef.symbol}) and ${baseDef.name} (${baseDef.symbol}).`
        : `Units ${entryDef.symbol} and ${baseDef.symbol} are incompatible.`
    return defaultErrorState(errorMsg)
  }

  // Convert entered quantity to product base unit
  const conversion = convertQuantity(quantity, entryCode, baseCode)
  if (!conversion.success) {
    return defaultErrorState(conversion.error || "Unit conversion failed.")
  }

  const baseQuantity = roundQuantity(conversion.convertedValue, 4)

  // Validate whole piece restrictions
  if (!isFractional && !Number.isInteger(baseQuantity)) {
    return defaultErrorState(
      `This product (${baseDef?.name || baseCode}) must be sold in whole discrete units (no fractions).`
    )
  }

  // Total price calculation
  const totalPrice = roundCurrency(baseQuantity * unitPrice)

  // Equivalent rate per entered unit (e.g. ₹200/kg -> ₹0.20/g)
  const entryConversion = entryDef ? entryDef.conversionToBase : 1
  const equivalentUnitPrice = roundQuantity(unitPrice * entryConversion, 4)

  // Stock deficit check against stock in base units
  const hasStock = availableStock !== null && availableStock !== undefined && !isNaN(availableStock)
  const hasStockDeficit = hasStock ? baseQuantity > availableStock : false
  const stockDeficitBase = hasStock && hasStockDeficit ? roundQuantity(baseQuantity - availableStock, 3) : 0
  const stockDeficit =
    hasStock && hasStockDeficit ? roundQuantity(stockDeficitBase / entryConversion, entryDef?.decimalPrecision ?? 3) : 0

  return {
    isValid: true,
    quantity: roundQuantity(quantity, entryDef?.decimalPrecision ?? 3),
    inputUnit: entryDef?.symbol || entryCode,
    baseQuantity,
    productBaseUnit: baseDef?.symbol || baseCode,
    unitPrice: roundCurrency(unitPrice),
    equivalentUnitPrice,
    totalPrice,
    hasStockDeficit,
    stockDeficit,
    stockDeficitBase,
    availableStock: hasStock ? Number(availableStock) : undefined
  }
}
