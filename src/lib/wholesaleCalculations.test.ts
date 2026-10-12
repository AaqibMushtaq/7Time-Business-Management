import { describe, it, expect } from "vitest"
import { calculateWholesaleSale } from "./wholesaleCalculations"

describe("wholesaleCalculations", () => {
  it("accurately calculates totalSale, buyingCostTotal, balance, profit, and PAID status", () => {
    const calc = calculateWholesaleSale({
      quantity: 10,
      buyingCost: 50,
      wholesalePrice: 80,
      amountReceived: 800
    })

    expect(calc.buyingCostTotal).toBe(500)
    expect(calc.totalSale).toBe(800)
    expect(calc.balance).toBe(0)
    expect(calc.profit).toBe(300)
    expect(calc.paymentStatus).toBe("PAID")
  })

  it("accurately calculates PARTIAL status when amountReceived is positive but balance > 0", () => {
    const calc = calculateWholesaleSale({
      quantity: 10,
      buyingCost: 50,
      wholesalePrice: 80,
      amountReceived: 300
    })

    expect(calc.totalSale).toBe(800)
    expect(calc.balance).toBe(500)
    expect(calc.profit).toBe(300)
    expect(calc.paymentStatus).toBe("PARTIAL")
  })

  it("accurately calculates UNPAID status when amountReceived is 0", () => {
    const calc = calculateWholesaleSale({
      quantity: 5,
      buyingCost: 100,
      wholesalePrice: 150,
      amountReceived: 0
    })

    expect(calc.buyingCostTotal).toBe(500)
    expect(calc.totalSale).toBe(750)
    expect(calc.balance).toBe(750)
    expect(calc.profit).toBe(250)
    expect(calc.paymentStatus).toBe("UNPAID")
  })
})
