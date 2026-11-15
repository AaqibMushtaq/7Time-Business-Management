import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResellerDetailPanel from './ResellerDetailPanel';

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

// Customer A: ummar bai with 10-digit national number
const mockCustomerUmmar = {
  id: 'cust-ummar-101',
  workspace_id: 'ws-enterprise',
  name: 'ummar bai',
  phone: '7006138763',
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
  phone: '+91 9419111222',
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
  phone: null,
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

describe('Customer Recipient Resolution & Quick Contact Workflow', () => {
  let queryClient: QueryClient;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPanel = (customerId: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ResellerDetailPanel id={customerId} onClose={vi.fn()} />
      </QueryClientProvider>
    );

  it('Requirement 1 & 4: Resolves ummar bai customer record, displays contact buttons, and opens WhatsApp on click', async () => {
    renderPanel('cust-ummar-101');

    await waitFor(() => {
      expect(screen.getByText('ummar bai')).toBeInTheDocument();
    });

    // 1. WhatsApp Button: title contains customer phone
    const whatsAppBtn = screen.getByTitle('WhatsApp 7006138763');
    expect(whatsAppBtn).toBeInTheDocument();
    expect(whatsAppBtn).not.toBeDisabled();

    fireEvent.click(whatsAppBtn);

    // Verifies window.open targets customer's wa.me URL
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/7006138763',
      '_blank'
    );

    // Verify logged-in user profile phone is NEVER used
    expect(windowOpenSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('15559998888'),
      expect.anything()
    );

    // 2. Call Button: title contains customer phone
    const callBtn = screen.getByTitle('Call 7006138763');
    expect(callBtn).toBeInTheDocument();
    expect(callBtn).not.toBeDisabled();

    fireEvent.click(callBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith('tel:7006138763');
  });

  it('Requirement 2: Resolves Customer B (Bashir Ahmad) with international phone number', async () => {
    renderPanel('cust-bashir-102');

    await waitFor(() => {
      expect(screen.getByText('Bashir Ahmad')).toBeInTheDocument();
    });

    const whatsAppBtn = screen.getByTitle('WhatsApp +91 9419111222');
    expect(whatsAppBtn).toBeInTheDocument();
    expect(whatsAppBtn).not.toBeDisabled();

    fireEvent.click(whatsAppBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/+919419111222',
      '_blank'
    );
  });

  it('Requirement 6: Disables WhatsApp and Call actions when customer phone is missing and NEVER falls back to user profile phone', async () => {
    renderPanel('cust-zahoor-103');

    await waitFor(() => {
      expect(screen.getByText('Zahoor Traders')).toBeInTheDocument();
    });

    const noPhoneButtons = screen.getAllByTitle('No phone available');
    expect(noPhoneButtons.length).toBe(2);

    noPhoneButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
    });

    // window.open must NEVER be called
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });
});
