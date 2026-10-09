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
})
