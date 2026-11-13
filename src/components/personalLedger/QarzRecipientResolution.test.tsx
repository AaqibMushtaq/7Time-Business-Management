import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonalLedgerView from './PersonalLedgerView';
import * as personalLedgerService from '@/services/personalLedger';
import * as localCustomersService from '@/services/localCustomers';
import * as resellersService from '@/services/resellers';
import * as pdfShare from '@/services/pdf/pdfShare';

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

describe('Qarz-e-Hasana Recipient Resolution & WhatsApp Workflow', () => {
  let queryClient: QueryClient;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let downloadSpy: ReturnType<typeof vi.spyOn>;
  let shareSpy: ReturnType<typeof vi.spyOn>;

  // Creditors in People Directory
  const mockPeopleInDirectory: localCustomersService.LocalCustomer[] = [
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
    vi.spyOn(localCustomersService, 'getLocalCustomers').mockResolvedValue(mockPeopleInDirectory);
    vi.spyOn(resellersService, 'getResellersWithBalances').mockResolvedValue(mockPeopleInDirectory);

    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
    downloadSpy = vi.spyOn(pdfShare, 'downloadPdfBlob').mockImplementation(() => {});
    shareSpy = vi.spyOn(pdfShare, 'sharePdfFile').mockResolvedValue({
      status: 'shared',
      method: 'web-share',
    });
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

  it("Requirement 1 & 2: Resolves Creditor A's record to Creditor A's phone number (+91 9419123456) and opens WhatsApp", async () => {
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
      expect(screen.getByText('+91 9419123456')).toBeInTheDocument();
    });

    // Click Voucher PDF button in QarzDetailModal
    const voucherBtn = screen.getByRole('button', { name: /Voucher PDF/i });
    fireEvent.click(voucherBtn);

    // PdfPreviewModal opens with Dr. Farooq's acknowledgment
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open WhatsApp/i })).toBeInTheDocument();
      expect(screen.getByText(/ACKNOWLEDGEMENT/)).toBeInTheDocument();
    });

    // Check Open WhatsApp button title targets Dr. Farooq
    const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
    expect(whatsAppBtn.title).toBe('Open WhatsApp with Dr. Farooq');

    // Click Open WhatsApp
    fireEvent.click(whatsAppBtn);

    // Verify WhatsApp opens Dr. Farooq's normalized phone number (919419123456)
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/919419123456',
      '_blank',
      'noopener,noreferrer'
    );

    // NEVER uses authenticated user's profile phone (+1 555 999 8888)
    const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
    expect(openedUrl).not.toContain('15559998888');

    // Verify banner confirms Dr. Farooq's conversation was opened
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('WhatsApp Conversation Opened')).toBeInTheDocument();
    expect(within(alert).getByText(/Dr\. Farooq/)).toBeInTheDocument();
    expect(within(alert).getByText(/\+91 ••••• ••456/)).toBeInTheDocument();

    // Forced download is NOT triggered
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("Requirement 1 & 2: Resolves Creditor B's record to Creditor B's phone number (+91 9876500000) and opens WhatsApp", async () => {
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
      expect(screen.getByText('+91 9876500000')).toBeInTheDocument();
    });

    // Generate Voucher PDF
    const voucherBtn = screen.getByRole('button', { name: /Voucher PDF/i });
    fireEvent.click(voucherBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open WhatsApp/i })).toBeInTheDocument();
    });

    const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
    expect(whatsAppBtn.title).toBe('Open WhatsApp with Bilal Ahmad');

    fireEvent.click(whatsAppBtn);

    // Verify WhatsApp opens Bilal Ahmad's number
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/919876500000',
      '_blank',
      'noopener,noreferrer'
    );

    // Verify logged-in user's phone is NOT used
    const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
    expect(openedUrl).not.toContain('15559998888');

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Bilal Ahmad/)).toBeInTheDocument();
    expect(within(alert).getByText(/\+91 ••••• ••000/)).toBeInTheDocument();
    expect(downloadSpy).not.toHaveBeenCalled();
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
    });

    // Generate Voucher PDF
    const voucherBtn = screen.getByRole('button', { name: /Voucher PDF/i });
    fireEvent.click(voucherBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open WhatsApp/i })).toBeInTheDocument();
    });

    const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    // STRICT REQUIREMENT: window.open is NEVER called!
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();

    // Clear error displayed requiring creditor's phone in People Directory
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Creditor Phone Number Required')).toBeInTheDocument();
    expect(
      within(alert).getByText(
        /No phone number found for Ghulam Hassan\. Please add their phone number in People Directory to open WhatsApp\./i
      )
    ).toBeInTheDocument();

    // Profile update link must NOT be displayed
    expect(within(alert).queryByRole('link', { name: /Update Profile/i })).toBeNull();
  });

  it('Requirement 4 & 6: Distinguishes Share PDF (native file share sheet) from Open WhatsApp without forced download', async () => {
    renderComponent();

    const farooqText = await screen.findByText(/Dr\. Farooq/i);
    const row = farooqText.closest('tr')!;

    const viewDetailBtn = within(row).getByTitle('View Qarz Details');
    fireEvent.click(viewDetailBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voucher PDF/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Voucher PDF/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share PDF/i })).toBeInTheDocument();
    });

    // 1. Share PDF button attaches actual generated PDF File
    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const sharedDoc = shareSpy.mock.calls[0][0];
    expect(sharedDoc.file).toBeInstanceOf(File);
    expect(sharedDoc.file.type).toBe('application/pdf');
    expect(sharedDoc.file.name).toMatch(/\.pdf$/i);
    expect(sharedDoc.file.size).toBeGreaterThan(0);

    // No forced download before or during share
    expect(downloadSpy).not.toHaveBeenCalled();
  });
});
