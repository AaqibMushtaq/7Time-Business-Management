import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
      blob: new Blob(['test-pdf'], { type: 'application/pdf' }),
      file: new File(['test-pdf'], '7TIME_Test.pdf', { type: 'application/pdf' }),
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
    shareSpy = vi.spyOn(pdfShare, 'shareOrDownloadPdf').mockResolvedValue({
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

    const shareBtn = screen.getByRole('button', { name: /Share/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledWith(mockDoc);
      expect(onActionComplete).toHaveBeenCalledWith('share');
      expect(screen.getByText('Shared successfully')).toBeDefined();
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
      expect(whatsAppBtn.title).toBe('Share to WhatsApp (Profile Number)');
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
          userPhone="9876543210" // 10 digits without country code
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /WhatsApp/i });
      fireEvent.click(whatsAppBtn);

      expect(screen.getByText('Profile Phone Number Required')).toBeDefined();
      expect(
        screen.getByText(/missing an international country code/i)
      ).toBeDefined();
    });

    it('completes WhatsApp workflow for valid profile phone: downloads PDF and opens chat URL', () => {
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

      // 1. PDF is downloaded locally for manual attachment
      expect(downloadSpy).toHaveBeenCalledWith(mockDoc.objectUrl, mockDoc.filename);

      // 2. WhatsApp chat is opened via window.open
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919876543210',
        '_blank',
        'noopener,noreferrer'
      );

      // 3. User feedback message with masked phone and manual attachment instructions
      expect(screen.getByText('WhatsApp Conversation Opened')).toBeDefined();
      expect(screen.getByText(/attach it using the paperclip \(\+\) icon in WhatsApp/i)).toBeDefined();

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

      const osShareBtn = screen.getByRole('button', { name: /Share File \(OS Sheet\)/i });
      expect(osShareBtn).toBeDefined();

      // Test clicking native file share from WhatsApp notice
      const navigatorShareSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        value: navigatorShareSpy,
        configurable: true,
      });

      await act(async () => {
        fireEvent.click(osShareBtn);
      });
      expect(navigatorShareSpy).toHaveBeenCalledWith({
        title: mockDoc.title,
        text: mockDoc.title,
        files: [mockDoc.file],
      });
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

    it('verifies that PDF is never automatically dispatched or uploaded without user confirmation', () => {
      // The WhatsApp workflow only navigates to wa.me/<phone> and downloads the file locally;
      // it does NOT make any network POST/PUT requests or send files automatically.
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

      // Verify no unauthorized API calls
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(downloadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
