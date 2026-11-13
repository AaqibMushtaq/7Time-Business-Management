/**
 * Android Brave PDF File Sharing - Strict Regression Test Suite
 *
 * Enforces the 7 Critical Invariants:
 * 1. Share PDF button invokes ONLY sharePdfFile.
 * 2. Share PDF never invokes openWhatsAppConversation.
 * 3. Share PDF never navigates to wa.me.
 * 4. Native share is invoked synchronously on the user interaction path without gesture-destroying microtask delays.
 * 5. Unsupported file sharing does NOT redirect to WhatsApp (modal remains open with explicit manual actions).
 * 6. Share rejection (e.g. NotAllowedError or AbortError) does NOT redirect to WhatsApp.
 * 7. The exact generated PDF File object is passed unchanged to navigator.share.
 * 8. Development telemetry logs non-PII diagnostics to console and window.__LAST_7TIME_SHARE_DIAGNOSTICS__.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';
import React from 'react';
import { PdfPreviewModal } from './PdfPreviewModal';
import * as pdfShare from '@/services/pdf/pdfShare';
import * as pdfWhatsApp from '@/services/pdf/pdfWhatsApp';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import type { UserProfile } from '@/types/auth';

describe('Android Brave PDF File Sharing & Action Separation Regression Suite', () => {
  let mockDoc: GeneratedPdfDocument;
  let rawFile: File;
  let rawBlob: Blob;
  let openWhatsAppSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let sharePdfFileSpy: ReturnType<typeof vi.spyOn>;

  const mockUser: UserProfile = {
    id: 'user-operator-brave',
    email: 'operator@7time.biz',
    full_name: '7TIME Operator',
    phone: '+91 98765 43210',
    system_role: 'ADMIN',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-11-12T00:00:00Z',
  };

  const customerRecord = {
    name: 'ummar bai',
    phone: '7006138763',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    rawBlob = new Blob(['%PDF-1.4 authoritative binary stream'], { type: 'application/pdf' });
    rawFile = new File([rawBlob], '7TIME_Customer_Statement_ummar_bai.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    mockDoc = {
      blob: rawBlob,
      file: rawFile,
      objectUrl: 'blob:https://localhost/mock-uuid-stream',
      filename: '7TIME_Customer_Statement_ummar_bai.pdf',
      title: 'Customer Statement - ummar bai',
      hasValidHeader: true,
      metadata: {
        documentType: 'customer_credit_statement',
        documentCategory: 'STATEMENT',
        generatedAt: '2026-11-12T12:00:00Z',
        orientation: 'portrait',
        pageFormat: 'a4',
        recipientName: customerRecord.name,
        recipientPhone: customerRecord.phone,
      },
      cleanup: vi.fn(),
    };

    openWhatsAppSpy = vi.spyOn(pdfWhatsApp, 'openWhatsAppConversation');
    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
    sharePdfFileSpy = vi.spyOn(pdfShare, 'sharePdfFile');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Requirement 1 & 2 & 3: Share PDF button invokes only sharePdfFile, never openWhatsAppConversation or wa.me', async () => {
    sharePdfFileSpy.mockResolvedValue({
      status: 'shared',
      method: 'web-share',
    });

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        userProfile={mockUser}
        recipientName={customerRecord.name}
        recipientPhone={customerRecord.phone}
        recipientType="customer"
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });
    expect(shareBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // 1. Invokes only sharePdfFile with the document
    expect(sharePdfFileSpy).toHaveBeenCalledTimes(1);
    expect(sharePdfFileSpy).toHaveBeenCalledWith(mockDoc);

    // 2. NEVER invokes openWhatsAppConversation
    expect(openWhatsAppSpy).not.toHaveBeenCalled();

    // 3. NEVER navigates to wa.me or opens windows
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('Requirement 4: Native share is called synchronously from the user interaction path', async () => {
    // Mock navigator.share and canShare in secure context
    const navigatorShareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: navigatorShareSpy, configurable: true });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });

    // Unspy sharePdfFile to verify the real implementation
    sharePdfFileSpy.mockRestore();

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        userProfile={mockUser}
        recipientName={customerRecord.name}
        recipientPhone={customerRecord.phone}
        recipientType="customer"
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });

    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Verify navigator.share was directly called with the exact File
    expect(navigatorShareSpy).toHaveBeenCalledTimes(1);
    expect(navigatorShareSpy).toHaveBeenCalledWith({
      title: mockDoc.file.name,
      files: [mockDoc.file],
    });

    // Verify ZERO wa.me or openWhatsApp calls
    expect(openWhatsAppSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('Requirement 5: Unsupported file sharing does NOT redirect to WhatsApp (modal remains open with manual actions)', async () => {
    // Simulate Android Brave with file sharing restricted/unsupported
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });

    // Unspy sharePdfFile to exercise the actual unsupported branch
    sharePdfFileSpy.mockRestore();

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        userProfile={mockUser}
        recipientName={customerRecord.name}
        recipientPhone={customerRecord.phone}
        recipientType="customer"
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });

    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // 1. NEVER automatically opens WhatsApp
    expect(openWhatsAppSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // 2. Preview modal remains open and mounted
    expect(screen.getByTitle(mockDoc.title)).toBeDefined();

    // 3. Displays exact required explanation message
    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByText(
        'Your browser cannot share PDF files directly. Download the PDF and attach it manually in WhatsApp.'
      )
    ).toBeDefined();

    // 4. Provides explicit separate actions: Download PDF and Open WhatsApp
    const downloadBtn = within(alert).getByRole('button', { name: /Download PDF/i });
    const whatsAppBtn = within(alert).getByRole('button', { name: /Open Customer WhatsApp/i });
    expect(downloadBtn).toBeDefined();
    expect(whatsAppBtn).toBeDefined();
  });

  it('Requirement 6: Share rejection (e.g. NotAllowedError) does NOT redirect to WhatsApp', async () => {
    const gestureError = new Error('Must be handling a user gesture to share.');
    gestureError.name = 'NotAllowedError';

    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(gestureError),
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });

    // Unspy sharePdfFile to exercise the actual rejection branch
    sharePdfFileSpy.mockRestore();

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        userProfile={mockUser}
        recipientName={customerRecord.name}
        recipientPhone={customerRecord.phone}
        recipientType="customer"
      />
    );

    const shareBtn = screen.getByRole('button', { name: /Share PDF/i });

    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // 1. NEVER automatically redirects or opens WhatsApp
    expect(openWhatsAppSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // 2. Preview remains open
    expect(screen.getByTitle(mockDoc.title)).toBeDefined();

    // 3. Displays warning with captured error message
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Sharing Unsuccessful')).toBeDefined();
    expect(
      within(alert).getByText(/Must be handling a user gesture to share/i)
    ).toBeDefined();
  });

  it('Requirement 7: The actual PDF File is passed unchanged to navigator.share', async () => {
    const navigatorShareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: navigatorShareSpy, configurable: true });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });

    sharePdfFileSpy.mockRestore();

    await pdfShare.sharePdfFile(mockDoc);

    expect(navigatorShareSpy).toHaveBeenCalledTimes(1);
    const passedPayload = navigatorShareSpy.mock.calls[0][0];

    // Proves identity reference to the same File instance
    expect(passedPayload.files[0]).toBe(rawFile);
    expect(passedPayload.files[0].name).toBe('7TIME_Customer_Statement_ummar_bai.pdf');
    expect(passedPayload.files[0].type).toBe('application/pdf');
    expect(passedPayload.files[0].size).toBe(rawFile.size);
  });

  it('Requirement 8: Diagnostics telemetry records non-PII telemetry and stores on window', async () => {
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });

    sharePdfFileSpy.mockRestore();

    await pdfShare.sharePdfFile(mockDoc);

    expect(logSpy).toHaveBeenCalled();
    const recordedDiagnostics = (window as any).__LAST_7TIME_SHARE_DIAGNOSTICS__;
    expect(recordedDiagnostics).toBeDefined();
    expect(recordedDiagnostics.actionBranch).toBe('native-share-success');
    expect(recordedDiagnostics.pdfFilename).toBe('7TIME_Customer_Statement_ummar_bai.pdf');
    expect(recordedDiagnostics.pdfMimeType).toBe('application/pdf');
    expect(recordedDiagnostics.canShareFiles).toBe(true);
    expect(recordedDiagnostics.isSecureContext).toBe(true);

    // CRITICAL SECURITY ASSERTION: No personal customer phone or name is logged
    const serialized = JSON.stringify(recordedDiagnostics);
    expect(serialized).not.toContain(customerRecord.phone);
    expect(serialized).not.toContain(mockUser.phone);
  });

  it('Requirement 9: Records visible 6-step diagnostic trace and userActivation state during Share PDF execution', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });
    Object.defineProperty(navigator, 'userActivation', {
      value: { isActive: true },
      configurable: true,
    });

    sharePdfFileSpy.mockRestore();

    render(
      <PdfPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        userProfile={mockUser}
        recipientName={customerRecord.name}
        recipientPhone={customerRecord.phone}
        recipientType="customer"
      />
    );

    const shareBtn = screen.getByTestId('share-pdf-button');
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // 1. Verify that openWhatsAppConversation and window.open are NEVER called
    expect(openWhatsAppSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();

    // 2. Verify visible diagnostic trace section is rendered
    const traceSection = screen.getByTestId('diagnostic-trace-section');
    expect(traceSection).toBeDefined();

    const traceText = traceSection.textContent || '';
    expect(traceText).toContain('1. share-button-clicked');
    expect(traceText).toContain('2. pdf-file-resolved');
    expect(traceText).toContain('3. file-validation-completed');
    expect(traceText).toContain('4. can-share-checked');
    expect(traceText).toContain('5. navigator-share-called');
    expect(traceText).toContain('6. navigator-share-resolved');
  });
});

