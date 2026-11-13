/**
 * 7TIME PDF Subsystem - Cross-Browser Capability & Compatibility Test Suite
 *
 * Validates capability-based sharing strategies across:
 * - Android Brave (Shields On / Shields Off)
 * - Android Chrome
 * - iOS Brave
 * - iOS Safari
 * - Windows Brave
 * - Windows Chrome
 * - Windows Edge
 * - Insecure Contexts (HTTP)
 * - Throwing / restrictive permission environments
 *
 * Implements:
 * - Strategy A: Native file sharing when supported (navigator.share with files)
 * - Strategy B: Desktop / unsupported fallback (Download PDF + Open WhatsApp + manual attach)
 * - Strategy C: Share cancellation (AbortError handling, zero download, modal stays active)
 * - Strict Recipient Resolution: Customer/Creditor phone used; profile phone never substituted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';
import React from 'react';
import {
  detectShareCapabilities,
  canSharePdfFile,
  sharePdfFile,
  shareOrDownloadPdf,
  isValidPdfFile,
  validatePdfFile,
  hasPdfMagicBytes,
} from '@/services/pdf/pdfShare';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import type { UserProfile } from '@/types/auth';

describe('Cross-Browser PDF Sharing Compatibility Matrix', () => {
  let mockDoc: GeneratedPdfDocument;
  let authenticPdfFile: File;
  let authenticPdfBlob: Blob;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn<() => void>>;

  const mockUserProfile: UserProfile = {
    id: 'user-admin-1',
    email: 'admin@7time.com',
    full_name: 'Aaqib Mushtaq',
    phone: '+91 98765 43210',
    system_role: 'ADMIN',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-11-12T00:00:00Z',
  };

  const customerRecord = {
    name: 'ummar bai',
    phone: '7006138763', // 10-digit Indian national number
  };

  const creditorRecord = {
    name: 'Dr. Farooq Ahmad',
    phone: '+91 9419123456',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    authenticPdfBlob = new Blob(['%PDF-1.4 authoritative test content'], {
      type: 'application/pdf',
    });
    authenticPdfFile = new File([authenticPdfBlob], '7TIME_Customer_Statement.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    mockDoc = {
      blob: authenticPdfBlob,
      file: authenticPdfFile,
      objectUrl: 'blob:https://localhost/test-statement-uuid',
      filename: '7TIME_Customer_Statement.pdf',
      title: 'Customer Statement: ummar bai',
      metadata: {
        documentType: 'customer_credit_statement',
        documentCategory: 'STATEMENT',
        generatedAt: '2026-11-12T12:00:00Z',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: customerRecord.name,
        recipientPhone: customerRecord.phone,
      },
      cleanup: vi.fn() as unknown as () => void,
    };

    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);

    clickSpy = vi.fn<() => void>();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => {
          clickSpy();
        };
      }
      return el;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // Browser capability helper
  function setupBrowserEnvironment(capabilities: {
    isSecureContext: boolean;
    hasShare: boolean;
    hasCanShare: boolean;
    canShareFiles: boolean | 'throw';
    shareRejection?: Error;
  }) {
    Object.defineProperty(window, 'isSecureContext', {
      value: capabilities.isSecureContext,
      configurable: true,
    });

    const shareSpy = capabilities.shareRejection
      ? vi.fn().mockRejectedValue(capabilities.shareRejection)
      : vi.fn().mockResolvedValue(undefined);

    const canShareSpy = vi.fn((data?: ShareData) => {
      if (capabilities.canShareFiles === 'throw') {
        throw new Error('Permission query blocked by browser privacy shield');
      }
      if (data && data.files && data.files.length > 0) {
        return Boolean(capabilities.canShareFiles);
      }
      return true;
    });

    Object.defineProperty(navigator, 'share', {
      value: capabilities.hasShare ? shareSpy : undefined,
      configurable: true,
    });

    Object.defineProperty(navigator, 'canShare', {
      value: capabilities.hasCanShare ? canShareSpy : undefined,
      configurable: true,
    });

    return { shareSpy, canShareSpy };
  }

  describe('1. Browser Capability Detection Matrix', () => {
    it('Android Chrome: recognizes Web Share Level 2 file sharing in secure context', () => {
      const { canShareSpy } = setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(true);
      expect(canShareSpy).toHaveBeenCalledWith({ files: [mockDoc.file] });
    });

    it('iOS Safari: recognizes Web Share Level 2 file sharing in secure context', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(true);
    });

    it('Android Brave (Shields Off / Capable): recognizes file sharing when canShare returns true', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      const caps = detectShareCapabilities(mockDoc.file);
      expect(caps.canUseWebShare).toBe(true);
      expect(caps.canShareFiles).toBe(true);
      expect(canSharePdfFile(mockDoc.file)).toBe(true);
    });

    it('Android Brave (Shields On / Restricted): detects unsupported when canShare({ files }) returns false', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: false,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(false);
    });

    it('iOS Brave: detects unsupported when navigator.canShare is missing', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: false,
        canShareFiles: false,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(false);
    });

    it('Windows Brave: detects unsupported when navigator.share is undefined', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: false,
        hasCanShare: false,
        canShareFiles: false,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(false);
    });

    it('Windows Chrome: detects unsupported when navigator.canShare({ files }) returns false', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: false,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(false);
    });

    it('Windows Edge: detects unsupported when Level 2 files are not supported', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: false,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(false);
    });

    it('Insecure Context (HTTP): blocks native sharing even if navigator.share exists', () => {
      setupBrowserEnvironment({
        isSecureContext: false,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      const isSupported = canSharePdfFile(mockDoc.file);
      expect(isSupported).toBe(false);
    });

    it('Gracefully handles privacy shield exceptions thrown by navigator.canShare', () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: 'throw',
      });

      expect(() => canSharePdfFile(mockDoc.file)).not.toThrow();
      expect(canSharePdfFile(mockDoc.file)).toBe(false);
    });
  });

  describe('2. Strategy A — Native File Sharing Execution', () => {
    it('passes the actual generated PDF File to navigator.share and does not trigger download or wa.me', async () => {
      const { shareSpy } = setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledTimes(1);
      const passedPayload = shareSpy.mock.calls[0][0];
      expect(passedPayload.files[0]).toBe(mockDoc.file);
      expect(passedPayload.files[0].name).toBe('7TIME_Customer_Statement.pdf');
      expect(passedPayload.files[0].type).toBe('application/pdf');

      // No download or wa.me opened
      expect(clickSpy).not.toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('validates binary %PDF- magic bytes before sharing', async () => {
      expect(isValidPdfFile(mockDoc.file)).toBe(true);
      const valid = await hasPdfMagicBytes(mockDoc.file);
      expect(valid).toBe(true);

      const validation = await validatePdfFile(mockDoc.file);
      expect(validation.isValid).toBe(true);
    });

    it('sharePdfFile directly returns unsupported without crashing when native file share is unavailable', async () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: false,
        hasCanShare: false,
        canShareFiles: false,
      });

      const result = await sharePdfFile(mockDoc);
      expect(result.status).toBe('unsupported');
      expect(result.method).toBe('unsupported');
    });
  });

  describe('3. Strategy B — Desktop and Unsupported Browsers Fallback', () => {
    it('displays non-error explanation banner with explicit Download and WhatsApp actions', async () => {
      // Simulate Windows Brave or Windows Chrome without Level 2 share
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: false,
        hasCanShare: false,
        canShareFiles: false,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      // Zero forced download: clicking Share PDF when unsupported displays fallback without downloading
      expect(clickSpy).not.toHaveBeenCalled();

      // Displays informative notification (not a failure alert)
      const notice = screen.getByRole('alert');
      expect(within(notice).getByText('Direct File Sharing Unavailable')).toBeDefined();
      expect(
        within(notice).getByText(
          'Your browser cannot share PDF files directly. Download the PDF and attach it manually in WhatsApp.'
        )
      ).toBeDefined();

      const downloadAction = within(notice).getByRole('button', { name: /Download PDF/i });
      const whatsAppAction = within(notice).getByRole('button', { name: /Open Customer WhatsApp/i });
      expect(downloadAction).toBeDefined();
      expect(whatsAppAction).toBeDefined();

      // User triggers manual download explicitly from fallback action
      fireEvent.click(downloadAction);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // User triggers Open WhatsApp
      fireEvent.click(whatsAppAction);
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/917006138763',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('shareOrDownloadPdf with fallbackToDownload triggers download when unsupported', async () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: false,
        hasCanShare: false,
        canShareFiles: false,
      });

      const result = await shareOrDownloadPdf(mockDoc, { fallbackToDownload: true });
      expect(result.status).toBe('downloaded');
      expect(result.method).toBe('download');
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Strategy C — Share Cancellation Handling', () => {
    it('keeps preview open without downloading or showing false success when user cancels', async () => {
      const abortError = new Error('User dismissed the native share sheet');
      abortError.name = 'AbortError';

      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
        shareRejection: abortError,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      // Verification:
      // 1. Zero download
      expect(clickSpy).not.toHaveBeenCalled();
      // 2. Zero wa.me navigation
      expect(windowOpenSpy).not.toHaveBeenCalled();
      // 3. Preview iframe remains open and mounted
      expect(screen.getByTitle(mockDoc.title)).toBeDefined();
      // 4. No false success message
      expect(screen.queryByText('PDF shared successfully')).toBeNull();
    });
  });

  describe('5. Recipient Resolution Invariants Across Cross-Browser Flows', () => {
    it('resolves customer recipient phone and never falls back to logged-in profile phone', async () => {
      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with ummar bai');

      await act(async () => {
        fireEvent.click(whatsAppBtn);
      });

      // Opens normalized Indian customer phone: +91 7006138763 -> 917006138763
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/917006138763',
        '_blank',
        'noopener,noreferrer'
      );
      // NEVER opens logged-in user profile phone: +91 98765 43210
      expect(windowOpenSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('9876543210'),
        expect.anything(),
        expect.anything()
      );
    });

    it('resolves creditor recipient phone for Qarz documents and never falls back to profile phone', async () => {
      const qarzDoc: GeneratedPdfDocument = {
        ...mockDoc,
        title: 'Qarz-e-Hasana Voucher: Dr. Farooq Ahmad',
        metadata: {
          documentType: 'qarz_receipt',
          documentCategory: 'ACKNOWLEDGEMENT',
          generatedAt: '2026-11-12T12:00:00Z',
          orientation: 'portrait',
          pageFormat: 'a4',
          recipientName: creditorRecord.name,
          recipientPhone: creditorRecord.phone,
        },
      };

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={qarzDoc}
          userProfile={mockUserProfile}
          recipientName={creditorRecord.name}
          recipientPhone={creditorRecord.phone}
          recipientType="creditor"
        />
      );

      const whatsAppBtn = screen.getByRole('button', { name: /Open WhatsApp/i });
      expect(whatsAppBtn.title).toBe('Open WhatsApp with Dr. Farooq Ahmad');

      await act(async () => {
        fireEvent.click(whatsAppBtn);
      });

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919419123456',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('6. 5-Platform/Browser Verification Matrix (Windows & Android)', () => {
    it('Platform Matrix 1: Windows Brave -> executes desktop fallback download, opens WhatsApp only on explicit user click, renders diagnostic panel', async () => {
      // Simulate Windows Brave: Desktop browser where Level 2 files are unsupported
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: false,
        hasCanShare: false,
        canShareFiles: false,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      // Verify Runtime Diagnostic Panel is visible and shows environment details (Zero PII)
      const diagPanel = screen.getByTestId('runtime-diagnostic-panel');
      expect(diagPanel).toBeDefined();
      expect(within(diagPanel).getByText(/PDF Sharing Runtime Diagnostics/i)).toBeDefined();
      expect(within(diagPanel).getByText(/Secure Context/i)).toBeDefined();

      const shareBtn = screen.getByTestId('share-pdf-button');
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      // 1. Zero forced download: clicking Share PDF when unsupported displays fallback
      expect(clickSpy).not.toHaveBeenCalled();

      // 2. NEVER opens WhatsApp automatically
      expect(windowOpenSpy).not.toHaveBeenCalled();

      // 3. Explains manual attachment is necessary
      const alert = screen.getByRole('alert');
      expect(
        within(alert).getByText(
          'Your browser cannot share PDF files directly. Download the PDF and attach it manually in WhatsApp.'
        )
      ).toBeDefined();

      // 4. Opens WhatsApp conversation ONLY when user explicitly clicks Open WhatsApp
      const openWhatsAppAction = within(alert).getByRole('button', { name: /Open Customer WhatsApp/i });
      fireEvent.click(openWhatsAppAction);
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/917006138763',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('Platform Matrix 2: Windows Chrome -> executes desktop fallback download without automatic WhatsApp redirection', async () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: false,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByTestId('share-pdf-button');
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(clickSpy).not.toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('Platform Matrix 3: Windows Edge -> executes desktop fallback download without automatic WhatsApp redirection', async () => {
      setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: false,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByTestId('share-pdf-button');
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(clickSpy).not.toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('Platform Matrix 4: Android Brave (Capable) -> invokes navigator.share directly with exact File payload', async () => {
      const { shareSpy } = setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByTestId('share-pdf-button');
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith({
        title: mockDoc.file.name,
        files: [mockDoc.file],
      });
      expect(clickSpy).not.toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('Platform Matrix 5: Android Chrome -> invokes navigator.share directly with exact File payload', async () => {
      const { shareSpy } = setupBrowserEnvironment({
        isSecureContext: true,
        hasShare: true,
        hasCanShare: true,
        canShareFiles: true,
      });

      render(
        <PdfPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          document={mockDoc}
          userProfile={mockUserProfile}
          recipientName={customerRecord.name}
          recipientPhone={customerRecord.phone}
          recipientType="customer"
        />
      );

      const shareBtn = screen.getByTestId('share-pdf-button');
      await act(async () => {
        fireEvent.click(shareBtn);
      });

      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith({
        title: mockDoc.file.name,
        files: [mockDoc.file],
      });
      expect(clickSpy).not.toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });
});

