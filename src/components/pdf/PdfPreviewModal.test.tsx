import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import React from 'react';
import { PdfPreviewModal } from './PdfPreviewModal';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import * as pdfShare from '@/services/pdf/pdfShare';
import type { UserProfile } from '@/types/auth';

describe('PdfPreviewModal Component', () => {
  let mockDoc: GeneratedPdfDocument;
  let cleanupSpy: ReturnType<typeof vi.fn>;
  let downloadSpy: ReturnType<typeof vi.spyOn>;
  let shareSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  const mockUserProfile: UserProfile = {
    id: 'user-123',
    email: 'aaqib@7time.com',
    full_name: 'Aaqib Mushtaq',
    phone: '+91 98765 43210',
    system_role: 'ADMIN',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    cleanupSpy = vi.fn();
    mockDoc = {
      blob: new Blob(['%PDF-1.4 test-pdf'], { type: 'application/pdf' }),
      file: new File(['%PDF-1.4 test-pdf'], '7TIME_Test.pdf', { type: 'application/pdf' }),
      objectUrl: 'blob:http://localhost/test-uuid',
      filename: '7TIME_Test.pdf',
      title: '7TIME Test Document',
      metadata: {
        documentType: 'personal_ledger_receipt',
        documentCategory: 'RECEIPT',
        generatedAt: '2026-11-10T12:00:00Z',
        orientation: 'portrait',
        pageFormat: 'a4',
      },
      cleanup: cleanupSpy as unknown as () => void,
    };

    downloadSpy = vi.spyOn(pdfShare, 'downloadPdfBlob').mockImplementation(() => {});
    shareSpy = vi.spyOn(pdfShare, 'sharePdfFile').mockResolvedValue({
      status: 'shared',
      method: 'web-share',
    });
    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PdfPreviewModal
        isOpen={false}
        onClose={vi.fn()}
        document={mockDoc}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, category badge, and iframe when isOpen is true', () => {
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
      />
    );

    expect(screen.getByText('7TIME Test Document')).toBeDefined();
    expect(screen.getByText('RECEIPT')).toBeDefined();
    expect(screen.getByText('7TIME_Test.pdf')).toBeDefined();

    const iframe = screen.getByTitle('7TIME Test Document') as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.src).toBe('blob:http://localhost/test-uuid');
  });

  it('renders loading state when isLoading is true', () => {
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={null}
        isLoading={true}
      />
    );

    expect(screen.getByText('Generating PDF document...')).toBeDefined();
  });

  it('renders error state when error message is provided', () => {
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={null}
        error="Database connection timeout"
      />
    );

    expect(screen.getByText('Unable to Generate PDF')).toBeDefined();
    expect(screen.getByText('Database connection timeout')).toBeDefined();
  });

  it('calls cleanup and onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={onClose}
        document={mockDoc}
      />
    );

    const closeBtn = screen.getByLabelText('Close PDF preview');
    fireEvent.click(closeBtn);

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls cleanup and onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={onClose}
        document={mockDoc}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers download when Download button is clicked', () => {
    const onActionComplete = vi.fn();
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        onActionComplete={onActionComplete}
      />
    );

    const downloadBtn = screen.getByTitle('Download PDF');
    fireEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalledWith(mockDoc.objectUrl, mockDoc.filename);
    expect(onActionComplete).toHaveBeenCalledWith('download');
    expect(screen.getByText('Downloaded successfully')).toBeDefined();
  });

  it('triggers native share when Share button is clicked', async () => {
    const onActionComplete = vi.fn();
    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        onActionComplete={onActionComplete}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledWith(mockDoc);
      expect(onActionComplete).toHaveBeenCalledWith('share');
      expect(screen.getByText('PDF shared successfully')).toBeDefined();
    });
  });

  it('triggers print when Print button is clicked', () => {
    const onActionComplete = vi.fn();
    const mockPrint = vi.fn();
    windowOpenSpy.mockReturnValue({
      print: mockPrint,
      addEventListener: vi.fn(),
    } as unknown as Window);

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        onActionComplete={onActionComplete}
      />
    );

    const printBtn = screen.getByTitle('Print PDF');
    fireEvent.click(printBtn);

    expect(onActionComplete).toHaveBeenCalledWith('print');
  });

  /* -------------------------------------------------------------
   * WhatsApp Sharing Integration Tests
   * ------------------------------------------------------------- */
  describe('WhatsApp Sharing Workflows', () => {
    it('renders WhatsApp action button in the action toolbar', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      expect(whatsAppBtn).toBeDefined();
      expect(whatsAppBtn.title).toBe('Open WhatsApp Conversation (Profile Number)');
    });

    it('shows error notice with profile update link when user has no phone number in profile', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone={null}
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      expect(screen.getByText('Profile Phone Number Required')).toBeDefined();
      expect(
        screen.getByText(/No phone number found in your profile/i)
      ).toBeDefined();
      const profileLink = screen.getByRole('link', { name: /Update Profile/i });
      expect(profileLink).toBeDefined();
      expect(profileLink.getAttribute('href')).toBe('#/settings?tab=profile');
    });

    it('shows warning notice when profile phone number is missing an international country code', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="1234567890" // 10 digits non-Indian without country code
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      expect(screen.getByText('Profile Phone Number Required')).toBeDefined();
      expect(
        screen.getByText(/missing an international country code/i)
      ).toBeDefined();
    });

    it('completes WhatsApp workflow for valid profile phone without forced download', () => {
      const onActionComplete = vi.fn();

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          onActionComplete={onActionComplete}
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      // 1. WhatsApp chat is opened via window.open
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919876543210',
        '_blank',
        'noopener,noreferrer'
      );

      // 2. Forced download is NOT triggered
      expect(downloadSpy).not.toHaveBeenCalled();

      // 3. User feedback message with masked phone and attachment instructions
      expect(screen.getByText('WhatsApp Conversation Opened')).toBeDefined();
      expect(screen.getByText(/To send this PDF, please attach the document in WhatsApp/i)).toBeDefined();

      // 4. Callback called
      expect(onActionComplete).toHaveBeenCalledWith('whatsapp');
    });

    it('handles popup blocker gracefully by displaying clickable fallback link', () => {
      windowOpenSpy.mockReturnValue(null); // Simulated popup blocker

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="+91 98765 43210"
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      expect(screen.getByText('Browser Popup Blocked')).toBeDefined();
      const openLink = screen.getByRole('link', { name: /Open WhatsApp/i });
      expect(openLink.getAttribute('href')).toBe('https://wa.me/919876543210');
      expect(openLink.getAttribute('target')).toBe('_blank');
    });

    it('surfaces native file share button in notice bar when platform supports canShareFiles', async () => {
      vi.spyOn(pdfShare, 'detectShareCapabilities').mockReturnValue({
        canUseWebShare: true,
        canShareFiles: true,
        isSecureContext: true,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="+91 98765 43210"
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      const osShareBtn = screen.getByRole('button', { name: /Share File Directly/i });
      expect(osShareBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(osShareBtn);
      });
      expect(shareSpy).toHaveBeenCalledWith(mockDoc);
    });

    it('prioritizes userPhone prop over userProfile and auth profile', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile} // has +91 98765 43210
          userPhone="+1 555 123 4567" // override with US number
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/15551234567',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('verifies that PDF is never automatically dispatched or downloaded without user confirmation', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="+91 98765 43210"
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      // Verify no unauthorized API calls and no forced download
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(downloadSpy).not.toHaveBeenCalled();
    });

    it('handles direct share cancellation (AbortError) without downloading and keeps preview open', async () => {
      shareSpy.mockResolvedValue({
        status: 'cancelled',
        method: 'web-share',
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="+91 98765 43210"
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledWith(mockDoc);
      expect(downloadSpy).not.toHaveBeenCalled();
      expect(screen.getByText('7TIME Test Document')).toBeDefined();
    });

    it('displays fallback options when direct file sharing is unsupported without forced download', async () => {
      shareSpy.mockResolvedValue({
        status: 'unsupported',
        method: 'unsupported',
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="+91 98765 43210"
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(downloadSpy).not.toHaveBeenCalled();
      expect(screen.getByText('Direct File Sharing Unavailable')).toBeDefined();
      const downloadFallbackBtn = screen.getByRole('button', { name: 'Download PDF' });
      expect(downloadFallbackBtn).toBeDefined();

      // Trigger manual download from banner
      fireEvent.click(downloadFallbackBtn);
      expect(downloadSpy).toHaveBeenCalledWith(mockDoc.objectUrl, mockDoc.filename);
    });

    it('prevents concurrent or repeated sharing invocations while sharing is in flight', async () => {
      let resolveShare: (val: any) => void;
      shareSpy.mockReturnValue(
        new Promise((resolve) => {
          resolveShare = resolve;
        })
      );

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userPhone="+91 98765 43210"
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });

      // First click
      fireEvent.click(shareBtn);

      // Second click while first is in-flight
      fireEvent.click(shareBtn);

      // Only one invocation should have occurred
      expect(shareSpy).toHaveBeenCalledTimes(1);

      // Cleanly resolve the in-flight promise
      await act(async () => {
        resolveShare!({ status: 'shared', method: 'web-share' });
      });
    });
  });

  /* -------------------------------------------------------------
   * Qarz-e-Hasana & Creditor Recipient Resolution Tests
   * ------------------------------------------------------------- */
  describe('Creditor Recipient Resolution for Qarz Statements and Vouchers', () => {
    const creditorDocA: GeneratedPdfDocument = {
      blob: new Blob(['%PDF-1.4 qarz data'], { type: 'application/pdf' }),
      file: new File(['%PDF-1.4 qarz data'], '7TIME_Qarz_QZ-101_Dr_Farooq.pdf', {
        type: 'application/pdf',
      }),
      objectUrl: 'blob:http://localhost/qarz-101',
      filename: '7TIME_Qarz_QZ-101_Dr_Farooq.pdf',
      title: 'Qarz-e-Hasana Acknowledgment: Dr. Farooq',
      metadata: {
        documentType: 'qarz_receipt',
        documentCategory: 'ACKNOWLEDGEMENT',
        generatedAt: '2026-11-11T10:00:00Z',
        recordId: 'qarz-101',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: 'Dr. Farooq',
        recipientPhone: '+91 9419123456',
      },
      cleanup: vi.fn(),
    };

    const creditorDocB: GeneratedPdfDocument = {
      blob: new Blob(['%PDF-1.4 qarz data b'], { type: 'application/pdf' }),
      file: new File(['%PDF-1.4 qarz data b'], '7TIME_Qarz_QZ-102_Bilal_Ahmad.pdf', {
        type: 'application/pdf',
      }),
      objectUrl: 'blob:http://localhost/qarz-102',
      filename: '7TIME_Qarz_QZ-102_Bilal_Ahmad.pdf',
      title: 'Qarz-e-Hasana Acknowledgment: Bilal Ahmad',
      metadata: {
        documentType: 'qarz_receipt',
        documentCategory: 'ACKNOWLEDGEMENT',
        generatedAt: '2026-11-11T10:00:00Z',
        recordId: 'qarz-102',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: 'Bilal Ahmad',
        recipientPhone: '+91 9876500000',
      },
      cleanup: vi.fn(),
    };

    const creditorDocNoPhone: GeneratedPdfDocument = {
      blob: new Blob(['%PDF-1.4 qarz data c'], { type: 'application/pdf' }),
      file: new File(['%PDF-1.4 qarz data c'], '7TIME_Qarz_QZ-103_Ghulam_Hassan.pdf', {
        type: 'application/pdf',
      }),
      objectUrl: 'blob:http://localhost/qarz-103',
      filename: '7TIME_Qarz_QZ-103_Ghulam_Hassan.pdf',
      title: 'Qarz-e-Hasana Acknowledgment: Ghulam Hassan',
      metadata: {
        documentType: 'qarz_receipt',
        documentCategory: 'ACKNOWLEDGEMENT',
        generatedAt: '2026-11-11T10:00:00Z',
        recordId: 'qarz-103',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: 'Ghulam Hassan',
        recipientPhone: null,
      },
      cleanup: vi.fn(),
    };

    it("resolves Creditor A's record to Creditor A's saved phone number (+91 9419123456)", () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={creditorDocA}
          userProfile={mockUserProfile} // User profile phone is +91 98765 43210
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Dr. Farooq');

      fireEvent.click(whatsAppBtn);

      // Verify it opens Dr. Farooq's phone number, NOT user's profile phone
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919419123456',
        '_blank',
        'noopener,noreferrer'
      );
      expect(downloadSpy).not.toHaveBeenCalled();
      expect(screen.getByText('WhatsApp Conversation Opened')).toBeDefined();
      const banner = screen.getByRole('alert');
      expect(within(banner).getByText(/Dr\. Farooq/)).toBeDefined();
    });

    it("resolves Creditor B's record to Creditor B's saved phone number (+91 9876500000)", () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={creditorDocB}
          userProfile={mockUserProfile} // User profile phone is +91 98765 43210
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Bilal Ahmad');

      fireEvent.click(whatsAppBtn);

      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919876500000',
        '_blank',
        'noopener,noreferrer'
      );
      expect(downloadSpy).not.toHaveBeenCalled();
      const banner = screen.getByRole('alert');
      expect(within(banner).getByText(/Bilal Ahmad/)).toBeDefined();
    });

    it('dynamically switches recipient phone when switching between creditor records', () => {
      const { rerender } = render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={creditorDocA}
          userProfile={mockUserProfile}
        />
      );

      let whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Dr. Farooq');
      fireEvent.click(whatsAppBtn);
      expect(windowOpenSpy).toHaveBeenLastCalledWith(
        'https://wa.me/919419123456',
        '_blank',
        'noopener,noreferrer'
      );

      // Switch to Creditor B
      rerender(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={creditorDocB}
          userProfile={mockUserProfile}
        />
      );

      whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Bilal Ahmad');
      fireEvent.click(whatsAppBtn);
      expect(windowOpenSpy).toHaveBeenLastCalledWith(
        'https://wa.me/919876500000',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it("NEVER uses authenticated user's profile number as fallback when creditor phone is missing", () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={creditorDocNoPhone}
          userProfile={mockUserProfile} // User profile phone is +91 98765 43210
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      // Window.open must NOT have been called with user's profile phone or anything else
      expect(windowOpenSpy).not.toHaveBeenCalled();
      expect(downloadSpy).not.toHaveBeenCalled();

      // Displays error requiring creditor phone in People Directory
      expect(screen.getByText('Creditor Phone Number Required')).toBeDefined();
      expect(
        screen.getByText(/No phone number found for Ghulam Hassan\. Please add their phone number in People Directory/i)
      ).toBeDefined();

      // Profile update link must NOT be shown for creditor documents
      expect(screen.queryByRole('link', { name: /Update Profile/i })).toBeNull();
    });

    it('keeps native Share PDF file attachment fully functional with non-empty PDF file', async () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={creditorDocA}
          userProfile={mockUserProfile}
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith(creditorDocA);
      expect(downloadSpy).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------
   * Customer Recipient Resolution for Customer Statements & Receipts
   * ------------------------------------------------------------- */
  describe('Customer Recipient Resolution for Customer Statements and Receipts', () => {
    const customerDocA: GeneratedPdfDocument = {
      ...mockDoc,
      title: 'Customer Statement: ummar bai',
      filename: '7TIME_Ledger_ummar_bai.pdf',
      metadata: {
        documentCategory: 'STATEMENT',
        documentType: 'customer_credit_statement',
        generatedAt: '2026-11-11T20:00:00.000Z',
        workspaceId: 'ws-7time',
        workspaceName: '7TIME Enterprise',
        recordId: 'cust-ummar-001',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: 'ummar bai',
        recipientPhone: '7006138763', // 10-digit Indian mobile number
      },
    };

    const customerDocB: GeneratedPdfDocument = {
      ...mockDoc,
      title: 'Customer Statement: Bashir Ahmad',
      filename: '7TIME_Ledger_Bashir_Ahmad.pdf',
      metadata: {
        documentCategory: 'STATEMENT',
        documentType: 'customer_credit_statement',
        generatedAt: '2026-11-11T20:00:00.000Z',
        workspaceId: 'ws-7time',
        workspaceName: '7TIME Enterprise',
        recordId: 'cust-bashir-002',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: 'Bashir Ahmad',
        recipientPhone: '+91 9419111222', // Already formatted with international prefix
      },
    };

    const customerDocNoPhone: GeneratedPdfDocument = {
      ...mockDoc,
      title: 'Customer Statement: Zahoor Traders',
      filename: '7TIME_Ledger_Zahoor_Traders.pdf',
      metadata: {
        documentCategory: 'STATEMENT',
        documentType: 'customer_credit_statement',
        generatedAt: '2026-11-11T20:00:00.000Z',
        workspaceId: 'ws-7time',
        workspaceName: '7TIME Enterprise',
        recordId: 'cust-zahoor-003',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: 'Zahoor Traders',
        recipientPhone: null,
      },
    };

    it('resolves Customer A (ummar bai) with 10-digit Indian national number 7006138763 to +91 and opens WhatsApp', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={customerDocA}
          userProfile={mockUserProfile} // User profile phone is +91 98765 43210
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with ummar bai');

      fireEvent.click(whatsAppBtn);

      // Verify it opens ummar bai's normalized number 917006138763, NOT user's profile phone
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/917006138763',
        '_blank',
        'noopener,noreferrer'
      );
      expect(downloadSpy).not.toHaveBeenCalled();
      expect(screen.getByText('WhatsApp Conversation Opened')).toBeDefined();
      const banner = screen.getByRole('alert');
      expect(within(banner).getByText(/ummar bai/)).toBeDefined();
    });

    it('resolves Customer B (Bashir Ahmad) with international number +91 9419111222 without double-prefixing', () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={customerDocB}
          userProfile={mockUserProfile} // User profile phone is +91 98765 43210
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Bashir Ahmad');

      fireEvent.click(whatsAppBtn);

      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919419111222',
        '_blank',
        'noopener,noreferrer'
      );
      expect(downloadSpy).not.toHaveBeenCalled();
      const banner = screen.getByRole('alert');
      expect(within(banner).getByText(/Bashir Ahmad/)).toBeDefined();
    });

    it('dynamically switches recipient phone when switching between customer records', () => {
      const { rerender } = render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={customerDocA}
          userProfile={mockUserProfile}
        />
      );

      let whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with ummar bai');
      fireEvent.click(whatsAppBtn);
      expect(windowOpenSpy).toHaveBeenLastCalledWith(
        'https://wa.me/917006138763',
        '_blank',
        'noopener,noreferrer'
      );

      // Switch to Customer B
      rerender(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={customerDocB}
          userProfile={mockUserProfile}
        />
      );

      whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Bashir Ahmad');
      fireEvent.click(whatsAppBtn);
      expect(windowOpenSpy).toHaveBeenLastCalledWith(
        'https://wa.me/919419111222',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it("NEVER uses authenticated user's profile number as fallback when customer phone is missing", () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={customerDocNoPhone}
          userProfile={mockUserProfile} // User profile phone is +91 98765 43210
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      // Window.open must NOT have been called with user's profile phone or anything else
      expect(windowOpenSpy).not.toHaveBeenCalled();
      expect(downloadSpy).not.toHaveBeenCalled();

      // Displays error requiring customer phone in People Directory
      expect(screen.getByText('Customer Phone Number Required')).toBeDefined();
      expect(
        screen.getByText(/No phone number found for Zahoor Traders\. Please add their phone number in People Directory/i)
      ).toBeDefined();

      // Profile update link must NOT be shown for customer documents
      expect(screen.queryByRole('link', { name: /Update Profile/i })).toBeNull();
    });

    it('keeps native Share PDF file attachment fully functional with non-empty PDF file', async () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={customerDocA}
          userProfile={mockUserProfile}
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith(customerDocA);
      expect(downloadSpy).not.toHaveBeenCalled();
    });
  });
});
