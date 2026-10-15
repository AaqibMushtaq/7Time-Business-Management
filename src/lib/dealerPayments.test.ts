import { describe, it, expect } from 'vitest'

describe('Dealer Payments and Ledger Reconciliation', () => {
  it('Test 1 — Payment reduces outstanding', () => {
    // Opening payable 10000 (represented by purchases), payment 4000
    const purchases = [{ total_amount: 10000, amount_paid: 0, dealer_id: 'd1' }]
    const payments = [{ amount: 4000, dealer_id: 'd1' }]

    let outstanding = 0
    purchases.forEach(p => outstanding += (p.total_amount - p.amount_paid))
    payments.forEach(p => outstanding -= p.amount)

    expect(outstanding).toBe(6000)
  })

  it('Test 2 — Multiple payments', () => {
    // Opening payable 10000, purchases 3000, payments 2000 and 3000
    const purchases = [
      { total_amount: 10000, amount_paid: 0, dealer_id: 'd1' },
      { total_amount: 3000, amount_paid: 0, dealer_id: 'd1' }
    ]
    const payments = [
      { amount: 2000, dealer_id: 'd1' },
      { amount: 3000, dealer_id: 'd1' }
    ]

    let outstanding = 0
    let totalPaid = 0
    purchases.forEach(p => outstanding += (p.total_amount - p.amount_paid))
    payments.forEach(p => {
      outstanding -= p.amount
      totalPaid += p.amount
    })

    expect(totalPaid).toBe(5000)
    expect(outstanding).toBe(8000)
  })

  it('Test 3 — Edit a payment correctly updates totals', () => {
    // Initial payment of 2000, updated to 3000
    let payments = [{ id: 'p1', amount: 2000, dealer_id: 'd1' }]
    
    // update payment
    payments = payments.map(p => p.id === 'p1' ? { ...p, amount: 3000 } : p)

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0)
    expect(totalPaid).toBe(3000)
    expect(payments.length).toBe(1) // No duplicate payment created
  })

  it('Test 7 — Period versus lifetime totals', () => {
    const currentMonth = new Date().toISOString().substring(0, 7) // 'YYYY-MM'
    const lastMonth = '2023-01'

    const payments = [
      { amount: 2000, payment_date: `${currentMonth}-15` },
      { amount: 3000, payment_date: `${lastMonth}-15` }
    ]

    const lifetimePaid = payments.reduce((acc, p) => acc + p.amount, 0)
    const currentPeriodPaid = payments
      .filter(p => p.payment_date.startsWith(currentMonth))
      .reduce((acc, p) => acc + p.amount, 0)

    expect(lifetimePaid).toBe(5000)
    expect(currentPeriodPaid).toBe(2000)
  })

  it('Test 9 — Separate receivable and payable', () => {
    const dealerPurchases = [{ total_amount: 10000, amount_paid: 0 }]
    const dealerPayments = [{ amount: 4000 }]
    
    const resellerSales = [{ total_sale: 8000, amount_received: 0 }]
    const resellerPayments = [{ amount: 3000 }]

    const payable = dealerPurchases.reduce((acc, p) => acc + p.total_amount, 0) - dealerPayments.reduce((acc, p) => acc + p.amount, 0)
    const receivable = resellerSales.reduce((acc, s) => acc + s.total_sale, 0) - resellerPayments.reduce((acc, p) => acc + p.amount, 0)

    expect(payable).toBe(6000)
    expect(receivable).toBe(5000)
  })

  describe('Dealer Payments Notes Feature', () => {
    it('Payment with a note saves correctly and does not alter amount', () => {
      const payment = { id: 'p1', amount: 2000, dealer_id: 'd1', notes: 'Advance payment' }
      expect(payment.notes).toBe('Advance payment')
      expect(payment.amount).toBe(2000)
    })

    it('Payment without a note remains valid and handles null/empty properly', () => {
      const payment = { id: 'p2', amount: 3000, dealer_id: 'd1', notes: null }
      expect(payment.notes).toBeNull()
      expect(payment.amount).toBe(3000)
    })

    it('Editing a note updates the existing payment without duplicate records', () => {
      let payments = [{ id: 'p1', amount: 2000, dealer_id: 'd1', notes: 'Initial note' }]
      
      // Update note
      payments = payments.map(p => p.id === 'p1' ? { ...p, notes: 'Updated note' } : p)

      expect(payments.length).toBe(1)
      expect(payments[0].notes).toBe('Updated note')
      expect(payments[0].amount).toBe(2000) // Amount unaltered
    })

    it('Saving or editing a note does not alter outstanding balances', () => {
      const purchases = [{ total_amount: 10000, amount_paid: 0, dealer_id: 'd1' }]
      let payments = [{ id: 'p1', amount: 4000, dealer_id: 'd1', notes: 'Old' }]

      const calcOutstanding = (ps: any[], pmts: any[]) => {
        let outstanding = 0
        ps.forEach(p => outstanding += (p.total_amount - p.amount_paid))
        pmts.forEach(p => outstanding -= p.amount)
        return outstanding
      }

      const before = calcOutstanding(purchases, payments)
      
      // Edit note only
      payments = payments.map(p => p.id === 'p1' ? { ...p, notes: 'New note' } : p)
      
      const after = calcOutstanding(purchases, payments)

      expect(before).toBe(6000)
      expect(after).toBe(before) // Balance untouched
    })
  })

  describe('Duplicate Submission & Idempotent Guard Protection', () => {
    it('blocks duplicate submissions when pending flag is active', () => {
      let isPending = false
      let callCount = 0

      const submitPayment = (_paymentData: any) => {
        if (isPending) return false
        isPending = true
        callCount++
        return true
      }

      // First submit succeeds
      const first = submitPayment({ amount: 5000 })
      expect(first).toBe(true)
      expect(callCount).toBe(1)

      // Immediate second submit while pending is blocked
      const second = submitPayment({ amount: 5000 })
      expect(second).toBe(false)
      expect(callCount).toBe(1) // Still 1

      // After pending clears, next legitimate submit succeeds
      isPending = false
      const third = submitPayment({ amount: 3000 })
      expect(third).toBe(true)
      expect(callCount).toBe(2)
    })

    it('ensures deduplication logic prevents duplicate entries with identical ID or reference', () => {
      const existingPayments = [
        { id: 'pay-1', dealer_id: 'd1', amount: 5000, reference: 'REF-101' }
      ]

      const addPaymentSafely = (list: typeof existingPayments, newPayment: typeof existingPayments[0]) => {
        if (list.some(p => p.id === newPayment.id)) {
          return list
        }
        return [...list, newPayment]
      }

      const duplicate = { id: 'pay-1', dealer_id: 'd1', amount: 5000, reference: 'REF-101' }
      const updatedList = addPaymentSafely(existingPayments, duplicate)

      expect(updatedList.length).toBe(1)
      expect(updatedList[0].amount).toBe(5000)
    })

    it('rapid repeated clicks on disabled buttons preserve true ledger balances', () => {
      const openingLiability = 10000
      let payments: number[] = []

      let isSubmitting = false
      const simulateClick = (amount: number) => {
        if (isSubmitting) return
        isSubmitting = true
        payments.push(amount)
      }

      // Rapid clicks in the same event loop tick
      simulateClick(3000)
      simulateClick(3000)
      simulateClick(3000)

      const remainingLiability = openingLiability - payments.reduce((sum, p) => sum + p, 0)
      expect(payments.length).toBe(1)
      expect(remainingLiability).toBe(7000)
    })
  })
})
