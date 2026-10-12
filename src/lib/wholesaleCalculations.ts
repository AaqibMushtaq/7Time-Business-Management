/**
 * Wholesale Financial Calculations
 * Single source of truth for wholesale margin, sale amount, balance due, and payment status.
 */

export interface WholesaleCalculationInput {
  quantity: number
  buyingCost: number
  wholesalePrice: number
  amountReceived: number
}

export interface WholesaleCalculationResult {
  buyingCostTotal: number
  totalSale: number
  balance: number
  profit: number
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID"
}

export function calculateWholesaleSale({
  quantity,
  buyingCost,
  wholesalePrice,
  amountReceived
}: WholesaleCalculationInput): WholesaleCalculationResult {
  const q = Number(quantity) || 0
  const bc = Number(buyingCost) || 0
  const wp = Number(wholesalePrice) || 0
  const rcv = Number(amountReceived) || 0

  const buyingCostTotal = q * bc
  const totalSale = q * wp
  const balance = totalSale - rcv
  const profit = totalSale - buyingCostTotal
  const paymentStatus = balance <= 0 ? "PAID" : rcv > 0 ? "PARTIAL" : "UNPAID"

  return {
    buyingCostTotal,
    totalSale,
    balance,
    profit,
    paymentStatus
  }
}
