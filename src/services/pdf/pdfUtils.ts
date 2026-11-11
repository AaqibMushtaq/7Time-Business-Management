/**
 * 7TIME PDF Generation & Native Sharing Foundation
 * Formatting and Utility Helpers
 */

import type { GeneratedPdfDocument } from './pdfTypes';

/**
 * Format monetary amounts for standard jsPDF fonts (Helvetica, Times, Courier).
 * Default jsPDF fonts use WinAnsi / Latin-1 encoding, which does NOT contain
 * the Unicode Indian Rupee symbol ₹ (U+20B9).
 *
 * This function guarantees safe, high-contrast ASCII currency output:
 * - 0 -> "Rs 0.00"
 * - 1234.5 -> "Rs 1,234.50"
 * - -500 -> "-Rs 500.00"
 * - 100000 -> "Rs 1,00,000.00" (Indian numbering system)
 */
export function formatPdfCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return 'Rs 0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return 'Rs 0.00';
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formattedNum = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absNum);

  return isNegative ? `-Rs ${formattedNum}` : `Rs ${formattedNum}`;
}

/**
 * Format a date string or Date object into human-readable date for PDF headers and tables.
 * Example: "10 Nov 2026"
 */
export function formatPdfDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date and time for PDF generation timestamps and audit footers.
 * Example: "10 Nov 2026, 09:30 PM"
 */
export function formatPdfDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Sanitizes a filename string by removing OS-restricted characters.
 */
export function sanitizeFilename(str: string): string {
  return str.replace(/[/\\?%*:|"<> ]/g, '_').replace(/_+/g, '_');
}

/**
 * Generates an authoritative, sanitized PDF filename.
 * Strips OS-restricted characters: \ / : * ? " < > |
 *
 * Example:
 * generatePdfFilename('7TIME_Receipt', 'TXN-001', '2026-11-10')
 * -> "7TIME_Receipt_TXN-001_20261110.pdf"
 */
export function generatePdfFilename(
  prefix: string,
  identifier?: string,
  dateOrTimestamp?: Date | string
): string {
  const sanitize = sanitizeFilename;

  const cleanPrefix = sanitize(prefix.trim() || '7TIME_Document');

  let dateSegment = '';
  if (dateOrTimestamp) {
    const d = typeof dateOrTimestamp === 'string' ? new Date(dateOrTimestamp) : dateOrTimestamp;
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateSegment = `${yyyy}${mm}${dd}`;
    }
  }

  if (!dateSegment) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    dateSegment = `${yyyy}${mm}${dd}`;
  }

  const parts = [cleanPrefix];
  if (identifier && identifier.trim()) {
    parts.push(sanitize(identifier.trim()));
  }
  parts.push(dateSegment);

  return `${parts.join('_')}.pdf`;
}

/**
 * Safely and idempotently revokes the object URL of a generated PDF document
 * to prevent browser memory leaks.
 */
export function revokePdfDocument(
  docOrUrl: Pick<GeneratedPdfDocument, 'objectUrl'> | string | null | undefined
): void {
  if (!docOrUrl) return;

  const url = typeof docOrUrl === 'string' ? docOrUrl : docOrUrl.objectUrl;
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignored if already revoked or invalid in environment
    }
  }
}

