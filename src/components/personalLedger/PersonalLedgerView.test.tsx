import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonalLedgerView from './PersonalLedgerView';
import * as personalLedgerService from '@/services/personalLedger';
import * as resellersService from '@/services/resellers';

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

describe('PersonalLedgerView Core Component', () => {
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

    vi.spyOn(resellersService, 'getResellersWithBalances').mockResolvedValue([
      {
        id: 'res-101',
        name: 'Dr. Farooq',
        phone: '+91 9419123456',
        workspace_id: 'ws-test',
        contact_type: 'PERSONAL',
        created_at: '2026-10-01',
      } as any,
    ]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PersonalLedgerView />
      </QueryClientProvider>
    );

  it('renders Personal Ledger page header, summary cards, and unified transactions', async () => {
    renderComponent();

    // Page title and workspace badge
    expect(await screen.findByRole('heading', { name: /Personal Ledger/i })).toBeInTheDocument();
    expect(screen.getByText('PERSONAL')).toBeInTheDocument();

    // Financial summary cards
    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('Total Expense')).toBeInTheDocument();
    expect(screen.getByText('Net Balance')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Qarz-e-Hasana/i })).toBeInTheDocument();

    // Unified entries table rows
    expect(await screen.findByText('Design Consulting')).toBeInTheDocument();
    expect(screen.getByText('Car Fuel refill')).toBeInTheDocument();
    expect(screen.getByText(/Qarz given to Dr\. Farooq/i)).toBeInTheDocument();
  });

  it('filters unified entries feed when clicking tab filters', async () => {
    renderComponent();

    expect(await screen.findByText('Design Consulting')).toBeInTheDocument();

    // Filter to Income tab
    const incomeTab = screen.getByRole('button', { name: /^Income/i });
    fireEvent.click(incomeTab);

    expect(screen.getByText('Design Consulting')).toBeInTheDocument();
    expect(screen.queryByText('Car Fuel refill')).toBeNull();
    expect(screen.queryByText(/Qarz given to Dr\. Farooq/i)).toBeNull();

    // Filter to Expense tab
    const expenseTab = screen.getByRole('button', { name: /^Expense/i });
    fireEvent.click(expenseTab);

    expect(screen.queryByText('Design Consulting')).toBeNull();
    expect(screen.getByText('Car Fuel refill')).toBeInTheDocument();
    expect(screen.queryByText(/Qarz given to Dr\. Farooq/i)).toBeNull();

    // Filter to Qarz tab
    const qarzTab = screen.getByRole('button', { name: /^Qarz-e-Hasana/i });
    fireEvent.click(qarzTab);

    expect(screen.queryByText('Design Consulting')).toBeNull();
    expect(screen.queryByText('Car Fuel refill')).toBeNull();
    expect(screen.getByText(/Qarz given to Dr\. Farooq/i)).toBeInTheDocument();
  });

  it('filters transactions when typing in search input', async () => {
    renderComponent();

    expect(await screen.findByText('Design Consulting')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search entries...');
    fireEvent.change(searchInput, { target: { value: 'fuel' } });

    expect(screen.queryByText('Design Consulting')).toBeNull();
    expect(screen.getByText('Car Fuel refill')).toBeInTheDocument();
    expect(screen.queryByText(/Qarz given to Dr\. Farooq/i)).toBeNull();
  });

  it('renders row action buttons for Qarz entries and opens Qarz detail modal with phone resolution', async () => {
    renderComponent();

    const farooqText = await screen.findByText(/Qarz given to Dr\. Farooq/i);
    const row = farooqText.closest('tr')!;

    // Find "View Qarz Details" action
    const detailBtn = within(row).getByTitle('View Qarz Details');
    expect(detailBtn).toBeInTheDocument();

    fireEvent.click(detailBtn);

    // Detail modal opens and displays creditor name and resolved phone number
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Dr. Farooq' })).toBeInTheDocument();
      expect(screen.getByText('+91 9419123456')).toBeInTheDocument();
    });
  });
});
