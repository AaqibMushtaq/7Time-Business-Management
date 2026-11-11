import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildGeneratedPdfDocument,
  addSectionHeading,
  addKeyValueGrid,
  renderTable,
  loadPdfDependencies,
} from './pdfEngine';
import type { PdfDocumentMetadata } from './pdfTypes';

describe('pdfEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildGeneratedPdfDocument', () => {
    it('creates a single-Blob result with File, objectUrl, and idempotent cleanup', () => {
      const mockBlob = new Blob(['%PDF-1.4 mock binary content'], { type: 'application/pdf' });
      const mockDoc = {
        output: vi.fn().mockReturnValue(mockBlob),
        getNumberOfPages: vi.fn().mockReturnValue(2),
      };

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const createObjectUrlSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:https://localhost/mock-uuid-1234');

      const metadata: PdfDocumentMetadata = {
        documentType: 'personal_ledger_receipt',
        documentCategory: 'RECEIPT',
        generatedAt: '2026-11-10T12:00:00.000Z',
        orientation: 'portrait',
        pageFormat: 'a4',
      };

      const result = buildGeneratedPdfDocument(
        mockDoc,
        '7TIME_Receipt_TXN-001_20261110.pdf',
        '7TIME Receipt #TXN-001',
        metadata
      );

      // Verify blob and file
      expect(result.blob).toBeDefined();
      expect(result.file).toBeInstanceOf(File);
      expect(result.file.name).toBe('7TIME_Receipt_TXN-001_20261110.pdf');
      expect(result.file.type).toBe('application/pdf');

      // Verify objectUrl creation
      expect(createObjectUrlSpy).toHaveBeenCalledWith(result.blob);
      expect(result.objectUrl).toBe('blob:https://localhost/mock-uuid-1234');

      // Verify metadata enrichment
      expect(result.metadata.pageCount).toBe(2);

      // Verify idempotent cleanup
      expect(revokeSpy).not.toHaveBeenCalled();
      result.cleanup();
      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:https://localhost/mock-uuid-1234');

      // Second cleanup call should be safely ignored
      result.cleanup();
      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('addSectionHeading', () => {
    it('draws uppercase title and divider rule', () => {
      const mockDoc = {
        setTextColor: vi.fn(),
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        text: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        line: vi.fn(),
      };

      const nextY = addSectionHeading(mockDoc, 'Transaction Summary', 40);

      expect(mockDoc.text).toHaveBeenCalledWith(
        'TRANSACTION SUMMARY',
        expect.any(Number),
        40
      );
      expect(mockDoc.line).toHaveBeenCalled();
      expect(nextY).toBe(46);
    });
  });

  describe('addKeyValueGrid', () => {
    it('draws key-value pairs across 2 columns', () => {
      const mockDoc = {
        setTextColor: vi.fn(),
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        text: vi.fn(),
        getTextWidth: vi.fn().mockReturnValue(20),
      };

      const items = [
        { label: 'Name', value: 'Jane Doe' },
        { label: 'Phone', value: '+91 9876543210' },
        { label: 'Balance', value: 'Rs 1,500.00' },
      ];

      const nextY = addKeyValueGrid(mockDoc, items, 50, 2);

      expect(mockDoc.text).toHaveBeenCalledWith('Name:', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Jane Doe', expect.any(Number), expect.any(Number));
      expect(nextY).toBeGreaterThan(50);
    });
  });

  describe('renderTable', () => {
    it('calls autoTable with 7TIME styling', async () => {
      const mockAutoTable = vi.fn();
      const mockDoc = {
        autoTable: mockAutoTable,
        lastAutoTable: { finalY: 120 },
      };

      const finalY = await renderTable(mockDoc, {
        startY: 50,
        head: [['Date', 'Description', 'Amount']],
        body: [['10 Nov 2026', 'Payment', 'Rs 500.00']],
      });

      expect(mockAutoTable).toHaveBeenCalledWith(
        expect.objectContaining({
          startY: 50,
          head: [['Date', 'Description', 'Amount']],
          body: [['10 Nov 2026', 'Payment', 'Rs 500.00']],
        })
      );
      expect(finalY).toBe(125);
    });
  });

  describe('loadPdfDependencies', () => {
    it('is a callable asynchronous function', async () => {
      expect(typeof loadPdfDependencies).toBe('function');
    });
  });
});

