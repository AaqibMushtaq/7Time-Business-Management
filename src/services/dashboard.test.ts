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

  it('calculates customer receivables correctly with opening balances, sales, credits, and multiple payments', async () => {
    const mockResellers = [
      { id: 'c1', name: 'Customer with Opening Balance', opening_balance: 5000 },
      { id: 'c2', name: 'Customer without Opening Balance', opening_balance: 0 },
      { id: 'c3', name: 'Customer with undefined opening balance' }
    ]
    const mockSales = [
      { id: 's1', customer_id: 'c1', total_sale: 2000, amount_received: 500, sale_date: '2026-10-02', profit: 300, quantity: 1, buying_cost: 1700 },
      { id: 's2', customer_id: 'c2', total_sale: 4000, amount_received: 4000, sale_date: '2026-10-02', profit: 800, quantity: 2, buying_cost: 3200 }
    ]
    const mockCredits = [
      { id: 'cr1', customer_id: 'c1', total_amount: 1500, amount_paid: 0, entry_type: 'PRODUCT_CREDIT' },
      { id: 'cr2', customer_id: 'c3', total_amount: 3000, amount_paid: 1000, entry_type: 'CASH_LOAN' }
    ]
    const mockPayments = [
      { id: 'p1', customer_id: 'c1', amount: 1000, payment_date: '2026-10-05' },
      { id: 'p2', customer_id: 'c3', amount: 500, payment_date: '2026-10-06' }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'reseller_customers') {
        qb.select = vi.fn().mockResolvedValue({ data: mockResellers })
        qb.then = function(resolve: any) { resolve({ data: mockResellers }); }
      } else if (table === 'wholesale_sales') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockSales })
        qb.lte = vi.fn().mockResolvedValue({ data: mockSales })
        qb.then = function(resolve: any) { resolve({ data: mockSales }); }
      } else if (table === 'customer_credits') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockCredits })
        qb.then = function(resolve: any) { resolve({ data: mockCredits }); }
      } else if (table === 'reseller_payments') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPayments })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPayments })
        qb.then = function(resolve: any) { resolve({ data: mockPayments }); }
      }

      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('ALL')

    // c1: opening_balance(5000) + unpaid sales(2000 - 500 = 1500) + credits(1500) - payments(1000) = 7000
    // c2: opening_balance(0) + unpaid sales(4000 - 4000 = 0) = 0
    // c3: opening_balance(0) + credits(3000) - payments(500) = 2500
    // Total true receivable: 7000 + 2500 = 9500
    expect(stats.sales.totalReceivable).toBe(9500)
    expect(stats.receivables.wholesaleOutstanding).toBe(9500)
    expect(stats.receivables.totalOutstanding).toBe(9500)
  })

  it('handles completely empty database tables without crashing', async () => {
    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        order: vi.fn().mockReturnThis(),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    expect(stats.sales.totalReceivable).toBe(0)
    expect(stats.receivables.totalOutstanding).toBe(0)
    expect(stats.purchases.totalPayable).toBe(0)
    expect(stats.cashFlow.totalInflows).toBe(0)
    expect(stats.cashFlow.totalOutflows).toBe(0)
    expect(stats.cashFlow.net).toBe(0)
  })

  it('incorporates dealer opening balance into dashboard totalPayable and dealer breakdown', async () => {
    const mockDealers = [
      { id: 'd1', name: 'Dealer A', opening_balance: 3000 },
      { id: 'd2', name: 'Dealer B', opening_balance: 1500 }
    ]
    const mockPurchases = [
      { id: '1', total_amount: 5000, amount_paid: 1000, dealer_id: 'd1', purchase_date: '2026-10-05', dealer: { id: 'd1', name: 'Dealer A' } }
    ]
    const mockPayments = [
      { id: '1', amount: 2000, dealer_id: 'd1', payment_date: '2026-10-07', dealer: { name: 'Dealer A' } }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        order: vi.fn().mockReturnThis(),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'dealers') {
        qb.select = vi.fn().mockResolvedValue({ data: mockDealers })
      } else if (table === 'purchases') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'dealer_payments') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPayments })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPayments })
        qb.then = function(resolve: any) { resolve({ data: mockPayments }); }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    // Dealer A: Opening ₹3,000 + Purchases (₹5,000 - ₹1,000) - Payments ₹2,000 = ₹5,000
    // Dealer B: Opening ₹1,500 + Purchases ₹0 - Payments ₹0 = ₹1,500
    // Total Payable = ₹5,000 + ₹1,500 = ₹6,500
    expect(stats.purchases.totalPayable).toBe(6500)
    
    const dealerA = stats.dealers.find(d => d.id === 'd1')
    const dealerB = stats.dealers.find(d => d.id === 'd2')
    expect(dealerA?.outstanding).toBe(5000)
    expect(dealerB?.outstanding).toBe(1500)
  })

  it('isolates negative dealer advance balances from reducing totalPayable while keeping negative balance visible in dealer list', async () => {
    const mockDealers = [
      { id: 'd1', name: 'Dealer Payable', opening_balance: 4000 },
      { id: 'd2', name: 'Dealer Advance', opening_balance: -2000 }
    ]
    const mockPurchases: any[] = []
    const mockPayments: any[] = []

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        order: vi.fn().mockReturnThis(),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'dealers') {
        qb.select = vi.fn().mockResolvedValue({ data: mockDealers })
      } else if (table === 'purchases') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'dealer_payments') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPayments })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPayments })
        qb.then = function(resolve: any) { resolve({ data: mockPayments }); }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    // totalPayable includes only positive balances: ₹4,000 (Dealer 2's -₹2,000 does NOT reduce totalPayable)
    expect(stats.purchases.totalPayable).toBe(4000)

    // Dealer 2's advance balance of -₹2,000 remains visible in dealers list
    const dealerAdvance = stats.dealers.find(d => d.id === 'd2')
    expect(dealerAdvance?.outstanding).toBe(-2000)
  })

  it('accurately computes wholesale COGS, profit margin, and segregates personal ledger balances and funding sources', async () => {
    const mockSales = [
      { id: 's1', total_sale: 50000, amount_received: 20000, buying_cost: 300, quantity: 100, profit: 20000, customer_id: 'r1', sale_date: '2026-10-02' }
    ]
    const mockCredits = [
      { id: 'cr1', customer_id: 'p1', total_amount: 8000, amount_paid: 2000, balance: 6000, entry_type: 'PRODUCT_CREDIT', funding_source: '7TIME_FUNDS' },
      { id: 'cr2', customer_id: 'p2', total_amount: 5000, amount_paid: 1000, balance: 4000, entry_type: 'CASH_LOAN', funding_source: 'PERSONAL_FUNDS' },
      { id: 'cr3', customer_id: 'p3', total_amount: 3000, amount_paid: 0, balance: 3000, entry_type: 'OTHER_CREDIT', funding_source: null }
    ]
    const mockResellers = [
      { id: 'r1', name: 'Wholesale Buyer', opening_balance: 0 },
      { id: 'p1', name: 'Person A', opening_balance: 0 },
      { id: 'p2', name: 'Person B', opening_balance: 0 },
      { id: 'p3', name: 'Person C', opening_balance: 0 }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        order: vi.fn().mockReturnThis(),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'reseller_customers') {
        qb.select = vi.fn().mockResolvedValue({ data: mockResellers })
        qb.then = function(resolve: any) { resolve({ data: mockResellers }); }
      } else if (table === 'wholesale_sales') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockSales })
        qb.lte = vi.fn().mockResolvedValue({ data: mockSales })
        qb.then = function(resolve: any) { resolve({ data: mockSales }); }
      } else if (table === 'customer_credits') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockCredits })
        qb.then = function(resolve: any) { resolve({ data: mockCredits }); }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    // Wholesale COGS: 300 * 100 = 30,000
    expect(stats.sales.cogs).toBe(30000)
    // Wholesale Gross Profit: 20,000
    expect(stats.sales.profit).toBe(20000)
    // Wholesale Profit Margin: (20000 / 50000) * 100 = 40%
    expect(stats.sales.profitMargin).toBe(40)

    // Personal Ledger Outstanding: 6,000 + 4,000 + 3,000 = 13,000
    expect(stats.receivables.personalLedgerOutstanding).toBe(13000)
    expect(stats.receivables.funds7TimeOutstanding).toBe(6000)
    expect(stats.receivables.fundsPersonalOutstanding).toBe(4000)
    expect(stats.receivables.fundsUnallocatedOutstanding).toBe(3000)

    // Debtors categorization: Person A (pure personal credit) is tagged as PERSONAL_LEDGER
    const debtorA = stats.receivables.debtors.find(d => d.id === 'p1')
    expect(debtorA?.source).toBe('PERSONAL_LEDGER')
    expect(debtorA?.sourceLabel).toBe('Personal Ledger')
    expect(debtorA?.routePath).toBe('/local-customers/p1')

    // Wholesale Buyer is tagged as WHOLESALE_RESELLER
    const debtorWholesale = stats.receivables.debtors.find(d => d.id === 'r1')
    expect(debtorWholesale?.source).toBe('WHOLESALE_RESELLER')
    expect(debtorWholesale?.sourceLabel).toBe('Wholesale Customer')
  })

  it('aggregates monthly financial trends chronologically covering 12 months with year transition (Phase 4)', async () => {
    // Purchases and sales across different months including year boundary
    const mockPurchases = [
      { id: 'p1', total_amount: 15000, amount_paid: 15000, dealer_id: 'd1', purchase_date: '2025-12-15', dealer: { id: 'd1', name: 'Dealer A' } },
      { id: 'p2', total_amount: 25000, amount_paid: 20000, dealer_id: 'd1', purchase_date: '2026-01-20', dealer: { id: 'd1', name: 'Dealer A' } },
      { id: 'p3', total_amount: 30000, amount_paid: 30000, dealer_id: 'd1', purchase_date: '2026-10-05', dealer: { id: 'd1', name: 'Dealer A' } },
    ]
    const mockDealerPayments = [
      { id: 'dp1', amount: 5000, dealer_id: 'd1', payment_date: '2026-02-10', dealer: { name: 'Dealer A' } },
      { id: 'dp2', amount: 12000, dealer_id: 'd1', payment_date: '2026-10-12', dealer: { name: 'Dealer A' } },
    ]
    const mockSales = [
      { id: 's1', total_sale: 20000, amount_received: 18000, profit: 5000, customer_id: 'c1', sale_date: '2025-12-20', created_at: '2025-12-20', quantity: 10, buying_cost: 1500, customer: { id: 'c1', name: 'Cust 1', customer_type: 'WHOLESALE' } },
      { id: 's2', total_sale: 40000, amount_received: 30000, profit: 10000, customer_id: 'c1', sale_date: '2026-09-15', created_at: '2026-09-15', quantity: 20, buying_cost: 1500, customer: { id: 'c1', name: 'Cust 1', customer_type: 'WHOLESALE' } },
      { id: 's3', total_sale: 50000, amount_received: 45000, profit: 15000, customer_id: 'c1', sale_date: '2026-10-02', created_at: '2026-10-02', quantity: 25, buying_cost: 1400, customer: { id: 'c1', name: 'Cust 1', customer_type: 'WHOLESALE' } },
    ]
    const mockResellerPayments = [
      { id: 'rp1', amount: 5000, customer_id: 'c1', payment_date: '2026-10-08', created_at: '2026-10-08', customer: { id: 'c1', name: 'Cust 1', customer_type: 'WHOLESALE' } }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'purchases') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.lte = vi.fn().mockResolvedValue({ data: [mockPurchases[2]] })
        qb.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'dealer_payments') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockDealerPayments })
        qb.lte = vi.fn().mockResolvedValue({ data: [mockDealerPayments[1]] })
        qb.then = function(resolve: any) { resolve({ data: mockDealerPayments }); }
      } else if (table === 'wholesale_sales') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockSales })
        qb.lte = vi.fn().mockResolvedValue({ data: [mockSales[2]] })
        qb.then = function(resolve: any) { resolve({ data: mockSales }); }
      } else if (table === 'reseller_payments') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockResellerPayments })
        qb.lte = vi.fn().mockResolvedValue({ data: mockResellerPayments })
        qb.then = function(resolve: any) { resolve({ data: mockResellerPayments }); }
      } else if (table === 'dealers') {
        qb.then = function(resolve: any) { resolve({ data: [{ id: 'd1', name: 'Dealer A', opening_balance: 0 }] }); }
      } else if (table === 'reseller_customers') {
        qb.then = function(resolve: any) { resolve({ data: [{ id: 'c1', name: 'Cust 1', customer_type: 'WHOLESALE', opening_balance: 0 }] }); }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    // Query for custom period: October 2026
    const stats = await getDashboardStats('CUSTOM', '2026-10-01', '2026-10-31')

    // Verify monthlyTrends exists and contains exactly 12 months
    expect(stats.monthlyTrends).toBeDefined()
    expect(stats.monthlyTrends.length).toBe(12)

    // Verify chronological order ending at 2026-10
    const lastMonth = stats.monthlyTrends[11]
    expect(lastMonth.month).toBe('2026-10')
    expect(lastMonth.monthLabel).toBe('October 2026')
    expect(lastMonth.purchases).toBe(30000)
    expect(lastMonth.sales).toBe(50000)
    expect(lastMonth.profit).toBe(15000)
    // Cash received: 45000 (at dispatch) + 5000 (payment) = 50000
    expect(lastMonth.cashReceived).toBe(50000)
    // Cash paid: 30000 (at purchase) + 12000 (dealer payment) = 42000
    expect(lastMonth.cashPaid).toBe(42000)

    // Verify year boundary: month at index 1 is 2025-12
    const dec2025 = stats.monthlyTrends.find(m => m.month === '2025-12')
    expect(dec2025).toBeDefined()
    expect(dec2025?.purchases).toBe(15000)
    expect(dec2025?.sales).toBe(20000)

    // Verify Month-over-Month insights: 2026-10 vs 2026-09
    // Sales: 50,000 vs 40,000 -> +10,000 (+25.0%)
    expect(stats.insights.salesMoM.current).toBe(50000)
    expect(stats.insights.salesMoM.previous).toBe(40000)
    expect(stats.insights.salesMoM.changeAmount).toBe(10000)
    expect(stats.insights.salesMoM.changePercentage).toBe(25)
    expect(stats.insights.salesMoM.trend).toBe('UP')

    // Gross profit: 15,000 vs 10,000 -> +5,000 (+50.0%)
    expect(stats.insights.grossProfitMoM.current).toBe(15000)
    expect(stats.insights.grossProfitMoM.previous).toBe(10000)
    expect(stats.insights.grossProfitMoM.changePercentage).toBe(50)
    expect(stats.insights.grossProfitMoM.trend).toBe('UP')

    // Wholesale margin: (15000 / 50000) * 100 = 30.0%
    expect(stats.insights.wholesaleMargin.marginPercentage).toBe(30)
    expect(stats.insights.wholesaleMargin.status).toBe('HEALTHY')
  })

  it('handles empty months and zero-denominator percentage calculations safely without NaN or Infinity (Phase 4)', async () => {
    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }
      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('CUSTOM', '2026-10-01', '2026-10-31')

    // When no prior data exists:
    expect(stats.insights.salesMoM.changePercentage).toBeNull()
    expect(Number.isNaN(stats.insights.salesMoM.changePercentage)).toBe(false)
    expect(stats.insights.grossProfitMoM.changePercentage).toBeNull()
    expect(Number.isNaN(stats.insights.grossProfitMoM.changePercentage)).toBe(false)
    expect(stats.insights.wholesaleMargin.marginPercentage).toBe(0)
    expect(stats.insights.wholesaleMargin.status).toBe('NO_SALES')
    expect(stats.insights.cashCollectionRatio.ratioPercentage).toBeNull()
    expect(stats.insights.supplierActivity.netObligationChange).toBe(0)
    expect(stats.insights.topExposureDebtors).toEqual([])

    // Empty balances breakdown reconciles to 0
    expect(stats.balancesBreakdown.receivables.total).toBe(0)
    expect(stats.balancesBreakdown.payables.total).toBe(0)
    expect(stats.balancesBreakdown.netWorkingPosition).toBe(0)
  })

  it('reconciles outstanding balances breakdown totals exactly with KPI totalReceivables and totalPayables with non-netting (Phase 4)', async () => {
    // 2 dealers: Dealer A has payable 5000, Dealer B has payable 3000 -> Total payables = 8000
    const mockPurchases = [
      { id: 'p1', total_amount: 10000, amount_paid: 5000, dealer_id: 'd1', purchase_date: '2026-10-01', dealer: { id: 'd1', name: 'Dealer A' } },
      { id: 'p2', total_amount: 3000, amount_paid: 0, dealer_id: 'd2', purchase_date: '2026-10-02', dealer: { id: 'd2', name: 'Dealer B' } },
    ]
    // 1 wholesale buyer owes 4000
    const mockSales = [
      { id: 's1', total_sale: 10000, amount_received: 6000, profit: 2000, customer_id: 'c1', sale_date: '2026-10-05', quantity: 1, buying_cost: 8000, customer: { id: 'c1', name: 'Wholesale Buyer 1', customer_type: 'WHOLESALE' } }
    ]
    // 1 personal ledger customer owes 2500 (7Time funds: 1500, Personal funds: 1000)
    const mockCredits = [
      { id: 'cr1', customer_id: 'p1', total_amount: 1500, amount_paid: 0, balance: 1500, entry_type: 'PRODUCT_CREDIT', funding_source: '7TIME_FUNDS' },
      { id: 'cr2', customer_id: 'p1', total_amount: 1000, amount_paid: 0, balance: 1000, entry_type: 'PRODUCT_CREDIT', funding_source: 'PERSONAL_FUNDS' }
    ]
    // NAEEM pending balance: 3500
    const mockNaeemRecords = [
      { id: 'n1', delivery_date: '2026-10-08', final_fare: 5000, status: 'DELIVERED', route_id: 'r1' }
    ]
    const mockNaeemPayments = [
      { id: 'np1', amount: 1500, payment_date: '2026-10-09' }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'purchases') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'wholesale_sales') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockSales })
        qb.lte = vi.fn().mockResolvedValue({ data: mockSales })
        qb.then = function(resolve: any) { resolve({ data: mockSales }); }
      } else if (table === 'customer_credits') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockCredits })
        qb.then = function(resolve: any) { resolve({ data: mockCredits }); }
      } else if (table === 'dealers') {
        qb.then = function(resolve: any) {
          resolve({
            data: [
              { id: 'd1', name: 'Dealer A', opening_balance: 0 },
              { id: 'd2', name: 'Dealer B', opening_balance: 0 },
            ]
          });
        }
      } else if (table === 'reseller_customers') {
        qb.then = function(resolve: any) {
          resolve({
            data: [
              { id: 'c1', name: 'Wholesale Buyer 1', customer_type: 'WHOLESALE', opening_balance: 0 },
              { id: 'p1', name: 'Person A', customer_type: 'PERSONAL', opening_balance: 0 },
            ]
          });
        }
      } else if (table === 'naeem_daily_records') {
        qb.lte = vi.fn().mockResolvedValue({ data: mockNaeemRecords })
        qb.then = function(resolve: any) { resolve({ data: mockNaeemRecords }); }
      } else if (table === 'naeem_payments') {
        qb.lte = vi.fn().mockResolvedValue({ data: mockNaeemPayments })
        qb.then = function(resolve: any) { resolve({ data: mockNaeemPayments }); }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('CUSTOM', '2026-10-01', '2026-10-31')

    // Wholesale receivable: 4000
    // Personal ledger: 2500 (7Time: 1500, Personal: 1000)
    // NAEEM pending: 5000 - 1500 = 3500
    // Total Receivables = 4000 + 2500 + 3500 = 10,000
    expect(stats.sales.totalReceivable).toBe(6500) // (wholesale 4000 + personal 2500)
    expect(stats.naeem.pending).toBe(3500)
    const expectedTotalReceivables = stats.sales.totalReceivable + Math.max(0, stats.naeem.pending)
    expect(expectedTotalReceivables).toBe(10000)

    // Reconcile breakdown receivables total with dashboard KPI totalReceivables
    expect(stats.balancesBreakdown.receivables.total).toBe(expectedTotalReceivables)
    expect(stats.balancesBreakdown.receivables.wholesale).toBe(4000)
    expect(stats.balancesBreakdown.receivables.personalLedger).toBe(2500)
    expect(stats.balancesBreakdown.receivables.personalLedger7Time).toBe(1500)
    expect(stats.balancesBreakdown.receivables.personalLedgerPersonal).toBe(1000)
    expect(stats.balancesBreakdown.receivables.naeem).toBe(3500)

    // Dealer A: 5000, Dealer B: 3000 -> Total payables = 8000
    expect(stats.purchases.totalPayable).toBe(8000)
    expect(stats.balancesBreakdown.payables.total).toBe(stats.purchases.totalPayable)
    expect(stats.balancesBreakdown.payables.dealersCount).toBe(2)
    expect(stats.balancesBreakdown.payables.topPayables[0].name).toBe('Dealer A')
    expect(stats.balancesBreakdown.payables.topPayables[0].amount).toBe(5000)
    expect(stats.balancesBreakdown.payables.topPayables[1].name).toBe('Dealer B')
    expect(stats.balancesBreakdown.payables.topPayables[1].amount).toBe(3000)

    // Net working position: 10,000 - 8,000 = 2,000
    expect(stats.balancesBreakdown.netWorkingPosition).toBe(2000)
  })

  it('guarantees non-offsetting of dealer advances against other payables and preserves unallocated personal funds attribution (Phase 5 Audit)', async () => {
    // Dealer 1 owes 12000; Dealer 2 has advance of -5000 (paid 15000 on 10000 purchases)
    const mockPurchases = [
      { id: 'p1', total_amount: 12000, amount_paid: 0, dealer_id: 'd1', purchase_date: '2026-10-01', dealer: { id: 'd1', name: 'Al Noor Mills' } },
      { id: 'p2', total_amount: 10000, amount_paid: 0, dealer_id: 'd2', purchase_date: '2026-10-02', dealer: { id: 'd2', name: 'Kashmir Spices' } },
    ]
    const mockDealerPayments = [
      { id: 'dp1', amount: 15000, dealer_id: 'd2', payment_date: '2026-10-03', dealer: { name: 'Kashmir Spices' } }
    ]
    // 3 personal ledger credits with different funding sources including null
    const mockCredits = [
      { id: 'c1', customer_id: 'p1', total_amount: 3000, amount_paid: 0, balance: 3000, entry_type: 'PRODUCT_CREDIT', funding_source: '7TIME_FUNDS' },
      { id: 'c2', customer_id: 'p2', total_amount: 2000, amount_paid: 0, balance: 2000, entry_type: 'PRODUCT_CREDIT', funding_source: 'PERSONAL_FUNDS' },
      { id: 'c3', customer_id: 'p3', total_amount: 1500, amount_paid: 0, balance: 1500, entry_type: 'PRODUCT_CREDIT', funding_source: null }
    ]

    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }); }
      }

      if (table === 'app_settings') {
        qb.single = vi.fn().mockResolvedValue({ data: { low_stock_threshold: 2 } })
      } else if (table === 'purchases') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.lte = vi.fn().mockResolvedValue({ data: mockPurchases })
        qb.then = function(resolve: any) { resolve({ data: mockPurchases }); }
      } else if (table === 'dealer_payments') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockDealerPayments })
        qb.lte = vi.fn().mockResolvedValue({ data: mockDealerPayments })
        qb.then = function(resolve: any) { resolve({ data: mockDealerPayments }); }
      } else if (table === 'customer_credits') {
        qb.limit = vi.fn().mockResolvedValue({ data: mockCredits })
        qb.then = function(resolve: any) { resolve({ data: mockCredits }); }
      } else if (table === 'dealers') {
        qb.then = function(resolve: any) {
          resolve({
            data: [
              { id: 'd1', name: 'Al Noor Mills', opening_balance: 0 },
              { id: 'd2', name: 'Kashmir Spices', opening_balance: 0 },
            ]
          });
        }
      } else if (table === 'reseller_customers') {
        qb.then = function(resolve: any) {
          resolve({
            data: [
              { id: 'p1', name: 'Person A', customer_type: 'PERSONAL', opening_balance: 0 },
              { id: 'p2', name: 'Person B', customer_type: 'PERSONAL', opening_balance: 0 },
              { id: 'p3', name: 'Person C', customer_type: 'PERSONAL', opening_balance: 0 },
            ]
          });
        }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('CUSTOM', '2026-10-01', '2026-10-31')

    // NON-NETTING CHECK: Total payables must be exactly 12000 (NOT 12000 - 5000 = 7000!)
    expect(stats.purchases.totalPayable).toBe(12000)
    expect(stats.balancesBreakdown.payables.total).toBe(12000)

    // Dealer with advance remains visible in dealer breakdown with negative balance
    const advanceDealer = stats.dealers.find(d => d.id === 'd2')
    expect(advanceDealer?.outstanding).toBe(-5000)

    // Payables breakdown contains only dealers with positive debt
    expect(stats.balancesBreakdown.payables.dealersCount).toBe(1)
    expect(stats.balancesBreakdown.payables.topPayables[0].name).toBe('Al Noor Mills')
    expect(stats.balancesBreakdown.payables.topPayables[0].amount).toBe(12000)
    expect(stats.balancesBreakdown.payables.topPayables[0].percentageOfTotal).toBe(100)

    // PERSONAL LEDGER FUNDING SOURCE INTEGRITY:
    expect(stats.balancesBreakdown.receivables.personalLedger).toBe(6500)
    expect(stats.balancesBreakdown.receivables.personalLedger7Time).toBe(3000)
    expect(stats.balancesBreakdown.receivables.personalLedgerPersonal).toBe(2000)
    // Null source is strictly counted as unallocated without guessing
    expect(stats.balancesBreakdown.receivables.personalLedgerUnallocated).toBe(1500)
    expect(stats.receivables.fundsUnallocatedOutstanding).toBe(1500)
  })

  it('returns true zero financial metrics when remote database tables contain zero records, without generating hardcoded or fabricated numbers', async () => {
    const fromMock = vi.fn().mockImplementation((_table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockResolvedValue({ data: [] }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        then: function(resolve: any) { resolve({ data: [] }) }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    const stats = await getDashboardStats('THIS_MONTH')

    // All financial totals must strictly be 0
    expect(stats.purchases.total).toBe(0)
    expect(stats.purchases.paymentsMade).toBe(0)
    expect(stats.purchases.totalPayable).toBe(0)
    expect(stats.sales.total).toBe(0)
    expect(stats.sales.received).toBe(0)
    expect(stats.sales.totalReceivable).toBe(0)
    expect(stats.sales.profit).toBe(0)
    expect(stats.generalDelivery.total).toBe(0)
    expect(stats.generalDelivery.fuel).toBe(0)
    expect(stats.generalDelivery.net).toBe(0)
    expect(stats.naeem.total).toBe(0)
    expect(stats.naeem.received).toBe(0)
    expect(stats.naeem.pending).toBe(0)
    expect(stats.receivables.totalOutstanding).toBe(0)
    expect(stats.receivables.debtorsCount).toBe(0)
    expect(stats.receivables.debtors).toEqual([])
    expect(stats.dealers).toEqual([])
    expect(stats.resellers).toEqual([])
    expect(stats.balancesBreakdown.receivables.total).toBe(0)
    expect(stats.balancesBreakdown.payables.total).toBe(0)
    expect(stats.balancesBreakdown.netWorkingPosition).toBe(0)
    expect(stats.insights.salesMoM.current).toBe(0)
    expect(stats.insights.wholesaleMargin.status).toBe('NO_SALES')
    expect(stats.insights.topExposureDebtors).toEqual([])
  })

  it('throws an explicit error when any critical database query returns an error, preventing silent corruption or fake numbers', async () => {
    const errorResult = { data: null, error: { message: 'Database connection terminated unexpectedly' } }
    const fromMock = vi.fn().mockImplementation((table) => {
      const qb: any = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn().mockImplementation(() => {
          if (table === 'purchases') return Promise.resolve(errorResult)
          return Promise.resolve({ data: [] })
        }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockImplementation(() => {
          if (table === 'purchases') return Promise.resolve(errorResult)
          return Promise.resolve({ data: [] })
        }),
        then: function(resolve: any) {
          if (table === 'purchases') {
            resolve(errorResult)
          } else {
            resolve({ data: [] })
          }
        }
      }
      return qb
    })

    ;(supabase.from as any) = fromMock

    await expect(getDashboardStats('THIS_MONTH')).rejects.toThrow(
      'Failed to load accounting data: Database connection terminated unexpectedly'
    )
  })
})
