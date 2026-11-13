import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResellerDetailPanel from './ResellerDetailPanel';
import * as pdfShare from '@/services/pdf/pdfShare';

const mockAuthenticatedUser = {
  id: 'user-auth-001',
  email: 'business.owner@7time.com',
};

const mockAuthenticatedProfile = {
  id: 'user-auth-001',
  email: 'business.owner@7time.com',
  full_name: '7TIME Business Owner',
  phone: '+1 555 999 8888', // Authenticated user's profile phone (different country/format)
  company_name: '7TIME Enterprise',
  avatar_url: null,
  created_at: '2026-01-01',
  updated_at: '2026-11-10',
};

vi.mock('@/components/auth/useAuth', () => ({
  useAuth: () => ({
    user: mockAuthenticatedUser,
    profile: mockAuthenticatedProfile,
    currentWorkspace: {
      id: 'ws-enterprise',
      name: '7TIME Enterprise',
      workspace_type: 'BUSINESS',
    },
    signOut: vi.fn(),
  }),
}));

// Customer A: ummar bai with 10-digit Indian national number
const mockCustomerUmmar = {
  id: 'cust-ummar-101',
  workspace_id: 'ws-enterprise',
  name: 'ummar bai',
  phone: '7006138763', // 10 digits without international country code
  address: 'Nowhatta, Srinagar',
  notes: 'Key retailer',
  opening_balance: 0,
  contact_type: 'RESELLER',
  created_at: '2026-01-01',
  updated_at: '2026-11-11',
};

// Customer B: Bashir Ahmad with +91 international prefix
const mockCustomerBashir = {
  id: 'cust-bashir-102',
  workspace_id: 'ws-enterprise',
  name: 'Bashir Ahmad',
  phone: '+91 9419111222', // Already formatted with international prefix
  address: 'Lal Chowk, Srinagar',
  notes: 'Wholesale partner',
  opening_balance: 0,
  contact_type: 'RESELLER',
  created_at: '2026-01-01',
  updated_at: '2026-11-11',
};

// Customer C: Zahoor Traders with missing phone
const mockCustomerNoPhone = {
  id: 'cust-zahoor-103',
  workspace_id: 'ws-enterprise',
  name: 'Zahoor Traders',
  phone: null, // Missing phone
  address: 'Batamaloo, Srinagar',
  notes: 'Walk-in customer',
  opening_balance: 0,
  contact_type: 'RESELLER',
  created_at: '2026-01-01',
  updated_at: '2026-11-11',
};

const mockCredits = [
  {
    id: 'credit-001',
    customer_id: 'cust-ummar-101',
    entry_type: 'PRODUCT_CREDIT',
    entry_date: '2026-11-01',
    funding_source: '7TIME_FUNDS',
    account: 'HDFC Current',
    shopkeeper_name: 'Metro Store',
    purchase_location: 'Srinagar',
    description: 'Hardware items',
    quantity: 10,
    rate_per_unit: 500,
    total_amount: 5000,
    amount_paid: 2000,
    balance: 3000,
    status: 'PARTIAL',
    notes: 'Partial payment received',
    allocations: [],
  },
];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'reseller_customers') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, val: string) => ({
              single: vi.fn(() => {
                if (val === 'cust-bashir-102') {
                  return Promise.resolve({ data: mockCustomerBashir, error: null });
                }
                if (val === 'cust-zahoor-103') {
                  return Promise.resolve({ data: mockCustomerNoPhone, error: null });
                }
                return Promise.resolve({ data: mockCustomerUmmar, error: null });
              }),
            })),
          })),
        };
      }
      if (table === 'customer_credits') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockCredits, error: null })),
            })),
          })),
        };
      }
      if (table === 'reseller_payments') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      if (table === 'wholesale_sales') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      };
    }),
  },
}));

describe('Customer Statement Recipient Resolution & WhatsApp Workflow', () => {
  let queryClient: QueryClient;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let downloadSpy: ReturnType<typeof vi.spyOn>;
  let shareSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => ({
      closed: false,
      focus: vi.fn(),
      close: vi.fn(),
    } as unknown as Window));

    downloadSpy = vi.spyOn(pdfShare, 'downloadPdfBlob').mockImplementation(() => {});
    shareSpy = vi.spyOn(pdfShare, 'sharePdfFile').mockResolvedValue({
      status: 'shared',
      method: 'web-share',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  function renderPanel(customerId: string) {
    return render(
      <QueryClientProvider client={queryClient}>
        <ResellerDetailPanel id={customerId} onClose={vi.fn()} />
      </QueryClientProvider>
    );
  }

  it('Requirement 1, 2, 4: Resolves ummar bai customer record, normalizes 10-digit Indian number 7006138763 to +91, and opens WhatsApp', async () => {
    renderPanel('cust-ummar-101');

    // Wait for customer details to load
    await waitFor(() => {
      expect(screen.getByText('ummar bai')).toBeDefined();
    });

    // Click "Statement (PDF)" button in the header
    const exportStatementBtn = screen.getByRole('button', { name: /Statement \(PDF\)/i });
    expect(exportStatementBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(exportStatementBtn);
    });

    // Verify PdfPreviewModal opens with custom title and toolbar button for ummar bai
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open WhatsApp/i })).toBeDefined();
    });

    const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
    expect(whatsAppBtn.title).toBe('Open WhatsApp with ummar bai');

    // Click "Open WhatsApp"
    await act(async () => {
      fireEvent.click(whatsAppBtn);
    });

    // Verify:
    // 1. Opens target customer's normalized WhatsApp number (917006138763)
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/917006138763',
      '_blank',
      'noopener,noreferrer'
    );

    // 2. NEVER opens logged-in user's profile phone (+1 555 999 8888)
    expect(windowOpenSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('15559998888'),
      expect.anything(),
      expect.anything()
    );

    // 3. Forced download is NOT triggered
    expect(downloadSpy).not.toHaveBeenCalled();

    // 4. In-modal notice reflects customer name and masked phone
    const alertBanner = screen.getByRole('alert');
    expect(within(alertBanner).getByText(/Opened WhatsApp conversation for ummar bai/i)).toBeDefined();
    expect(within(alertBanner).getByText(/\+91 ••••• ••763/i)).toBeDefined();
  });

  it('Requirement 2: Resolves Customer B (Bashir Ahmad) with international number without double-prefixing', async () => {
    renderPanel('cust-bashir-102');

    await waitFor(() => {
      expect(screen.getByText('Bashir Ahmad')).toBeDefined();
    });

    const exportStatementBtn = screen.getByRole('button', { name: /Statement \(PDF\)/i });
    await act(async () => {
      fireEvent.click(exportStatementBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open WhatsApp/i })).toBeDefined();
    });

    const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
    expect(whatsAppBtn.title).toBe('Open WhatsApp with Bashir Ahmad');

    await act(async () => {
      fireEvent.click(whatsAppBtn);
    });

    // Opens 919419111222 without double-prefixing (not 91919419111222)
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/919419111222',
      '_blank',
      'noopener,noreferrer'
    );
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("Requirement 6: Surfaces customer-specific error when customer phone is missing and NEVER falls back to user profile phone", async () => {
    renderPanel('cust-zahoor-103');

    await waitFor(() => {
      expect(screen.getByText('Zahoor Traders')).toBeDefined();
    });

    const exportStatementBtn = screen.getByRole('button', { name: /Statement \(PDF\)/i });
    await act(async () => {
      fireEvent.click(exportStatementBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open WhatsApp/i })).toBeDefined();
    });

    const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
    await act(async () => {
      fireEvent.click(whatsAppBtn);
    });

    // WhatsApp must NOT be opened with user profile phone
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();

    // Customer-specific error is displayed
    expect(screen.getByText('Customer Phone Number Required')).toBeDefined();
    expect(
      screen.getByText(/No phone number found for Zahoor Traders\. Please add their phone number in People Directory to open WhatsApp\./i)
    ).toBeDefined();

    // Must NOT show profile link
    expect(screen.queryByRole('link', { name: /Update Profile/i })).toBeNull();
  });

  it('Requirement 7: Native Share PDF continues passing actual generated PDF File object without forced download', async () => {
    renderPanel('cust-ummar-101');

    await waitFor(() => {
      expect(screen.getByText('ummar bai')).toBeDefined();
    });

    const exportStatementBtn = screen.getByRole('button', { name: /Statement \(PDF\)/i });
    await act(async () => {
      fireEvent.click(exportStatementBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share PDF/i })).toBeDefined();
    });

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Verify sharePdfFile called with the generated document containing File object
    expect(shareSpy).toHaveBeenCalledTimes(1);
    const passedDoc = shareSpy.mock.calls[0][0];
    expect(passedDoc.file).toBeInstanceOf(File);
    expect(passedDoc.file.type).toBe('application/pdf');
    expect(passedDoc.file.name.endsWith('.pdf')).toBe(true);

    // No download triggered
    expect(downloadSpy).not.toHaveBeenCalled();
  });
});
