import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectShareCapabilities,
  downloadPdfBlob,
  shareOrDownloadPdf,
} from './pdfShare';
import type { GeneratedPdfDocument } from './pdfTypes';

describe('pdfShare', () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  describe('detectShareCapabilities', () => {
    it('detects when Web Share and file sharing are supported in a secure context', () => {
      const mockCanShare = vi.fn().mockReturnValue(true);
      const mockShare = vi.fn();

      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: mockShare,
          canShare: mockCanShare,
        },
        configurable: true,
        writable: true,
      });

      const caps = detectShareCapabilities();
      expect(caps.canUseWebShare).toBe(true);
      expect(caps.canShareFiles).toBe(true);
      expect(caps.isSecureContext).toBe(true);
    });

    it('returns false when navigator.share is undefined (e.g. desktop non-Safari)', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const caps = detectShareCapabilities();
      expect(caps.canUseWebShare).toBe(false);
      expect(caps.canShareFiles).toBe(false);
    });

    it('returns false when window is not a secure context (e.g. HTTP)', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: false },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: vi.fn(),
          canShare: vi.fn().mockReturnValue(true),
        },
        configurable: true,
        writable: true,
      });

      const caps = detectShareCapabilities();
      expect(caps.isSecureContext).toBe(false);
    });

    it('handles exceptions in navigator.canShare gracefully', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: vi.fn(),
          canShare: () => {
            throw new Error('Not supported');
          },
        },
        configurable: true,
        writable: true,
      });

      const caps = detectShareCapabilities();
      expect(caps.canShareFiles).toBe(false);
    });
  });

  describe('downloadPdfBlob', () => {
    it('creates an anchor element and triggers click', () => {
      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      downloadPdfBlob('blob:https://localhost/test', 'test-doc.pdf');

      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  describe('shareOrDownloadPdf', () => {
    const createMockDoc = (): GeneratedPdfDocument => {
      const blob = new Blob(['%PDF-1.4 test content'], { type: 'application/pdf' });
      const file = new File([blob], '7TIME_Receipt.pdf', { type: 'application/pdf' });
      return {
        blob,
        file,
        objectUrl: 'blob:https://localhost/receipt-uuid',
        filename: '7TIME_Receipt.pdf',
        title: '7TIME Receipt',
        metadata: {
          documentType: 'personal_ledger_receipt',
          documentCategory: 'RECEIPT',
          generatedAt: new Date().toISOString(),
          orientation: 'portrait',
          pageFormat: 'a4',
        },
        cleanup: vi.fn(),
      };
    };

    it('triggers navigator.share when mobile file sharing is fully supported', async () => {
      const shareSpy = vi.fn().mockResolvedValue(undefined);
      const canShareSpy = vi.fn().mockReturnValue(true);

      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareSpy,
          canShare: canShareSpy,
        },
        configurable: true,
        writable: true,
      });

      const mockDoc = createMockDoc();
      const result = await shareOrDownloadPdf(mockDoc, { text: 'Receipt from 7TIME' });

      expect(shareSpy).toHaveBeenCalledWith({
        title: '7TIME Receipt',
        text: 'Receipt from 7TIME',
        files: [mockDoc.file],
      });
      expect(result.status).toBe('shared');
      expect(result.method).toBe('web-share');
    });

    it('returns cancelled status when user dismisses the native share dialog (AbortError)', async () => {
      const abortError = new Error('Share cancelled');
      abortError.name = 'AbortError';

      const shareSpy = vi.fn().mockRejectedValue(abortError);
      const canShareSpy = vi.fn().mockReturnValue(true);

      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareSpy,
          canShare: canShareSpy,
        },
        configurable: true,
        writable: true,
      });

      const mockDoc = createMockDoc();
      const result = await shareOrDownloadPdf(mockDoc);

      expect(result.status).toBe('cancelled');
      expect(result.method).toBe('web-share');
    });

    it('falls back to programmatic download when Web Share is not supported', async () => {
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      // No share function
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const mockDoc = createMockDoc();
      const result = await shareOrDownloadPdf(mockDoc);

      expect(clickSpy).toHaveBeenCalled();
      expect(result.status).toBe('downloaded');
      expect(result.method).toBe('download');
    });
  });
});

