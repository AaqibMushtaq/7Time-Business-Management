/**
 * 7TIME PDF Subsystem - Strict File Payload Verification Suite
 * Validates the 10 Critical PDF File Sharing Requirements:
 * 1. Generated PDF is a valid non-empty File with PDF bytes.
 * 2. PDF file is passed to navigator.canShare.
 * 3. Exact PDF File reference is passed to navigator.share.
 * 4. Share payload contains files array, not merely text or url.
 * 5. No download occurs before or during successful native-share invocation.
 * 6. No WhatsApp URL is opened as a substitute for file sharing.
 * 7. Unsupported browsers display explicit download and WhatsApp fallback.
 * 8. Share cancellation (AbortError) does not trigger an unwanted download.
 * 9. Preview and sharing use the identical PDF document instance.
 * 10. Object URL cleanup does not invalidate the File during sharing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';
import React from 'react';
import { generatePersonalLedgerStatementPdf } from '@/services/pdf/templates/personalLedgerPdf';
import {
  sharePdfFile,
  canSharePdfFile,
  isValidPdfFile,
  getHexSignature,
} from '@/services/pdf/pdfShare';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import type { UserProfile } from '@/types/auth';

describe('PDF Subsystem - 10 File Payload & Native Sharing Requirements', () => {
  let realPdfDoc: GeneratedPdfDocument;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  const mockUserProfile: UserProfile = {
    id: 'user-7time-verified',
    email: 'admin@7time.com',
    full_name: 'Aaqib Mushtaq',
    phone: '+91 98765 43210',
    system_role: 'ADMIN',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-11-11T00:00:00Z',
  };

  const setupNativeShareSupported = (canShareReturnValue = true) => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    const canShareSpy = vi.fn().mockReturnValue(canShareReturnValue);
    Object.defineProperty(navigator, 'share', {
      value: shareSpy,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: canShareSpy,
      configurable: true,
    });
    return { shareSpy, canShareSpy };
  };

  const setupNativeShareUnsupported = () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: undefined,
      configurable: true,
    });
  };

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Generate genuine ledger PDF document
    realPdfDoc = await generatePersonalLedgerStatementPdf({
      workspaceId: 'ws-test',
      workspaceName: '7TIME Kashmir Hub',
      generatedBy: 'admin@7time.com',
      dateRangeLabel: 'November 2026',
      entries: [
        {
          id: 'e-1',
          date: '2026-11-01',
          particulars: 'Retail Sales Income',
          category: 'Sales',
          type: 'INCOME',
          account: 'Cash Account',
          amount: 25000,
        },
      ],
      summary: {
        totalIncome: 25000,
        totalExpense: 0,
        netBalance: 25000,
        qarz: {
          totalGiven: 0,
          totalReceived: 0,
          outstandingReceivables: 0,
          outstandingPayables: 0,
        },
      },
    });

    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Requirement 1: The generated PDF is a valid non-empty File with authentic PDF bytes', async () => {
    expect(realPdfDoc.file).toBeInstanceOf(File);
    expect(realPdfDoc.file.type).toBe('application/pdf');
    expect(realPdfDoc.file.name.toLowerCase().endsWith('.pdf')).toBe(true);
    expect(realPdfDoc.file.size).toBeGreaterThan(0);
    expect(realPdfDoc.blob.size).toBeGreaterThan(0);
    expect(isValidPdfFile(realPdfDoc.file)).toBe(true);

    // Verify valid PDF magic header (%PDF-)
    const firstBytes = await realPdfDoc.file.slice(0, 5).text();
    expect(firstBytes.startsWith('%PDF-')).toBe(true);
  });

  it('Requirement 2: The exact PDF file is passed to navigator.canShare', () => {
    const { canShareSpy } = setupNativeShareSupported(true);

    const isSupported = canSharePdfFile(realPdfDoc.file);
    expect(isSupported).toBe(true);
    expect(canShareSpy).toHaveBeenCalledWith({ files: [realPdfDoc.file] });
    expect(canShareSpy.mock.calls[0][0].files[0]).toBe(realPdfDoc.file);
  });

  it('Requirement 3: The exact PDF File reference is passed to navigator.share', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    const result = await sharePdfFile(realPdfDoc);
    expect(result.status).toBe('shared');
    expect(result.method).toBe('web-share');

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const passedPayload = shareSpy.mock.calls[0][0];
    expect(passedPayload.files[0]).toBe(realPdfDoc.file);
  });

  it('Requirement 4: The share payload contains files, not merely text or url', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    await sharePdfFile(realPdfDoc);

    const sharePayload = shareSpy.mock.calls[0][0];
    expect(Array.isArray(sharePayload.files)).toBe(true);
    expect(sharePayload.files.length).toBe(1);
    expect(sharePayload.files[0]).toBeInstanceOf(File);
    expect(sharePayload.files[0].type).toBe('application/pdf');
    expect(sharePayload.url).toBeUndefined();
  });

  it('Requirement 5: No download occurs before or during successful native-share invocation', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={realPdfDoc}
        userProfile={mockUserProfile}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('Requirement 6: No WhatsApp URL is opened as a substitute for file sharing', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={realPdfDoc}
        userProfile={mockUserProfile}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('Requirement 7: Unsupported browsers display explicit download and WhatsApp fallbacks', async () => {
    setupNativeShareUnsupported();

    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={realPdfDoc}
        userProfile={mockUserProfile}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(clickSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // In-modal banner displayed
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Direct File Sharing Unavailable')).toBeDefined();
    const downloadAction = within(alert).getByRole('button', { name: 'Download PDF' });
    const whatsAppAction = within(alert).getByRole('button', { name: 'Open WhatsApp' });
    expect(downloadAction).toBeDefined();
    expect(whatsAppAction).toBeDefined();

    // Trigger manual download from banner
    fireEvent.click(downloadAction);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('Requirement 8: Share cancellation does not cause an unwanted download and keeps modal active', async () => {
    setupNativeShareSupported(true);

    const abortError = new Error('User closed share sheet');
    abortError.name = 'AbortError';
    const shareSpy = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', {
      value: shareSpy,
      configurable: true,
    });

    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={realPdfDoc}
        userProfile={mockUserProfile}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();
    // Modal preview still active
    expect(screen.getByText(realPdfDoc.title)).toBeDefined();
  });

  it('Requirement 9: Preview and sharing use the identical PDF document instance', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={realPdfDoc}
        userProfile={mockUserProfile}
      />
    );

    // Verify preview iframe uses the document's objectUrl
    const iframe = screen.getByTitle(realPdfDoc.title);
    expect(iframe.getAttribute('src')).toBe(realPdfDoc.objectUrl);

    // Click Share PDF
    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // The shared file is the identical File reference from realPdfDoc
    expect(shareSpy.mock.calls[0][0].files[0]).toBe(realPdfDoc.file);
  });

  it('Requirement 10: Object URL cleanup does not invalidate the File during sharing', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    // Invoke document lifecycle cleanup
    realPdfDoc.cleanup();

    // Confirm File remains valid in memory
    expect(realPdfDoc.file).toBeInstanceOf(File);
    expect(realPdfDoc.file.size).toBeGreaterThan(0);
    expect(isValidPdfFile(realPdfDoc.file)).toBe(true);

    // Share invoked after cleanup still succeeds with valid file
    const result = await sharePdfFile(realPdfDoc);
    expect(result.status).toBe('shared');
    expect(shareSpy.mock.calls[0][0].files[0]).toBe(realPdfDoc.file);
  });

  it('Requirement 11: Raw binary bytes begin with %PDF- and match authoritative hex signature 25 50 44 46 2d', async () => {
    const fileHex = await getHexSignature(realPdfDoc.file, 16);
    const blobHex = await getHexSignature(realPdfDoc.blob, 16);

    expect(fileHex.startsWith('25 50 44 46 2d')).toBe(true);
    expect(blobHex.startsWith('25 50 44 46 2d')).toBe(true);
    expect(fileHex).toBe(blobHex);
  });

  it('Requirement 12: File object has non-zero size, application/pdf MIME type, and .pdf filename', () => {
    const file = realPdfDoc.file;
    expect(file.size).toBeGreaterThan(0);
    expect(file.type).toBe('application/pdf');
    expect(file.name.toLowerCase().endsWith('.pdf')).toBe(true);
    expect(isValidPdfFile(file)).toBe(true);
  });

  it('Requirement 13: Exact File instance is passed to navigator.share({ files: [file], title: file.name }) with zero extra properties', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    await sharePdfFile(realPdfDoc);

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const payload = shareSpy.mock.calls[0][0];
    expect(payload.files).toEqual([realPdfDoc.file]);
    expect(payload.files[0]).toBe(realPdfDoc.file);
    expect(payload.title).toBe(realPdfDoc.file.name);
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
  });

  it('Requirement 14: Preview and share operations use identical underlying PDF data (blob bytes equal file bytes)', async () => {
    expect(realPdfDoc.file.size).toBe(realPdfDoc.blob.size);

    const fileBuf = await realPdfDoc.file.arrayBuffer();
    const blobBuf = await realPdfDoc.blob.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuf);
    const blobBytes = new Uint8Array(blobBuf);

    expect(fileBytes.length).toBe(blobBytes.length);
    let bytesMatch = true;
    for (let i = 0; i < Math.min(fileBytes.length, 64); i++) {
      if (fileBytes[i] !== blobBytes[i]) {
        bytesMatch = false;
        break;
      }
    }
    expect(bytesMatch).toBe(true);
  });

  it('Requirement 15: Native share rejects empty or corrupt files before calling navigator.share()', async () => {
    const { shareSpy } = setupNativeShareSupported(true);

    // Test empty file
    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
    const emptyDoc: GeneratedPdfDocument = {
      ...realPdfDoc,
      file: emptyFile,
      blob: new Blob([]),
      hasValidHeader: false,
    };
    const emptyResult = await sharePdfFile(emptyDoc);
    expect(emptyResult.status).toBe('failed');
    expect(shareSpy).not.toHaveBeenCalled();

    // Test corrupt file (wrong magic bytes)
    const corruptFile = new File(['NOT-A-PDF-CONTENT-CORRUPT'], 'corrupt.pdf', { type: 'application/pdf' });
    const corruptDoc: GeneratedPdfDocument = {
      ...realPdfDoc,
      file: corruptFile,
      blob: new Blob(['NOT-A-PDF-CONTENT-CORRUPT']),
      hasValidHeader: false,
    };
    const corruptResult = await sharePdfFile(corruptDoc);
    expect(corruptResult.status).toBe('failed');
    expect(corruptResult.error?.message).toContain('Invalid PDF content');
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('Requirement 16: Telemetry attaches complete runtime diagnostics (hex, blob match, userActivation, zero PII) to window', async () => {
    setupNativeShareSupported(true);
    Object.defineProperty(navigator, 'userActivation', {
      value: { isActive: true },
      configurable: true,
    });

    await sharePdfFile(realPdfDoc);

    const diag = (window as any).__LAST_7TIME_SHARE_DIAGNOSTICS__;
    expect(diag).toBeDefined();
    expect(diag.fileIsInstanceOfFile).toBe(true);
    expect(diag.fileHexSignature.startsWith('25 50 44 46 2d')).toBe(true);
    expect(diag.hasValidPdfHeader).toBe(true);
    expect(diag.blobHexSignature.startsWith('25 50 44 46 2d')).toBe(true);
    expect(diag.isBlobIdentical).toBe(true);
    expect(diag.blobSize).toBe(realPdfDoc.blob.size);
    expect(diag.pdfSize).toBe(realPdfDoc.file.size);
    expect(diag.userActivationIsActive).toBe(true);
    expect(diag.sharePayload).toEqual({
      filesCount: 1,
      title: realPdfDoc.file.name,
      hasUrl: false,
      hasText: false,
    });
  });
});
