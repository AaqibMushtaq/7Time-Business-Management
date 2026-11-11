import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatPdfCurrency,
  formatPdfDate,
  formatPdfDateTime,
  generatePdfFilename,
  revokePdfDocument,
} from './pdfUtils';
import type { GeneratedPdfDocument } from './pdfTypes';

describe('pdfUtils', () => {
  describe('formatPdfCurrency', () => {
    it('formats 0 as Rs 0.00', () => {
      expect(formatPdfCurrency(0)).toBe('Rs 0.00');
    });

    it('formats null, undefined, and non-numeric strings as Rs 0.00', () => {
      expect(formatPdfCurrency(null)).toBe('Rs 0.00');
      expect(formatPdfCurrency(undefined)).toBe('Rs 0.00');
      expect(formatPdfCurrency('invalid-amount')).toBe('Rs 0.00');
      expect(formatPdfCurrency(NaN)).toBe('Rs 0.00');
    });

    it('formats standard positive numbers with 2-decimal bank precision', () => {
      expect(formatPdfCurrency(1234.5)).toBe('Rs 1,234.50');
      expect(formatPdfCurrency(50)).toBe('Rs 50.00');
    });

    it('formats large numbers with Indian grouping system', () => {
      expect(formatPdfCurrency(100000)).toBe('Rs 1,00,000.00');
      expect(formatPdfCurrency(10000000)).toBe('Rs 1,00,00,000.00');
    });

    it('formats negative numbers with clean leading minus sign', () => {
      expect(formatPdfCurrency(-500)).toBe('-Rs 500.00');
      expect(formatPdfCurrency(-12345.67)).toBe('-Rs 12,345.67');
    });

    it('parses numeric string inputs correctly', () => {
      expect(formatPdfCurrency('250.75')).toBe('Rs 250.75');
      expect(formatPdfCurrency('-99.9')).toBe('-Rs 99.90');
    });
  });

  describe('formatPdfDate', () => {
    it('formats a valid ISO date string', () => {
      const formatted = formatPdfDate('2026-11-10T00:00:00.000Z');
      expect(formatted).toMatch(/10.*Nov.*2026/);
    });

    it('formats a Date object', () => {
      const d = new Date(2026, 10, 10);
      const formatted = formatPdfDate(d);
      expect(formatted).toMatch(/10.*Nov.*2026/);
    });

    it('returns "-" for null, undefined, or invalid dates', () => {
      expect(formatPdfDate(null)).toBe('-');
      expect(formatPdfDate(undefined)).toBe('-');
      expect(formatPdfDate('invalid-date-string')).toBe('-');
    });
  });

  describe('formatPdfDateTime', () => {
    it('formats a date and time into readable format', () => {
      const d = new Date(2026, 10, 10, 14, 30);
      const formatted = formatPdfDateTime(d);
      expect(formatted).toMatch(/10.*Nov.*2026/);
      expect(formatted).toMatch(/2:30/);
    });

    it('returns "-" for invalid date inputs', () => {
      expect(formatPdfDateTime(null)).toBe('-');
      expect(formatPdfDateTime('not-a-date')).toBe('-');
    });
  });

  describe('generatePdfFilename', () => {
    it('generates filename with prefix, identifier, and date segment', () => {
      const filename = generatePdfFilename('7TIME_Receipt', 'TXN-101', '2026-11-10');
      expect(filename).toBe('7TIME_Receipt_TXN-101_20261110.pdf');
    });

    it('sanitizes illegal OS characters from prefix and identifier', () => {
      const filename = generatePdfFilename('Receipt/Invoice?*:', 'REF#123:45|6', '2026-11-10');
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('?');
      expect(filename).not.toContain('*');
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('|');
      expect(filename.endsWith('.pdf')).toBe(true);
    });

    it('uses current date when date parameter is omitted or invalid', () => {
      const filename = generatePdfFilename('Report', 'Q3');
      expect(filename.startsWith('Report_Q3_')).toBe(true);
      expect(filename.endsWith('.pdf')).toBe(true);
    });
  });

  describe('revokePdfDocument', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('invokes URL.revokeObjectURL for valid blob URL strings', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      revokePdfDocument('blob:https://localhost/test-uuid');
      expect(revokeSpy).toHaveBeenCalledWith('blob:https://localhost/test-uuid');
    });

    it('invokes URL.revokeObjectURL for document objects', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const mockDoc = { objectUrl: 'blob:https://localhost/mock-doc-uuid' } as GeneratedPdfDocument;
      revokePdfDocument(mockDoc);
      expect(revokeSpy).toHaveBeenCalledWith('blob:https://localhost/mock-doc-uuid');
    });

    it('safely handles null, undefined, and non-blob URLs without throwing', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      expect(() => revokePdfDocument(null)).not.toThrow();
      expect(() => revokePdfDocument(undefined)).not.toThrow();
      expect(() => revokePdfDocument('https://example.com/file.pdf')).not.toThrow();
      expect(revokeSpy).not.toHaveBeenCalled();
    });
  });
});

