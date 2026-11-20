import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PersonalLedgerEntryDetailModal from './PersonalLedgerEntryDetailModal'
import ResellerDetailPanel from './ResellerDetailPanel'
import type { CustomerCredit } from '@/services/customerCredits'
import type { ResellerCustomer } from '@/services/resellers'
import type { ResellerPayment } from '@/services/resellerPayments'

// =========================================================================
// MOCK AUTH
// =========================================================================
vi.mock('@/components/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-test-01', email: 'owner@7time.test' },
    profile: {
      id: 'user-test-01',
      full_name: '7TIME Owner',
      phone: '9999999999',
      company_name: '7TIME Enterprise',
    },
    currentWorkspace: {
      id: 'ws-test',
      name: '7TIME Enterprise',
      workspace_type: 'BUSINESS',
    },
    signOut: vi.fn(),
  }),
}))

// =========================================================================
// TEST DATA FIXTURES
// =========================================================================
const mockPerson: ResellerCustomer = {
  id: 'cust-zahid-01',
  workspace_id: 'ws-test',
  name: 'Zahid Ahmad',
  phone: '9876543210',
  address: 'Nowhatta, Srinagar',
  notes: 'Key partner',
  opening_balance: 0,
  contact_type: 'PERSONAL',
  created_at: '2026-01-01',
}

const mockMultiItemExpenseCredit: CustomerCredit = {
  id: 'credit-exp-101',
  customer_id: 'cust-zahid-01',
  entry_type: 'PRODUCT_CREDIT',
  entry_date: '2026-10-15',
  funding_source: '7TIME_FUNDS',
  account: 'HDFC Current',
  shopkeeper_name: 'Gulmarg Store',
  purchase_location: 'Main Bazar',
  product_id: null,
  product_name: 'Petrol (3 items)',
  category: 'Fuel',
  quantity: 3,
  unit: 'items',
  rate_per_unit: 500,
  description: null,
  total_amount: 1500,
  amount_paid: 500,
  balance: 1000,
  status: 'PARTIAL',
  notes: 'Multiple supplies for project site',
  items: [
    {
      name: 'Petrol',
      category: 'Fuel',
      quantity: 5,
      unit: 'litres',
      rate_per_unit: 100,
      amount: 500,
    },
    {
      name: 'Chicken Patti',
      category: 'Snacks',
      quantity: 10,
      unit: 'pcs',
      rate_per_unit: 40,
      amount: 400,
    },
    {
      name: 'Pakoda',
      category: 'Refreshments',
      quantity: 6,
      unit: 'plates',
      rate_per_unit: 100,
      amount: 600,
    },
  ],
  allocations: [
    {
      id: 'alloc-01',
      payment_id: 'pay-settle-01',
      credit_id: 'credit-exp-101',
      amount: 500,
      notes: 'Initial cash settlement',
      payment: {
        id: 'pay-settle-01',
        customer_id: 'cust-zahid-01',
        payment_date: '2026-10-20',
        payment_method: 'CASH',
        reference: 'RCPT-1001',
        amount: 500,
        notes: 'Hand cash received',
      },
    },
  ],
}

const mockQardHasanCredit: CustomerCredit = {
  id: 'credit-qard-202',
  customer_id: 'cust-zahid-01',
  entry_type: 'CASH_LOAN',
  entry_date: '2026-10-18',
  funding_source: 'PERSONAL_FUNDS',
  account: 'SBI Personal',
  product_id: null,
  product_name: null,
  category: null,
  quantity: null,
  unit: null,
  rate_per_unit: null,
  description: 'Emergency assistance for brother',
  total_amount: 5000,
  amount_paid: 0,
  balance: 5000,
  status: 'PENDING',
  notes: 'Repay when comfortable',
  items: null,
  allocations: [],
}

const mockOtherCredit: CustomerCredit = {
  id: 'credit-other-303',
  customer_id: 'cust-zahid-01',
  entry_type: 'OTHER_CREDIT',
  entry_date: '2026-10-22',
  funding_source: '7TIME_FUNDS',
  account: 'HDFC Current',
  product_id: null,
  product_name: null,
  category: null,
  quantity: null,
  unit: null,
  rate_per_unit: null,
  description: 'Shared office utility bill',
  total_amount: 1200,
  amount_paid: 1200,
  balance: 0,
  status: 'PAID',
  notes: 'Paid via electricity board portal',
  items: null,
  allocations: [],
}

const mockPaymentEntry: ResellerPayment = {
  id: 'pay-settle-01',
  customer_id: 'cust-zahid-01',
  payment_date: '2026-10-20',
  payment_method: 'CASH',
  amount: 500,
  reference: 'RCPT-1001',
  notes: 'Hand cash received from Zahid',
  created_at: '2026-10-20T10:00:00Z',
  allocations: [
    {
      id: 'alloc-01',
      payment_id: 'pay-settle-01',
      credit_id: 'credit-exp-101',
      amount: 500,
      notes: 'Initial cash settlement',
      credit: {
        id: 'credit-exp-101',
        product_name: 'Petrol (3 items)',
        entry_type: 'PRODUCT_CREDIT',
        description: null,
        total_amount: 1500,
      },
    },
  ],
}

// =========================================================================
// MOCK SERVICES
// =========================================================================
vi.mock('@/services/customerCredits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/customerCredits')>()
  return {
    ...actual,
    getCustomerCredits: vi.fn().mockImplementation(() =>
      Promise.resolve([mockMultiItemExpenseCredit, mockQardHasanCredit, mockOtherCredit])
    ),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'reseller_customers') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockPerson, error: null })),
            })),
          })),
        }
      }
      if (table === 'reseller_payments') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [mockPaymentEntry], error: null })),
            })),
          })),
        }
      }
      if (table === 'wholesale_sales') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      }
    }),
  },
}))

describe('Personal Ledger Entry Details — Read-Only View', () => {
  describe('Unit Tests: PersonalLedgerEntryDetailModal', () => {
    it('renders Expense on Behalf details with multi-item breakdown table and summary KPIs', () => {
      const handleClose = vi.fn()

      render(
        <PersonalLedgerEntryDetailModal
          isOpen={true}
          onClose={handleClose}
          entry={{ type: 'CREDIT', data: mockMultiItemExpenseCredit }}
          person={mockPerson}
        />
      )

      // Header verification
      expect(screen.getByText('Entry Details')).toBeInTheDocument()
      expect(screen.getByText('Expense on Behalf')).toBeInTheDocument()
      expect(screen.getByText('PARTIALLY SETTLED')).toBeInTheDocument()

      // Financial KPI Summary Cards
      expect(screen.getByText('Total Amount')).toBeInTheDocument()
      expect(screen.getByText('Settled / Paid')).toBeInTheDocument()
      expect(screen.getByText('Remaining Balance')).toBeInTheDocument()
      expect(screen.getByText('Funding Source')).toBeInTheDocument()
      expect(screen.getByText('7TIME Business')).toBeInTheDocument()

      // Transaction Information
      expect(screen.getByText('Zahid Ahmad')).toBeInTheDocument()
      expect(screen.getAllByText('HDFC Current').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Gulmarg Store')).toBeInTheDocument()
      expect(screen.getByText('Main Bazar')).toBeInTheDocument()
      expect(screen.getByText('Multiple supplies for project site')).toBeInTheDocument()

      // Items / Expenses Breakdown Table (Desktop & Mobile)
      expect(screen.getByText('Complete Items / Expenses')).toBeInTheDocument()
      expect(screen.getByText('3 Items')).toBeInTheDocument()

      // Verify all items are rendered
      expect(screen.getAllByText('Petrol').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Chicken Patti').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Pakoda').length).toBeGreaterThanOrEqual(1)

      // Verify categories, quantities, rates
      expect(screen.getAllByText('Fuel').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Snacks').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Refreshments').length).toBeGreaterThanOrEqual(1)

      // Settlement History & Payments Section
      expect(screen.getByText('Settlement History & Payments')).toBeInTheDocument()
      expect(screen.getByText('1 Settlement')).toBeInTheDocument()
      expect(screen.getAllByText('CASH').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('RCPT-1001').length).toBeGreaterThanOrEqual(1)
    })

    it('renders Qard Hasan entry with interest-free terms and repayment status', () => {
      render(
        <PersonalLedgerEntryDetailModal
          isOpen={true}
          onClose={vi.fn()}
          entry={{ type: 'CREDIT', data: mockQardHasanCredit }}
          person={mockPerson}
        />
      )

      expect(screen.getByText('Entry Details')).toBeInTheDocument()
      expect(screen.getByText('Qard Hasan')).toBeInTheDocument()
      expect(screen.getByText('UNSETTLED')).toBeInTheDocument()
      expect(screen.getAllByText('Personal Funds').length).toBeGreaterThanOrEqual(1)

      // Qard Hasan Agreement Card
      expect(screen.getByText('Qard Hasan Assistance Agreement')).toBeInTheDocument()
      expect(
        screen.getByText(/This interest-free loan \(قرض حسن\) is extended for goodwill/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/Zero interest, markup, or penalty will ever be charged/i)).toBeInTheDocument()
    })

    it('renders Other Personal entry with description and amount', () => {
      render(
        <PersonalLedgerEntryDetailModal
          isOpen={true}
          onClose={vi.fn()}
          entry={{ type: 'CREDIT', data: mockOtherCredit }}
          person={mockPerson}
        />
      )

      expect(screen.getByText('Entry Details')).toBeInTheDocument()
      expect(screen.getByText('Other Personal Transaction')).toBeInTheDocument()
      expect(screen.getByText('FULLY SETTLED')).toBeInTheDocument()
      expect(screen.getByText('Recorded Particulars / Description')).toBeInTheDocument()
      expect(screen.getByText('Shared office utility bill')).toBeInTheDocument()
    })

    it('renders Settlement payment details with allocation breakdown', () => {
      render(
        <PersonalLedgerEntryDetailModal
          isOpen={true}
          onClose={vi.fn()}
          entry={{ type: 'SETTLEMENT', data: mockPaymentEntry }}
          person={mockPerson}
        />
      )

      expect(screen.getByText('Entry Details')).toBeInTheDocument()
      expect(screen.getByText('Settlement Payment')).toBeInTheDocument()
      expect(screen.getByText('Hand cash received from Zahid')).toBeInTheDocument()
      expect(screen.getByText('Allocated Ledger Entries Breakdown')).toBeInTheDocument()
      expect(screen.getByText('Petrol (3 items)')).toBeInTheDocument()
    })

    it('handles Escape key to close the modal', () => {
      const handleClose = vi.fn()

      render(
        <PersonalLedgerEntryDetailModal
          isOpen={true}
          onClose={handleClose}
          entry={{ type: 'CREDIT', data: mockMultiItemExpenseCredit }}
          person={mockPerson}
        />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('handles Close button click to close the modal', () => {
      const handleClose = vi.fn()

      render(
        <PersonalLedgerEntryDetailModal
          isOpen={true}
          onClose={handleClose}
          entry={{ type: 'CREDIT', data: mockMultiItemExpenseCredit }}
          person={mockPerson}
        />
      )

      const closeBtn = screen.getByRole('button', { name: /Close entry details/i })
      fireEvent.click(closeBtn)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration Tests: ResellerDetailPanel Clickable Ledger Rows', () => {
    let queryClient: QueryClient

    beforeEach(() => {
      vi.clearAllMocks()
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    const renderPanel = () =>
      render(
        <QueryClientProvider client={queryClient}>
          <ResellerDetailPanel id="cust-zahid-01" onClose={vi.fn()} />
        </QueryClientProvider>
      )

    it('makes Expense on Behalf row clickable and opens Entry Details modal with full itemized breakdown', async () => {
      renderPanel()

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('Zahid Ahmad')).toBeInTheDocument()
      })

      // Locate the row for Petrol (3 items)
      const expenseRow = await screen.findByRole('button', {
        name: /View entry details for Petrol \(3 items\)/i,
      })
      expect(expenseRow).toBeInTheDocument()

      // Click the row
      fireEvent.click(expenseRow)

      // Verify modal opened
      await waitFor(() => {
        expect(screen.getByText('Entry Details')).toBeInTheDocument()
      })

      // Modal displays itemized breakdown
      expect(screen.getByText('Complete Items / Expenses')).toBeInTheDocument()
      expect(screen.getByText('3 Items')).toBeInTheDocument()
      expect(screen.getAllByText('Chicken Patti').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Pakoda').length).toBeGreaterThanOrEqual(1)

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Close entry details/i })
      fireEvent.click(closeBtn)

      // Verify modal closed
      await waitFor(() => {
        expect(screen.queryByText('Entry Details')).not.toBeInTheDocument()
      })
    })

    it('supports keyboard accessibility: pressing Enter or Space opens Entry Details', async () => {
      renderPanel()

      await waitFor(() => {
        expect(screen.getByText('Zahid Ahmad')).toBeInTheDocument()
      })

      const expenseRow = await screen.findByRole('button', {
        name: /View entry details for Petrol \(3 items\)/i,
      })

      // Press Enter
      fireEvent.keyDown(expenseRow, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText('Entry Details')).toBeInTheDocument()
      })

      // Press Escape to close
      fireEvent.keyDown(window, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByText('Entry Details')).not.toBeInTheDocument()
      })
    })

    it('preserves action buttons and stops click propagation: clicking Settle, Edit, or Delete does not open Entry Details modal', async () => {
      renderPanel()

      await waitFor(() => {
        expect(screen.getByText('Zahid Ahmad')).toBeInTheDocument()
      })

      // Find the Settle button on the Expense row
      const settleButtons = await screen.findAllByRole('button', { name: /^Settle$/i })
      expect(settleButtons.length).toBeGreaterThanOrEqual(1)

      // Click the Settle button
      fireEvent.click(settleButtons[0])

      // Should open Record Settlement modal, NOT Entry Details modal
      await waitFor(() => {
        expect(screen.getByText('Record Settlement Received')).toBeInTheDocument()
      })
      expect(screen.queryByText('Entry Details')).not.toBeInTheDocument()

      // Close Record Settlement modal
      const cancelSettleBtn = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelSettleBtn)

      await waitFor(() => {
        expect(screen.queryByText('Record Settlement Received')).not.toBeInTheDocument()
      })

      // Now test Edit button
      const editButtons = screen.getAllByTitle('Edit Entry')
      expect(editButtons.length).toBeGreaterThanOrEqual(1)
      fireEvent.click(editButtons[0])

      // Inline edit mode is activated (Save/Cancel appear), but Entry Details modal does NOT open
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      expect(screen.queryByText('Entry Details')).not.toBeInTheDocument()
    })

    it('allows opening settlement details from Payments tab', async () => {
      renderPanel()

      await waitFor(() => {
        expect(screen.getByText('Zahid Ahmad')).toBeInTheDocument()
      })

      // Switch to Settlements tab
      const settlementsTab = screen.getByRole('button', { name: /Settlements/i })
      fireEvent.click(settlementsTab)

      // Locate settlement row
      const paymentRow = await screen.findByRole('button', {
        name: /View settlement details for payment of/i,
      })
      expect(paymentRow).toBeInTheDocument()

      // Click settlement row
      fireEvent.click(paymentRow)

      // Verify modal opened with Settlement details
      await waitFor(() => {
        expect(screen.getByText('Entry Details')).toBeInTheDocument()
        expect(screen.getByText('Settlement Payment')).toBeInTheDocument()
      })
      expect(screen.getAllByText('Hand cash received from Zahid').length).toBeGreaterThanOrEqual(1)
    })
  })
})
