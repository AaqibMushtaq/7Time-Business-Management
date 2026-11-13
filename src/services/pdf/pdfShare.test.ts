import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectShareCapabilities,
  downloadPdfBlob,
  shareOrDownloadPdf,
  sharePdfFile,
  canSharePdfFile,
  isValidPdfFile,
  hasPdfMagicBytes,
  validatePdfFile,
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

  describe('isValidPdfFile', () => {
    it('returns true for a genuine application/pdf File ending in .pdf with positive size', () => {
      const file = new File(['%PDF-1.4 test'], 'statement.pdf', { type: 'application/pdf' });
      expect(isValidPdfFile(file)).toBe(true);
    });

    it('returns false for undefined, null, or plain objects', () => {
      expect(isValidPdfFile(undefined)).toBe(false);
      expect(isValidPdfFile(null)).toBe(false);
      expect(isValidPdfFile({})).toBe(false);
    });

    it('returns false for non-pdf MIME types', () => {
      const file = new File(['%PDF-1.4 test'], 'statement.pdf', { type: 'text/plain' });
      expect(isValidPdfFile(file)).toBe(false);
    });

    it('returns false for filenames not ending in .pdf', () => {
      const file = new File(['%PDF-1.4 test'], 'statement.doc', { type: 'application/pdf' });
      expect(isValidPdfFile(file)).toBe(false);
    });

    it('returns false for empty files (size <= 0)', () => {
      const file = new File([], 'statement.pdf', { type: 'application/pdf' });
      expect(isValidPdfFile(file)).toBe(false);
    });
  });

  describe('hasPdfMagicBytes', () => {
    it('returns true when the binary starts with %PDF-', async () => {
      const file = new File(['%PDF-1.4 stream'], 'test.pdf', { type: 'application/pdf' });
      const result = await hasPdfMagicBytes(file);
      expect(result).toBe(true);
    });

    it('returns false when the binary does not start with %PDF-', async () => {
      const file = new File(['plain text content'], 'test.pdf', { type: 'application/pdf' });
      const result = await hasPdfMagicBytes(file);
      expect(result).toBe(false);
    });

    it('returns false for files shorter than 5 bytes', async () => {
      const file = new File(['%PD'], 'short.pdf', { type: 'application/pdf' });
      const result = await hasPdfMagicBytes(file);
      expect(result).toBe(false);
    });
  });

  describe('validatePdfFile', () => {
    it('returns isValid: true for authentic PDF with %PDF- header', async () => {
      const file = new File(['%PDF-1.7 genuine content'], 'valid.pdf', { type: 'application/pdf' });
      const result = await validatePdfFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns isValid: false when magic bytes are missing', async () => {
      const file = new File(['NOT-A-PDF-CONTENT'], 'corrupt.pdf', { type: 'application/pdf' });
      const result = await validatePdfFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('%PDF-');
    });

    it('returns isValid: false when file properties are invalid', async () => {
      const result = await validatePdfFile('not-a-file');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty application/pdf File');
    });
  });

  describe('canSharePdfFile', () => {
    it('returns true when Web Share, file sharing, and secure context are all available', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
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

      expect(canSharePdfFile()).toBe(true);
    });

    it('returns false when navigator.share is missing', () => {
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

      expect(canSharePdfFile()).toBe(false);
    });
  });

  describe('sharePdfFile', () => {
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

    it('invokes navigator.share with generated File and does NOT trigger download', async () => {
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

      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const mockDoc = createMockDoc();
      const result = await sharePdfFile(mockDoc);

      expect(shareSpy).toHaveBeenCalledWith({
        title: mockDoc.file.name,
        files: [mockDoc.file],
      });
      expect(clickSpy).not.toHaveBeenCalled();
      expect(result.status).toBe('shared');
      expect(result.method).toBe('web-share');
    });

    it('returns cancelled when user cancels share sheet without triggering a download', async () => {
      const abortError = new Error('Share dismissed');
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

      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const mockDoc = createMockDoc();
      const result = await sharePdfFile(mockDoc);

      expect(result.status).toBe('cancelled');
      expect(result.method).toBe('web-share');
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('returns unsupported when file sharing is unavailable without triggering a download', async () => {
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });

      // Unsupported browser
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
      const result = await sharePdfFile(mockDoc);

      expect(result.status).toBe('unsupported');
      expect(result.method).toBe('unsupported');
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('fails when the PDF file lacks %PDF- magic bytes', async () => {
      const corruptBlob = new Blob(['corrupt-non-pdf-bytes'], { type: 'application/pdf' });
      const corruptFile = new File([corruptBlob], 'bad.pdf', { type: 'application/pdf' });
      const badDoc: GeneratedPdfDocument = {
        ...createMockDoc(),
        file: corruptFile,
        blob: corruptBlob,
      };

      const result = await sharePdfFile(badDoc);
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('%PDF-');
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
        title: mockDoc.file.name,
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

    it('falls back to programmatic download when Web Share is not supported and fallbackToDownload is true', async () => {
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
      const result = await shareOrDownloadPdf(mockDoc, { fallbackToDownload: true });

      expect(clickSpy).toHaveBeenCalled();
      expect(result.status).toBe('downloaded');
      expect(result.method).toBe('download');
    });
  });
});

