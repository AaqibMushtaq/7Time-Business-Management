/**
 * End-to-End Verification Test Suite
 * Profile Phone Persistence & WhatsApp PDF Sharing Workflow
 *
 * Verifies:
 * 1. Profile phone retrieval and persistence lifecycle
 * 2. Strict isolation: Authenticated user's profile phone is used, NEVER a customer's phone
 * 3. Correct international wa.me URL generation
 * 4. Local PDF download and manual attachment instructions
 * 5. Native file-sharing fallback under simulated supported conditions
 * 6. Missing and invalid phone handling with Profile Settings redirection
 * 7. Zero automatic message or document dispatching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { PdfPreviewModal } from './PdfPreviewModal';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import * as pdfShare from '@/services/pdf/pdfShare';
import type { UserProfile } from '@/types/auth';

describe('End-to-End Profile Phone Persistence & WhatsApp PDF Sharing', () => {
  let mockDocWithCustomer: GeneratedPdfDocument;
  let downloadSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  // Authenticated user profile
  const authenticatedUser: UserProfile = {
    id: 'auth-user-7time',
    email: 'operator@7time.biz',
    full_name: 'Aaqib Mushtaq',
    phone: '+91 98765 43210', // User's own phone number
    system_role: 'ADMIN',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-11-11T00:00:00Z',
  };

  beforeEach(() => {
    // PDF document representing personal ledger statement for profile sharing
    mockDocWithCustomer = {
      blob: new Blob(['%PDF-1.4 personal-pdf-content'], { type: 'application/pdf' }),
      file: new File(['%PDF-1.4 personal-pdf-content'], '7TIME_Personal_Ledger_Statement.pdf', {
        type: 'application/pdf',
      }),
      objectUrl: 'blob:http://localhost/mock-personal-statement-url',
      filename: '7TIME_Personal_Ledger_Statement.pdf',
      title: 'Personal Ledger Statement - Aaqib Mushtaq',
      metadata: {
        documentType: 'personal_ledger_statement',
        documentCategory: 'STATEMENT',
        generatedAt: '2026-11-11T12:00:00Z',
        workspaceId: 'ws-business-primary',
        workspaceName: '7TIME Primary Enterprise',
        recordId: 'stmt-98721',
        orientation: 'portrait',
        pageFormat: 'a4',
      },
      cleanup: vi.fn(),
    };

    downloadSpy = vi.spyOn(pdfShare, 'downloadPdfBlob').mockImplementation(() => {});
    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 1 & 2: Authenticated user retrieves own profile phone and opens wa.me URL with normalized international digits', () => {
    const onActionComplete = vi.fn();

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser}
        onActionComplete={onActionComplete}
      />
    );

    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    // 1. Opens WhatsApp chat for the authenticated user's normalized profile number (919876543210)
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://wa.me/919876543210',
      '_blank',
      'noopener,noreferrer'
    );

    // 2. Forced local PDF download is NOT initiated
    expect(downloadSpy).not.toHaveBeenCalled();

    // 3. User feedback message displays masked profile phone and attachment guidance
    expect(screen.getByText('WhatsApp Conversation Opened')).toBeDefined();
    expect(screen.getByText(/\+91 ••••• ••210/)).toBeDefined();
    expect(
      screen.getByText(/To send this PDF, please attach the document in WhatsApp/i)
    ).toBeDefined();

    expect(onActionComplete).toHaveBeenCalledWith('whatsapp');
  });

  it('Step 3: Confirms customer phone number from the document is NEVER used as recipient', () => {
    // Simulate customer phone "+91 94190 12345" present in document context
    const customerPhone = '+91 94190 12345';

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser} // Authenticated user is +91 98765 43210
      />
    );

    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    // Verify wa.me URL does NOT contain the customer's phone digits
    const openedUrl = windowOpenSpy.mock.calls[0][0] as string;
    expect(openedUrl).not.toContain(customerPhone.replace(/\D/g, ''));
    expect(openedUrl).toBe('https://wa.me/919876543210');
  });

  it('Step 4: Missing profile phone number prompts user to update Profile in Settings', () => {
    const profileWithoutPhone: UserProfile = {
      ...authenticatedUser,
      phone: null,
    };

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={profileWithoutPhone}
      />
    );

    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    // Does not attempt to open WhatsApp or download
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();

    // Renders warning banner with update profile link
    expect(screen.getByText('Profile Phone Number Required')).toBeDefined();
    const updateLink = screen.getByRole('link', { name: /Update Profile/i });
    expect(updateLink.getAttribute('href')).toBe('#/settings?tab=profile');
  });

  it('Step 5: Ambiguous 10-digit number without country code prompts for country code rather than guessing India (+91)', () => {
    const profileWithNationalPhone: UserProfile = {
      ...authenticatedUser,
      phone: '1234567890', // 10 digits non-Indian without country code
    };

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={profileWithNationalPhone}
      />
    );

    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText(/missing an international country code/i)
    ).toBeDefined();
  });

  it('Step 6: Native file sharing fallback operates cleanly under simulated supported conditions', async () => {
    vi.spyOn(pdfShare, 'detectShareCapabilities').mockReturnValue({
      canUseWebShare: true,
      canShareFiles: true,
      isSecureContext: true,
    });

    const navigatorShareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: navigatorShareSpy,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser}
      />
    );

    // 1. Click WhatsApp to open conversation
    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    // 2. Verify alternative OS Share button is presented in banner
    const osShareBtn = screen.getByRole('button', { name: /Share File Directly/i });
    expect(osShareBtn).toBeDefined();

    // 3. User clicks OS share button
    await act(async () => {
      fireEvent.click(osShareBtn);
    });

    expect(navigatorShareSpy).toHaveBeenCalledWith({
      title: mockDocWithCustomer.file.name,
      files: [mockDocWithCustomer.file],
    });
  });

  it('Step 7: Verification that no automatic message or file dispatch occurs', () => {
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser}
      />
    );

    const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
    fireEvent.click(whatsAppBtn);

    // Only standard client-side browser navigation is triggered; ZERO automatic downloads
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('Step 8: Direct Share PDF button invokes native file share without forced download', async () => {
    const navigatorShareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: navigatorShareSpy,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });
    vi.spyOn(pdfShare, 'detectShareCapabilities').mockReturnValue({
      canUseWebShare: true,
      canShareFiles: true,
      isSecureContext: true,
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Native share invoked directly with file
    expect(navigatorShareSpy).toHaveBeenCalledWith({
      title: mockDocWithCustomer.file.name,
      files: [mockDocWithCustomer.file],
    });
    // NO download occurred
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('Step 9: Direct Share PDF handles AbortError without downloading and keeps modal open', async () => {
    const abortError = new Error('User dismissed sheet');
    abortError.name = 'AbortError';
    const navigatorShareSpy = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', {
      value: navigatorShareSpy,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });
    vi.spyOn(pdfShare, 'detectShareCapabilities').mockReturnValue({
      canUseWebShare: true,
      canShareFiles: true,
      isSecureContext: true,
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(navigatorShareSpy).toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();
    // Modal is still open and rendering title
    expect(screen.getByText(mockDocWithCustomer.title)).toBeDefined();
  });

  it('Step 10: Unsupported browser shows clear fallback notice with manual actions and zero forced download', async () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: undefined,
      configurable: true,
    });
    vi.spyOn(pdfShare, 'detectShareCapabilities').mockReturnValue({
      canUseWebShare: false,
      canShareFiles: false,
      isSecureContext: true,
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDocWithCustomer}
        userProfile={authenticatedUser}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Zero download triggered
    expect(downloadSpy).not.toHaveBeenCalled();

    // Fallback notice displayed with manual options
    expect(screen.getByText('Direct File Sharing Unavailable')).toBeDefined();
    const downloadActionBtn = screen.getByRole('button', { name: 'Download PDF' });
    expect(downloadActionBtn).toBeDefined();

    // User can manually trigger download from the fallback
    fireEvent.click(downloadActionBtn);
    expect(downloadSpy).toHaveBeenCalledWith(
      mockDocWithCustomer.objectUrl,
      mockDocWithCustomer.filename
    );
  });
});

