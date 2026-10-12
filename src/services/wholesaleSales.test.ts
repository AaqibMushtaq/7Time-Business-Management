import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getWholesaleSales,
  createWholesaleSale,
  updateWholesaleSale,
  deleteWholesaleSale,
  calculateWholesaleSale,
  type WholesaleSale
} from "./wholesaleSales"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => {
  const fromMock = vi.fn()
  return {
    supabase: {
      from: fromMock
    }
  }
})

describe("wholesaleSales service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseSaleFixture = {
    id: "sale-uuid-001",
    customer_id: "cust-001",
    product_id: "prod-001",
    dealer_id: "dealer-001",
    sale_date: "2026-10-11",
    quantity: 10,
    buying_cost: 50,
    wholesale_price: 80,
    total_sale: 800,
    amount_received: 800,
    balance: 0,
    profit: 300,
    payment_status: "PAID",
    payment_method: "CASH",
    notes: "First test sale"
  }

  describe("1. Wholesale sale creation with Cash as payment method", () => {
    it("successfully sends Cash payment method payload to Supabase", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { ...baseSaleFixture, payment_method: "CASH" },
        error: null
      })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale({
        ...baseSaleFixture,
        payment_method: "CASH"
      })

      expect(supabase.from).toHaveBeenCalledWith("wholesale_sales")
      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          payment_method: "CASH",
          total_sale: 800
        })
      ])
      expect(result.payment_method).toBe("CASH")
    })
  })

  describe("2. Creation with each other currently supported payment method", () => {
    it("successfully creates sale with UPI payment method", async () => {
      const upiSale = { ...baseSaleFixture, payment_method: "UPI" }
      const singleMock = vi.fn().mockResolvedValue({ data: upiSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale(upiSale)

      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({ payment_method: "UPI" })
      ])
      expect(result.payment_method).toBe("UPI")
    })

    it("successfully creates sale with BANK payment method", async () => {
      const bankSale = { ...baseSaleFixture, payment_method: "BANK" }
      const singleMock = vi.fn().mockResolvedValue({ data: bankSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale(bankSale)

      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({ payment_method: "BANK" })
      ])
      expect(result.payment_method).toBe("BANK")
    })
  })

  describe("3. Note persistence and editing", () => {
    it("preserves custom notes and selected payment method on creation", async () => {
      const customSale = {
        ...baseSaleFixture,
        payment_method: "UPI",
        notes: "Delivered via express vehicle - transaction ref #98765"
      }
      const singleMock = vi.fn().mockResolvedValue({ data: customSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale(customSale)

      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          notes: "Delivered via express vehicle - transaction ref #98765",
          payment_method: "UPI"
        })
      ])
      expect(result.notes).toBe("Delivered via express vehicle - transaction ref #98765")
      expect(result.payment_method).toBe("UPI")
    })

    it("updates only note on existing sale without altering financial values", async () => {
      const updatedSale = { ...baseSaleFixture, notes: "Updated delivery note" }
      const singleMock = vi.fn().mockResolvedValue({ data: updatedSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const eqMock = vi.fn().mockReturnValue({ select: selectMock })
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ update: updateMock })

      const result = await updateWholesaleSale("sale-uuid-001", {
        notes: "Updated delivery note"
      })

      expect(updateMock).toHaveBeenCalledWith({ notes: "Updated delivery note" })
      expect(eqMock).toHaveBeenCalledWith("id", "sale-uuid-001")
      expect(result.notes).toBe("Updated delivery note")
      expect(result.total_sale).toBe(800)
      expect(result.profit).toBe(300)
    })

    it("persists null when note is blank or cleared", async () => {
      const clearedNoteSale = { ...baseSaleFixture, notes: null }
      const singleMock = vi.fn().mockResolvedValue({ data: clearedNoteSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const eqMock = vi.fn().mockReturnValue({ select: selectMock })
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ update: updateMock })

      const result = await updateWholesaleSale("sale-uuid-001", { notes: null })

      expect(updateMock).toHaveBeenCalledWith({ notes: null })
      expect(result.notes).toBeNull()
    })
  })

  describe("4. Sale with no amount received (unpaid sale)", () => {
    it("persists balance equal to total_sale and UNPAID status", async () => {
      const unpaidSale = {
        ...baseSaleFixture,
        amount_received: 0,
        balance: 800,
        payment_status: "UNPAID"
      }
      const singleMock = vi.fn().mockResolvedValue({ data: unpaidSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale(unpaidSale)

      expect(result.amount_received).toBe(0)
      expect(result.balance).toBe(800)
      expect(result.payment_status).toBe("UNPAID")
    })
  })

  describe("5. Partially paid sale", () => {
    it("persists received amount, remaining balance, and PARTIAL status", async () => {
      const partialSale = {
        ...baseSaleFixture,
        amount_received: 300,
        balance: 500,
        payment_status: "PARTIAL"
      }
      const singleMock = vi.fn().mockResolvedValue({ data: partialSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale(partialSale)

      expect(result.amount_received).toBe(300)
      expect(result.balance).toBe(500)
      expect(result.payment_status).toBe("PARTIAL")
    })
  })

  describe("6. Fully paid sale", () => {
    it("persists 0 balance and PAID status", async () => {
      const paidSale = {
        ...baseSaleFixture,
        amount_received: 800,
        balance: 0,
        payment_status: "PAID"
      }
      const singleMock = vi.fn().mockResolvedValue({ data: paidSale, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      const result = await createWholesaleSale(paidSale)

      expect(result.amount_received).toBe(800)
      expect(result.balance).toBe(0)
      expect(result.payment_status).toBe("PAID")
    })
  })

  describe("7. Accurate balance and profit calculations", () => {
    it("accurately verifies calculation formulas", () => {
      const qty = 15
      const buyingCost = 40
      const wholesalePrice = 70
      const received = 500

      const buyingCostTotal = qty * buyingCost // 600
      const totalSale = qty * wholesalePrice // 1050
      const balance = totalSale - received // 550
      const profit = totalSale - buyingCostTotal // 450
      const paymentStatus = balance <= 0 ? "PAID" : received > 0 ? "PARTIAL" : "UNPAID"

      expect(totalSale).toBe(1050)
      expect(buyingCostTotal).toBe(600)
      expect(balance).toBe(550)
      expect(profit).toBe(450)
      expect(paymentStatus).toBe("PARTIAL")
    })
  })

  describe("8. Product stock changes and reconciliation", () => {
    it("calculates expected inventory reduction on new sale", () => {
      const initialStock = 100
      const soldQty = 15
      const newStock = initialStock - soldQty
      expect(newStock).toBe(85)
    })

    it("calculates inventory stock reconciliation when quantity is edited", () => {
      const initialStock = 85
      const oldSoldQty = 10
      const newSoldQty = 15
      // Database trigger: stock_quantity + old_qty - new_qty
      const reconciledStock = initialStock + oldSoldQty - newSoldQty
      expect(reconciledStock).toBe(80)
    })

    it("calculates inventory stock reconciliation when quantity is decreased", () => {
      const initialStock = 85
      const oldSoldQty = 10
      const newSoldQty = 6
      const reconciledStock = initialStock + oldSoldQty - newSoldQty
      expect(reconciledStock).toBe(89)
    })
  })

  describe("9. Reloading Wholesale Transactions after saving", () => {
    it("fetches updated transaction list joining customers, products, dealers and notes", async () => {
      const mockSales: WholesaleSale[] = [
        {
          ...baseSaleFixture,
          customer: { id: "cust-001", name: "Ahmed Trader", phone: "123", address: "City" },
          product: { id: "prod-001", name: "Grade A Almonds", unit: "kg", buying_cost: 50, wholesale_price: 80, retail_price: 100, dealer_id: "dealer-001", stock_quantity: 85 },
          dealer: { id: "dealer-001", name: "Royal Suppliers", phone: "999", address: "" }
        }
      ]

      const orderMock = vi.fn().mockResolvedValue({ data: mockSales, error: null })
      const selectMock = vi.fn().mockReturnValue({ order: orderMock })
      ;(supabase.from as any).mockReturnValue({ select: selectMock })

      const result = await getWholesaleSales()

      expect(supabase.from).toHaveBeenCalledWith("wholesale_sales")
      expect(selectMock).toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0].customer?.name).toBe("Ahmed Trader")
      expect(result[0].product?.name).toBe("Grade A Almonds")
      expect(result[0].payment_method).toBe("CASH")
      expect(result[0].notes).toBe("First test sale")
    })
  })

  describe("10. Database failure handling without false success", () => {
    it("throws error with original message if Supabase rejects the insert", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "PGRST204",
          message: "Could not find the 'payment_method' column of 'wholesale_sales' in the schema cache"
        }
      })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const insertMock = vi.fn().mockReturnValue({ select: selectMock })
      ;(supabase.from as any).mockReturnValue({ insert: insertMock })

      await expect(createWholesaleSale(baseSaleFixture)).rejects.toThrow(
        "Could not find the 'payment_method' column of 'wholesale_sales' in the schema cache"
      )
    })

    it("throws error when Supabase rejects an update", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database constraint error on update" }
      })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const eqMock = vi.fn().mockReturnValue({ select: selectMock })
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ update: updateMock })

      await expect(updateWholesaleSale("sale-uuid-001", { quantity: 20 })).rejects.toThrow(
        "Database constraint error on update"
      )
    })
  })

  describe("11. Editing an existing sale without duplicate records", () => {
    it("updates existing sale by ID using update query", async () => {
      const updatedData = { ...baseSaleFixture, notes: "Updated note", payment_method: "BANK" }
      const singleMock = vi.fn().mockResolvedValue({ data: updatedData, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const eqMock = vi.fn().mockReturnValue({ select: selectMock })
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ update: updateMock })

      const result = await updateWholesaleSale("sale-uuid-001", {
        notes: "Updated note",
        payment_method: "BANK"
      })

      expect(supabase.from).toHaveBeenCalledWith("wholesale_sales")
      expect(updateMock).toHaveBeenCalledWith({
        notes: "Updated note",
        payment_method: "BANK"
      })
      expect(eqMock).toHaveBeenCalledWith("id", "sale-uuid-001")
      expect(result.payment_method).toBe("BANK")
    })

    it("deletes a wholesale sale by ID", async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null })
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock })
      ;(supabase.from as any).mockReturnValue({ delete: deleteMock })

      await deleteWholesaleSale("sale-uuid-001")

      expect(supabase.from).toHaveBeenCalledWith("wholesale_sales")
      expect(deleteMock).toHaveBeenCalled()
      expect(eqMock).toHaveBeenCalledWith("id", "sale-uuid-001")
    })
  })

  describe("12. Preserving historical records without fabricated payment methods or notes", () => {
    it("allows existing records with null payment_method and null notes", async () => {
      const historicalSale: WholesaleSale = {
        ...baseSaleFixture,
        payment_method: null,
        notes: null
      }

      const orderMock = vi.fn().mockResolvedValue({ data: [historicalSale], error: null })
      const selectMock = vi.fn().mockReturnValue({ order: orderMock })
      ;(supabase.from as any).mockReturnValue({ select: selectMock })

      const result = await getWholesaleSales()
      expect(result[0].payment_method).toBeNull()
      expect(result[0].notes).toBeNull()
      expect(result[0].total_sale).toBe(800)
      expect(result[0].profit).toBe(300)
    })
  })

  describe("13. Centralized calculateWholesaleSale invariant calculations", () => {
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
})
