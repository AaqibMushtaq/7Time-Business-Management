import { formatMoney } from "./utils"

export interface ProfitInfo {
  isConfigured: boolean
  sellingPrice: number | null
  profit: number | null
  profitPercent: number | null
  displayPrice: string
  displayProfit: string
  displayPercent: string
  statusText: string
  isPositive: boolean
  isNegative: boolean
  isZero: boolean
}

export interface DualProfitResult {
  buyingCost: number | null
  hasBuyingCost: boolean
  displayBuyingCost: string
  wholesale: ProfitInfo
  retail: ProfitInfo
}

/**
 * Checks whether a price is genuinely configured (not null, undefined, or empty string).
 * Allows distinguishing unconfigured prices (null/undefined) from an explicitly configured 0.
 */
export function isPriceConfigured(price: number | string | null | undefined): boolean {
  if (price === null || price === undefined) return false
  if (typeof price === "string" && price.trim() === "") return false
  const num = typeof price === "string" ? parseFloat(price) : Number(price)
  return !isNaN(num)
}

/**
 * Normalizes a price into a number or null if unconfigured.
 */
export function normalizePrice(price: number | string | null | undefined): number | null {
  if (!isPriceConfigured(price)) return null
  const num = typeof price === "string" ? parseFloat(price) : Number(price)
  return isNaN(num) ? null : num
}

/**
 * Calculates profit and profit margin percentage for a single selling tier.
 * Formula:
 * - Profit = Selling Price - Buying Cost
 * - Profit % = (Profit / Buying Cost) * 100 (Established markup convention)
 */
function calculateTierProfit(
  sellingPriceRaw: number | string | null | undefined,
  buyingCost: number | null,
  hasBuyingCost: boolean,
  tier: "wholesale" | "retail"
): ProfitInfo {
  const configured = isPriceConfigured(sellingPriceRaw)
  const notConfiguredStatus = tier === "wholesale" ? "Not sold in wholesale" : "Not sold in retail"

  if (!configured) {
    return {
      isConfigured: false,
      sellingPrice: null,
      profit: null,
      profitPercent: null,
      displayPrice: "Not set",
      displayProfit: notConfiguredStatus,
      displayPercent: "—",
      statusText: notConfiguredStatus,
      isPositive: false,
      isNegative: false,
      isZero: false,
    }
  }

  const sellingPrice = normalizePrice(sellingPriceRaw)!
  const displayPrice = formatMoney(sellingPrice)

  if (!hasBuyingCost || buyingCost === null) {
    return {
      isConfigured: true,
      sellingPrice,
      profit: null,
      profitPercent: null,
      displayPrice,
      displayProfit: "No buying cost",
      displayPercent: "—",
      statusText: "No buying cost configured",
      isPositive: false,
      isNegative: false,
      isZero: false,
    }
  }

  const profit = sellingPrice - buyingCost
  const profitPercent = buyingCost > 0 ? Math.round((profit / buyingCost) * 100) : 0
  const isPositive = profit > 0
  const isNegative = profit < 0
  const isZero = profit === 0

  return {
    isConfigured: true,
    sellingPrice,
    profit,
    profitPercent,
    displayPrice,
    displayProfit: formatMoney(profit),
    displayPercent: `${profitPercent}%`,
    statusText: `Profit: ${formatMoney(profit)} (${profitPercent}%)`,
    isPositive,
    isNegative,
    isZero,
  }
}

/**
 * Canonical calculation of dual wholesale and retail profits.
 * Preserves negative profits (losses) without clamping to zero.
 * Distinguishes unconfigured prices from explicitly configured zero-price selling methods.
 */
export function calculateDualProfit(
  buyingCostRaw: number | string | null | undefined,
  wholesalePriceRaw: number | string | null | undefined,
  retailPriceRaw: number | string | null | undefined
): DualProfitResult {
  const hasBuyingCost = isPriceConfigured(buyingCostRaw)
  const buyingCost = hasBuyingCost ? normalizePrice(buyingCostRaw) : null
  const displayBuyingCost = buyingCost !== null ? formatMoney(buyingCost) : "—"

  const wholesale = calculateTierProfit(wholesalePriceRaw, buyingCost, hasBuyingCost, "wholesale")
  const retail = calculateTierProfit(retailPriceRaw, buyingCost, hasBuyingCost, "retail")

  return {
    buyingCost,
    hasBuyingCost,
    displayBuyingCost,
    wholesale,
    retail,
  }
}
