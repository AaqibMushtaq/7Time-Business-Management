import { describe, it, expect } from 'vitest'
import {
  reconcileDealerPurchases,
  reconcileAllPurchases,
} from './dealerReconciliation'

describe('Dealer Purchase Reconciliation Engine', () => {
  it('Scenario 1: Fully paid purchase at purchase creation time', () => {
    const purchases = [
      {
        id: 'purch-1',
        total_amount: 10000,
        amount_paid: 10000,
        purchase_date: '2026-03-01',
      },
    ]
    const payments: any[] = []

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled).toHaveLength(1)
    expect(reconciled[0].reconciled_paid).toBe(10000)
    expect(reconciled[0].reconciled_balance).toBe(0)
    expect(reconciled[0].status).toBe('PAID')
    expect(reconciled[0].allocations).toHaveLength(0)
  })

  it('Scenario 2: Standalone dealer payment fully pays purchase (AL INFAQ TRADERS bug scenario)', () => {
    // Problem scenario: purchase created with amount_paid = 0, total = 23300
    // Separate standalone payment disbursed for 23300
    const purchases = [
      {
        id: 'purch-al-infaq',
        total_amount: 23300,
        amount_paid: 0,
        purchase_date: '2026-03-01',
      },
    ]
    const payments = [
      {
        id: 'pay-al-infaq-1',
        payment_date: '2026-03-05',
        amount: 23300,
        reference: 'DISB-2026-001',
        payment_method: 'BANK_TRANSFER',
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled).toHaveLength(1)
    expect(reconciled[0].reconciled_paid).toBe(23300)
    expect(reconciled[0].reconciled_balance).toBe(0)
    expect(reconciled[0].status).toBe('PAID')
    expect(reconciled[0].allocated_standalone_paid).toBe(23300)
    expect(reconciled[0].allocations).toHaveLength(1)
    expect(reconciled[0].allocations[0].amount).toBe(23300)
    expect(reconciled[0].allocations[0].payment_id).toBe('pay-al-infaq-1')
  })

  it('Scenario 3: Partially paid purchase (initial downpayment + partial standalone payment)', () => {
    const purchases = [
      {
        id: 'purch-part',
        total_amount: 15000,
        amount_paid: 5000,
        purchase_date: '2026-03-01',
      },
    ]
    const payments = [
      {
        id: 'pay-part-1',
        payment_date: '2026-03-10',
        amount: 4000,
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled).toHaveLength(1)
    expect(reconciled[0].reconciled_paid).toBe(9000)
    expect(reconciled[0].reconciled_balance).toBe(6000)
    expect(reconciled[0].status).toBe('PARTIAL')
    expect(reconciled[0].allocated_standalone_paid).toBe(4000)
  })

  it('Scenario 4: Unpaid purchase (zero payments applied)', () => {
    const purchases = [
      {
        id: 'purch-unpaid',
        total_amount: 8000,
        amount_paid: 0,
        purchase_date: '2026-03-01',
      },
    ]
    const payments: any[] = []

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled).toHaveLength(1)
    expect(reconciled[0].reconciled_paid).toBe(0)
    expect(reconciled[0].reconciled_balance).toBe(8000)
    expect(reconciled[0].status).toBe('UNPAID')
    expect(reconciled[0].allocations).toHaveLength(0)
  })

  it('Scenario 5: Multiple payments against one purchase', () => {
    const purchases = [
      {
        id: 'purch-multi-pay',
        total_amount: 12000,
        amount_paid: 2000,
        purchase_date: '2026-03-01',
      },
    ]
    const payments = [
      {
        id: 'pay-1',
        payment_date: '2026-03-05',
        amount: 4000,
      },
      {
        id: 'pay-2',
        payment_date: '2026-03-12',
        amount: 6000,
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled[0].reconciled_paid).toBe(12000)
    expect(reconciled[0].reconciled_balance).toBe(0)
    expect(reconciled[0].status).toBe('PAID')
    expect(reconciled[0].allocations).toHaveLength(2)
    expect(reconciled[0].allocations[0].amount).toBe(4000)
    expect(reconciled[0].allocations[1].amount).toBe(6000)
  })

  it('Scenario 6: Multiple purchases with partial allocations in FIFO order', () => {
    const purchases = [
      {
        id: 'purch-old',
        total_amount: 10000,
        amount_paid: 0,
        purchase_date: '2026-01-10',
      },
      {
        id: 'purch-new',
        total_amount: 20000,
        amount_paid: 0,
        purchase_date: '2026-02-15',
      },
    ]
    // Single payment of 15000: covers 10000 of purch-old completely, leaves 5000 for purch-new
    const payments = [
      {
        id: 'pay-fifo',
        payment_date: '2026-02-20',
        amount: 15000,
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled[0].id).toBe('purch-old')
    expect(reconciled[0].reconciled_paid).toBe(10000)
    expect(reconciled[0].reconciled_balance).toBe(0)
    expect(reconciled[0].status).toBe('PAID')

    expect(reconciled[1].id).toBe('purch-new')
    expect(reconciled[1].reconciled_paid).toBe(5000)
    expect(reconciled[1].reconciled_balance).toBe(15000)
    expect(reconciled[1].status).toBe('PARTIAL')
  })

  it('Scenario 7: Standalone payments with positive opening balance (prior liability cleared first)', () => {
    // Dealer has an opening debt of 5000 before purchases
    // Then a purchase of 10000
    // Payment of 7000 is made
    // 5000 clears opening debt; remaining 2000 goes to the purchase
    const purchases = [
      {
        id: 'purch-with-opening-debt',
        total_amount: 10000,
        amount_paid: 0,
        purchase_date: '2026-03-01',
      },
    ]
    const payments = [
      {
        id: 'pay-open-and-purch',
        payment_date: '2026-03-05',
        amount: 7000,
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 5000)
    expect(reconciled[0].reconciled_paid).toBe(2000)
    expect(reconciled[0].reconciled_balance).toBe(8000)
    expect(reconciled[0].status).toBe('PARTIAL')
  })

  it('Scenario 8: Negative opening balance (supplier advance credit reduces open purchases)', () => {
    // Dealer has -4000 opening balance (advance paid in previous period)
    // Purchase of 10000
    // Advance credit of 4000 reduces purchase to 6000 balance
    const purchases = [
      {
        id: 'purch-advance',
        total_amount: 10000,
        amount_paid: 0,
        purchase_date: '2026-03-01',
      },
    ]
    const payments: any[] = []

    const reconciled = reconcileDealerPurchases(purchases, payments, -4000)
    expect(reconciled[0].reconciled_paid).toBe(4000)
    expect(reconciled[0].reconciled_balance).toBe(6000)
    expect(reconciled[0].status).toBe('PARTIAL')
    expect(reconciled[0].allocations).toHaveLength(1)
    expect(reconciled[0].allocations[0].reference).toBe('Advance Credit')
  })

  it('Scenario 9: Zero outstanding balance and currency rounding precision (tolerance <= 0.005)', () => {
    const purchases = [
      {
        id: 'purch-rounding',
        total_amount: 1000.004,
        amount_paid: 1000.0,
        purchase_date: '2026-03-01',
      },
    ]
    const payments: any[] = []

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    expect(reconciled[0].reconciled_balance).toBe(0)
    expect(reconciled[0].status).toBe('PAID')
  })

  it('Scenario 10: Prevention of duplicate payment allocation (total allocated <= total payments)', () => {
    const purchases = [
      {
        id: 'purch-1',
        total_amount: 5000,
        amount_paid: 0,
        purchase_date: '2026-01-01',
      },
      {
        id: 'purch-2',
        total_amount: 5000,
        amount_paid: 0,
        purchase_date: '2026-01-02',
      },
      {
        id: 'purch-3',
        total_amount: 5000,
        amount_paid: 0,
        purchase_date: '2026-01-03',
      },
    ]
    // Only 6000 total paid
    const payments = [
      {
        id: 'pay-single',
        payment_date: '2026-01-15',
        amount: 6000,
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    const totalStandaloneAllocated = reconciled.reduce(
      (sum, p) => sum + p.allocated_standalone_paid,
      0
    )
    expect(totalStandaloneAllocated).toBe(6000)
    expect(reconciled[0].status).toBe('PAID')
    expect(reconciled[1].status).toBe('PARTIAL')
    expect(reconciled[1].reconciled_paid).toBe(1000)
    expect(reconciled[1].reconciled_balance).toBe(4000)
    expect(reconciled[2].status).toBe('UNPAID')
    expect(reconciled[2].reconciled_paid).toBe(0)
    expect(reconciled[2].reconciled_balance).toBe(5000)
  })

  it('Scenario 11: Specific reference matching takes priority over raw FIFO', () => {
    const purchases = [
      {
        id: 'purch-a',
        reference: 'INV-1001',
        total_amount: 10000,
        amount_paid: 0,
        purchase_date: '2026-01-01',
      },
      {
        id: 'purch-b',
        reference: 'INV-1002',
        total_amount: 10000,
        amount_paid: 0,
        purchase_date: '2026-01-02',
      },
    ]
    // Payment explicitly references INV-1002
    const payments = [
      {
        id: 'pay-targeted',
        payment_date: '2026-01-10',
        amount: 10000,
        reference: 'INV-1002',
      },
    ]

    const reconciled = reconcileDealerPurchases(purchases, payments, 0)
    // purch-a should be UNPAID (even though older) because payment targeted INV-1002
    expect(reconciled[0].id).toBe('purch-a')
    expect(reconciled[0].status).toBe('UNPAID')
    expect(reconciled[0].reconciled_balance).toBe(10000)

    // purch-b should be PAID
    expect(reconciled[1].id).toBe('purch-b')
    expect(reconciled[1].status).toBe('PAID')
    expect(reconciled[1].reconciled_balance).toBe(0)
    expect(reconciled[1].allocations[0].reference).toBe('INV-1002')
  })

  it('reconcileAllPurchases groups and reconciles correctly across multiple dealers', () => {
    const purchases = [
      {
        id: 'd1-p1',
        dealer_id: 'dealer-1',
        total_amount: 10000,
        amount_paid: 0,
        purchase_date: '2026-01-01',
      },
      {
        id: 'd2-p1',
        dealer_id: 'dealer-2',
        total_amount: 5000,
        amount_paid: 0,
        purchase_date: '2026-01-01',
      },
    ]
    const payments = [
      {
        id: 'pay-d1',
        dealer_id: 'dealer-1',
        payment_date: '2026-01-05',
        amount: 10000,
      },
    ]
    const dealers = [
      { id: 'dealer-1', opening_balance: 0 },
      { id: 'dealer-2', opening_balance: 0 },
    ]

    const reconciled = reconcileAllPurchases(purchases, payments, dealers)
    expect(reconciled).toHaveLength(2)

    // Dealer 1 purchase is paid
    const d1Purch = reconciled.find((p) => p.id === 'd1-p1')!
    expect(d1Purch.status).toBe('PAID')
    expect(d1Purch.reconciled_balance).toBe(0)

    // Dealer 2 purchase is unpaid (dealer 1 payment did not bleed into dealer 2)
    const d2Purch = reconciled.find((p) => p.id === 'd2-p1')!
    expect(d2Purch.status).toBe('UNPAID')
    expect(d2Purch.reconciled_balance).toBe(5000)
  })
})
