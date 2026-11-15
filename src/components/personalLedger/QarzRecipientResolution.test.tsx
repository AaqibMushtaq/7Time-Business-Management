import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonalLedgerView from './PersonalLedgerView';
import * as personalLedgerService from '@/services/personalLedger';
import * as resellersService from '@/services/resellers';

const mockAuthenticatedUser = {
  id: 'user-auth-001',
  email: 'personal.user@7time.com',
};

const mockAuthenticatedProfile = {
  id: 'user-auth-001',
  email: 'personal.user@7time.com',
  full_name: 'Logged In Business Owner',
  company_name: '7TIME Technologies',
  phone: '+1 555 999 8888', // Authenticated user's own phone (US format)
  avatar_url: null,
  created_at: '2026-01-01',
  updated_at: '2026-11-10',
};

vi.mock('@/components/auth/useAuth', () => ({
  useAuth: () => ({
    user: mockAuthenticatedUser,
    profile: mockAuthenticatedProfile,
    currentWorkspace: {
      id: 'ws-personal-1',
      name: 'Personal Workspace',
      workspace_type: 'PERSONAL',
    },
    signOut: vi.fn(),
  }),
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

describe('Qarz-e-Hasana Recipient Resolution & Contact Verification', () => {
  let queryClient: QueryClient;

  // Creditors in People Directory
  const mockPeopleInDirectory = [
    {
      id: 'person-001',
      name: 'Dr. Farooq',
      phone: '+91 9419123456',
      address: 'Srinagar, J&K',
      contact_type: 'PERSONAL',
      workspace_id: 'ws-personal-1',
      created_at: '2026-10-01',
    },
    {
      id: 'person-002',
      name: 'Bilal Ahmad',
      phone: '+91 9876500000',
      address: 'Anantnag, J&K',
      contact_type: 'PERSONAL',
      workspace_id: 'ws-personal-1',
      created_at: '2026-10-05',
    },
    {
      id: 'person-003',
      name: 'Ghulam Hassan',
      phone: null, // Missing phone number
      address: 'Baramulla, J&K',
      contact_type: 'PERSONAL',
      workspace_id: 'ws-personal-1',
      created_at: '2026-10-10',
    },
  ];

  // Qarz entries linking to those creditors
  const mockQarzEntries: personalLedgerService.PersonalQarzEntry[] = [
    {
      id: 'qarz-farooq-101',
      user_id: 'user-auth-001',
      workspace_id: 'ws-personal-1',
      person_name: 'Dr. Farooq',
      direction: 'GIVEN',
      original_amount: 50000,
      amount_repaid: 20000,
      balance: 30000,
      transaction_date: '2026-10-15',
      account: 'HDFC Bank',
      status: 'PARTIALLY_REPAID',
      notes: 'Medical support benevolent loan',
      repayments: [],
    },
    {
      id: 'qarz-bilal-102',
      user_id: 'user-auth-001',
      workspace_id: 'ws-personal-1',
      person_name: 'Bilal Ahmad',
      direction: 'RECEIVED',
      original_amount: 25000,
      amount_repaid: 0,
      balance: 25000,
      transaction_date: '2026-10-20',
      account: 'Cash',
      status: 'OUTSTANDING',
      notes: 'Personal loan received',
      repayments: [],
    },
    {
      id: 'qarz-ghulam-103',
      user_id: 'user-auth-001',
      workspace_id: 'ws-personal-1',
      person_name: 'Ghulam Hassan',
      direction: 'GIVEN',
      original_amount: 15000,
      amount_repaid: 0,
      balance: 15000,
      transaction_date: '2026-10-25',
      account: 'Cash',
      status: 'OUTSTANDING',
      notes: 'Benevolent assistance without phone',
      repayments: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(personalLedgerService, 'getPersonalTransactions').mockResolvedValue([]);
    vi.spyOn(personalLedgerService, 'getPersonalQarzEntries').mockResolvedValue(mockQarzEntries);
    vi.spyOn(resellersService, 'getResellersWithBalances').mockResolvedValue(mockPeopleInDirectory as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PersonalLedgerView />
      </QueryClientProvider>
    );

  it("Requirement 1 & 2: Resolves Creditor A's record to Creditor A's phone number (+91 9419123456) in QarzDetailModal", async () => {
    renderComponent();

    // Find Dr. Farooq's row by particulars
    const farooqText = await screen.findByText(/Dr\. Farooq/i);
    expect(farooqText).toBeInTheDocument();
    const row = farooqText.closest('tr')!;

    // Click "View Qarz Details" in Dr. Farooq's row
    const viewDetailBtn = within(row).getByTitle('View Qarz Details');
    fireEvent.click(viewDetailBtn);

    // QarzDetailModal opens and displays Dr. Farooq's saved phone number
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Dr. Farooq' })).toBeInTheDocument();
      expect(screen.getByText('+91 9419123456')).toBeInTheDocument();
    });

    // Ensure logged-in user's profile phone is NOT rendered
    expect(screen.queryByText('+1 555 999 8888')).toBeNull();
  });

  it("Requirement 1 & 2: Resolves Creditor B's record to Creditor B's phone number (+91 9876500000) in QarzDetailModal", async () => {
    renderComponent();

    // Find Bilal Ahmad's row
    const bilalText = await screen.findByText(/Bilal Ahmad/i);
    expect(bilalText).toBeInTheDocument();
    const row = bilalText.closest('tr')!;

    // Click "View Qarz Details" in Bilal Ahmad's row
    const viewDetailBtn = within(row).getByTitle('View Qarz Details');
    fireEvent.click(viewDetailBtn);

    // QarzDetailModal displays Bilal Ahmad's phone number
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Bilal Ahmad' })).toBeInTheDocument();
      expect(screen.getByText('+91 9876500000')).toBeInTheDocument();
    });

    // Ensure logged-in user's phone is NOT rendered
    expect(screen.queryByText('+1 555 999 8888')).toBeNull();
  });

  it('Requirement 3 & 7: NEVER uses authenticated user profile number as fallback when creditor phone is missing', async () => {
    renderComponent();

    // Click on Ghulam Hassan's row (phone is null in People Directory)
    const ghulamText = await screen.findByText(/Ghulam Hassan/i);
    expect(ghulamText).toBeInTheDocument();
    const row = ghulamText.closest('tr')!;

    const viewDetailBtn = within(row).getByTitle('View Qarz Details');
    fireEvent.click(viewDetailBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Ghulam Hassan' })).toBeInTheDocument();
    });

    // STRICT REQUIREMENT: User profile phone is NEVER used as fallback
    expect(screen.queryByText('+1 555 999 8888')).toBeNull();
  });
});
