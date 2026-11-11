import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonalLedgerView from './PersonalLedgerView';
import * as personalLedgerService from '@/services/personalLedger';
import * as personalLedgerPdf from '@/services/pdf/templates/personalLedgerPdf';

const mockAuthState = {
  user: { id: 'user-001', email: 'test@7time.com' },
  currentWorkspace: { id: 'ws-test', name: '7TIME Primary Enterprise' },
  signOut: vi.fn(),
};

vi.mock('@/components/auth/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

describe('PersonalLedgerView PDF Integrations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(personalLedgerService, 'getPersonalTransactions').mockResolvedValue([
      {
        id: 'tx-101',
        user_id: 'user-001',
        workspace_id: 'ws-test',
        entry_type: 'INCOME',
        amount: 25000,
        transaction_date: '2026-11-01',
        category: 'Services',
        particulars: 'Design Consulting',
        account: 'HDFC Bank',
        notes: null,
      },
      {
        id: 'tx-102',
        user_id: 'user-001',
        workspace_id: 'ws-test',
        entry_type: 'EXPENSE',
        amount: 5000,
        transaction_date: '2026-11-02',
        category: 'Fuel',
        particulars: 'Car Fuel refill',
        account: 'Cash',
        notes: null,
      },
    ]);

    vi.spyOn(personalLedgerService, 'getPersonalQarzEntries').mockResolvedValue([
      {
        id: 'qarz-101',
        user_id: 'user-001',
        workspace_id: 'ws-test',
        person_name: 'Dr. Farooq',
        direction: 'GIVEN',
        original_amount: 10000,
        amount_repaid: 0,
        balance: 10000,
        transaction_date: '2026-11-05',
        account: 'HDFC Bank',
        status: 'OUTSTANDING',
        notes: 'Interest-free support',
        repayments: [],
      },
    ]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PersonalLedgerView />
      </QueryClientProvider>
    );

  it('renders Export Statement (PDF) button in header and opens preview modal on click', async () => {
    renderComponent();

    const statementPdfBtn = await screen.findByRole('button', {
      name: /Export Statement \(PDF\)/i,
    });
    expect(statementPdfBtn).toBeInTheDocument();

    fireEvent.click(statementPdfBtn);

    await waitFor(
      () => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText('Personal Ledger Statement')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  });

  it('renders Receipt (PDF) button for transactions and opens receipt preview modal', async () => {
    const receiptSpy = vi.spyOn(personalLedgerPdf, 'generatePersonalTransactionReceiptPdf');
    renderComponent();

    const receiptButtons = await screen.findAllByTitle('Receipt (PDF)');
    expect(receiptButtons.length).toBeGreaterThan(0);

    fireEvent.click(receiptButtons[0]);

    expect(receiptSpy).toHaveBeenCalled();
    await waitFor(
      () => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText(/RECEIPT/)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  });

  it('renders Voucher (PDF) button for Qarz entries and opens voucher preview modal', async () => {
    renderComponent();

    const voucherButtons = await screen.findAllByTitle('Voucher (PDF)');
    expect(voucherButtons.length).toBeGreaterThan(0);

    fireEvent.click(voucherButtons[0]);

    await waitFor(
      () => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText(/ACKNOWLEDGEMENT/)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  });
});
