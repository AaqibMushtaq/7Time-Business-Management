import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboardStats } from './dashboard'
import { supabase } from '@/lib/supabase'
import { getnaeemMonthlyBalance } from '@/services/naeemDeliveries'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

vi.mock('@/services/naeemDeliveries', () => ({
  getnaeemMonthlyBalance: vi.fn(),
}))

describe('Dashboard Stats Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getnaeemMonthlyBalance as any).mockResolvedValue({ opening_balance: 0, is_manual_override: false })
  })

  it('calculates dealer payable correctly for basic reconciliation (Test A)', async () => {
    const mockPurchases = [
      { id: '1', total_amount: 23300, amount_paid: 0, dealer_id: 'd1', purchase_date: '2026-10-05', dealer: { id: 'd1', name: 'Al Infaq' } }
    ]
    const mockPayments = [
      { id: '1', amount: 23000, dealer_id: 'd1', payment_date: '2026-10-07', dealer: { name: 'Al Infaq' } }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      }

      if (table === 'app_settings') {
        queryBuilder.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'products') {
        queryBuilder.select = vi.fn().mockResolvedValue({ data: [] })
      } else if (table === 'purchases') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
      } else if (table === 'dealer_payments') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPayments })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPayments })
      } else if (table === 'wholesale_sales') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: [] })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: [] })
      } else if (table === 'reseller_payments') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: [] })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: [] })
      } else if (table === 'general_daily_records') {
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: [] })
      } else if (table === 'naeem_daily_records') {
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: [] })
      } else if (table === 'naeem_payments') {
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: [] })
      }

      return queryBuilder
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    expect(stats.purchases.total).toBe(23300)
    expect(stats.purchases.paymentsMade).toBe(23000)
    expect(stats.purchases.totalPayable).toBe(300)
  })

  it('calculates overall dealer payable correctly for multiple dealers (Test C)', async () => {
    const mockPurchases = [
      { id: '1', total_amount: 10000, amount_paid: 0, dealer_id: 'd1', purchase_date: '2026-10-05', dealer: { id: 'd1', name: 'Dealer A' } },
      { id: '2', total_amount: 7000, amount_paid: 0, dealer_id: 'd2', purchase_date: '2026-10-05', dealer: { id: 'd2', name: 'Dealer B' } }
    ]
    const mockPayments = [
      { id: '1', amount: 4000, dealer_id: 'd1', payment_date: '2026-10-07', dealer: { name: 'Dealer A' } }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        queryBuilder.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'purchases') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'dealer_payments') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPayments })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPayments })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockPayments }); }
      }

      return queryBuilder
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    expect(stats.purchases.totalPayable).toBe(13000)
    const dealerA = stats.dealers.find(d => d.id === 'd1')
    const dealerB = stats.dealers.find(d => d.id === 'd2')
    
    expect(dealerA?.outstanding).toBe(6000)
    expect(dealerB?.outstanding).toBe(7000)
  })

  it('calculates overall dealer payable correctly for multiple payments (Test D)', async () => {
    const mockPurchases = [
      { id: '1', total_amount: 10000, amount_paid: 0, dealer_id: 'd1', purchase_date: '2026-09-05', dealer: { id: 'd1', name: 'Dealer A' } },
      { id: '2', total_amount: 3000, amount_paid: 0, dealer_id: 'd1', purchase_date: '2026-10-05', dealer: { id: 'd1', name: 'Dealer A' } }
    ]
    const mockPayments = [
      { id: '1', amount: 2000, dealer_id: 'd1', payment_date: '2026-10-07', dealer: { name: 'Dealer A' } },
      { id: '2', amount: 3000, dealer_id: 'd1', payment_date: '2026-10-08', dealer: { name: 'Dealer A' } }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        queryBuilder.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'purchases') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPurchases.filter((p: any) => p.purchase_date.startsWith('2026-10')) })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockPurchases.filter((p: any) => p.purchase_date.startsWith('2026-10')) }); }
      } else if (table === 'dealer_payments') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPayments })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPayments })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockPayments }); }
      }

      return queryBuilder
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    expect(stats.purchases.totalPayable).toBe(8000)
    expect(stats.purchases.paymentsMade).toBe(5000)
    expect(stats.purchases.total).toBe(3000) // this month
  })

  it('synchronizes NAEEM delivery, opening balance, and payments to dashboard stats (Test E)', async () => {
    ;(getnaeemMonthlyBalance as any).mockResolvedValue({ opening_balance: 1180, is_manual_override: true })

    const mockNaeemDeliveries = [
      { id: '1', final_fare: 2850, status: 'Completed', delivery_date: '2026-10-05', route_id: 'r1' },
      { id: '2', final_fare: 0, status: 'No Order', delivery_date: '2026-10-06', route_id: 'r2' }
    ]
    const mockNaeemPayments = [
      { id: '1', amount: 1000, payment_date: '2026-10-08' }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        queryBuilder.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'naeem_daily_records') {
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockNaeemDeliveries })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockNaeemDeliveries }); }
      } else if (table === 'naeem_payments') {
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockNaeemPayments })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockNaeemPayments }); }
      }

      return queryBuilder
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    expect(stats.naeem.openingBalance).toBe(1180)
    expect(stats.naeem.total).toBe(2850)
    expect(stats.naeem.totalDue).toBe(4030)
    expect(stats.naeem.received).toBe(1000)
    expect(stats.naeem.pending).toBe(3030)
    expect(stats.naeem.trips).toBe(1) // "No Order" trip excluded
  })

  it('aggregates daily Cash Flow & Collections correctly without double-counting', async () => {
    const mockSales = [
      { id: 's1', total_sale: 20000, amount_received: 15000, customer_id: 'r1', sale_date: '2026-10-02', profit: 5000, buying_cost: 150, quantity: 100 }
    ]
    const mockResellerPayments = [
      { id: 'rp1', amount: 3000, customer_id: 'r1', payment_date: '2026-10-02' }
    ]
    const mockPurchases = [
      { id: 'p1', total_amount: 10000, amount_paid: 4000, dealer_id: 'd1', purchase_date: '2026-10-02' }
    ]
    const mockDealerPayments = [
      { id: 'dp1', amount: 2000, dealer_id: 'd1', payment_date: '2026-10-03' }
    ]
    const mockGeneralDel = [
      { id: 'g1', fuel_expenses: 500, record_date: '2026-10-02', entries: [{ amount: 1500 }] }
    ]
    const mockDealersMaster = [
      { id: 'd1', name: 'Al Infaq Wholesale' }
    ]
    const mockResellersMaster = [
      { id: 'r1', name: 'Kashmir Electronics' }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        queryBuilder.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'wholesale_sales') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockSales })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockSales })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockSales }); }
      } else if (table === 'reseller_payments') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockResellerPayments })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockResellerPayments })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockResellerPayments }); }
      } else if (table === 'purchases') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'dealer_payments') {
        queryBuilder.limit = vi.fn().mockResolvedValue({ data: mockDealerPayments })
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockDealerPayments })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockDealerPayments }); }
      } else if (table === 'general_daily_records') {
        queryBuilder.lte = vi.fn().mockResolvedValue({ data: mockGeneralDel })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockGeneralDel }); }
      } else if (table === 'dealers') {
        queryBuilder.select = vi.fn().mockResolvedValue({ data: mockDealersMaster })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockDealersMaster }); }
      } else if (table === 'reseller_customers') {
        queryBuilder.select = vi.fn().mockResolvedValue({ data: mockResellersMaster })
        queryBuilder.then = function(resolve: any) { resolve({ data: mockResellersMaster }); }
      }

      return queryBuilder
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    // Inflows: 15,000 (sale cash) + 3,000 (reseller payment) = 18,000
    expect(stats.cashFlow.totalInflows).toBe(18000)
    // Outflows: 4,000 (purchase paid) + 2,000 (dealer payment) + 500 (fuel) = 6,500
    expect(stats.cashFlow.totalOutflows).toBe(6500)
    // Net: 18,000 - 6,500 = 11,500
    expect(stats.cashFlow.net).toBe(11500)

    // Check chart daily breakdown
    expect(stats.cashFlow.chartData.length).toBe(2)
    const day2 = stats.cashFlow.chartData.find(c => c.date === '2026-10-02')
    expect(day2?.inflow).toBe(18000)
    expect(day2?.outflow).toBe(4500) // 4000 (purchase paid) + 500 (fuel)
    expect(day2?.net).toBe(13500)

    const day3 = stats.cashFlow.chartData.find(c => c.date === '2026-10-03')
    expect(day3?.inflow).toBe(0)
    expect(day3?.outflow).toBe(2000) // 2000 (dealer payment)
    expect(day3?.net).toBe(-2000)

    // Master names mapped
    const dealerD1 = stats.dealers.find(d => d.id === 'd1')
    expect(dealerD1?.name).toBe('Al Infaq Wholesale')

    const resellerR1 = stats.resellers.find(r => r.id === 'r1')
    expect(resellerR1?.name).toBe('Kashmir Electronics')
  })
})

