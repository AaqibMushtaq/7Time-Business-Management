import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboardStats } from './dashboard'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

describe('Dashboard Stats Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
