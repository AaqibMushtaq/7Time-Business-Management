/**
 * 7TIME PDF Generation & Native Sharing Foundation
 * 7TIME Brand Palette, Typography, Header & Footer Layouts
 */

import type { DocumentHeaderOptions, DocumentFooterOptions } from './pdfTypes';
import { formatPdfDate } from './pdfUtils';

/**
 * Authoritative 7TIME corporate color palette for PDF document rendering.
 * Supports both Hex strings and RGB tuples for direct jsPDF setTextColor/setFillColor calls.
 */
export const PDF_COLORS = {
  primaryNavy: '#172B4D',
  primaryNavyRgb: [23, 43, 77] as [number, number, number],

  accentBlue: '#2563EB',
  accentBlueRgb: [37, 99, 235] as [number, number, number],

  textPrimary: '#0F172A',
  textPrimaryRgb: [15, 23, 42] as [number, number, number],

  textMuted: '#64748B',
  textMutedRgb: [100, 116, 139] as [number, number, number],

  borderGray: '#E2E8F0',
  borderGrayRgb: [226, 232, 240] as [number, number, number],

  surfaceLight: '#F8FAFC',
  surfaceLightRgb: [248, 250, 252] as [number, number, number],

  successEmerald: '#087443',
  successEmeraldRgb: [8, 116, 67] as [number, number, number],

  warningAmber: '#B45309',
  warningAmberRgb: [180, 83, 9] as [number, number, number],

  dangerRose: '#BE123C',
  dangerRoseRgb: [190, 18, 60] as [number, number, number],

  white: '#FFFFFF',
  whiteRgb: [255, 255, 255] as [number, number, number],
};

/**
 * Standard PDF layout measurements in millimeters (A4 format: 210mm x 297mm).
 */
export const PDF_LAYOUT = {
  pageWidth: 210,
  pageHeight: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 15,
  get contentWidth(): number {
    return this.pageWidth - this.marginLeft - this.marginRight;
  },
};

/**
 * Draws the 7TIME corporate header with brand identity, document title, and reference details.
 * Returns the Y-coordinate where subsequent content/tables should begin.
 */
export function drawDocumentHeader(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  options: DocumentHeaderOptions
): number {
  const marginLeft = PDF_LAYOUT.marginLeft;
  const pageWidth =
    typeof doc?.internal?.pageSize?.getWidth === 'function'
      ? doc.internal.pageSize.getWidth()
      : PDF_LAYOUT.pageWidth;
  const contentWidth = pageWidth - marginLeft * 2;
  const startY = 16;
  const rightX = marginLeft + contentWidth;

  // 1. Draw 7TIME Brand Mark (Vector badge)
  const badgeWidth = 22;
  const badgeHeight = 9;
  const [navyR, navyG, navyB] = PDF_COLORS.primaryNavyRgb;
  doc.setFillColor(navyR, navyG, navyB);
  doc.roundedRect(marginLeft, startY, badgeWidth, badgeHeight, 1.5, 1.5, 'F');

  // Brand Name inside badge
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('7TIME', marginLeft + 2.5, startY + 6.2);

  // Brand Subtitle
  const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BUSINESS MANAGEMENT', marginLeft + badgeWidth + 3, startY + 6);

  // 2. Right-hand Category Badge (if provided)
  let headerRightY = startY + 5;
  if (options.category) {
    const categoryText = options.category.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const textWidth = doc.getTextWidth(categoryText);
    const pillPadding = 3;
    const pillWidth = textWidth + pillPadding * 2;
    const pillHeight = 6;
    const pillX = rightX - pillWidth;
    const pillY = startY;

    // Pill background
    const [surfR, surfG, surfB] = PDF_COLORS.surfaceLightRgb;
    const [bordR, bordG, bordB] = PDF_COLORS.borderGrayRgb;
    doc.setFillColor(surfR, surfG, surfB);
    doc.setDrawColor(bordR, bordG, bordB);
    doc.setLineWidth(0.2);
    doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 1, 1, 'FD');

    // Pill text
    const [accR, accG, accB] = PDF_COLORS.accentBlueRgb;
    doc.setTextColor(accR, accG, accB);
    doc.text(categoryText, pillX + pillPadding, pillY + 4.2);

    headerRightY = pillY + pillHeight + 3;
  }

  // 3. Document Title
  const titleY = startY + 16;
  const [textPrimR, textPrimG, textPrimB] = PDF_COLORS.textPrimaryRgb;
  doc.setTextColor(textPrimR, textPrimG, textPrimB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(options.title, marginLeft, titleY);

  // Subtitle / Workspace Name
  let currentY = titleY;
  if (options.subtitle || options.workspaceName) {
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedR, mutedG, mutedB);
    const subText = options.subtitle || `Workspace: ${options.workspaceName}`;
    doc.text(subText, marginLeft, currentY);
  }

  // 4. Reference Number & Date on right side
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedR, mutedG, mutedB);

  const metaRightLines: string[] = [];
  if (options.referenceNumber) {
    metaRightLines.push(`Ref: ${options.referenceNumber}`);
  }
  if (options.date) {
    metaRightLines.push(`Date: ${formatPdfDate(options.date)}`);
  }

  let metaY = headerRightY > titleY - 4 ? headerRightY : titleY - 2;
  for (const line of metaRightLines) {
    doc.text(line, rightX, metaY, { align: 'right' });
    metaY += 4.5;
  }

  currentY = Math.max(currentY, metaY) + 3;

  // 5. Divider Rule
  const [lineR, lineG, lineB] = PDF_COLORS.borderGrayRgb;
  doc.setDrawColor(lineR, lineG, lineB);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, currentY, rightX, currentY);

  // Return the Y position for subsequent content (+ 5mm padding)
  return currentY + 6;
}

/**
 * Draws the 7TIME corporate footer on every page of the document.
 * Safe to call at the end of PDF generation.
 */
export function drawDocumentFooter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  options?: DocumentFooterOptions
): void {
  const marginLeft = PDF_LAYOUT.marginLeft;
  const pageWidth =
    typeof doc?.internal?.pageSize?.getWidth === 'function'
      ? doc.internal.pageSize.getWidth()
      : PDF_LAYOUT.pageWidth;
  const pageHeight =
    typeof doc?.internal?.pageSize?.getHeight === 'function'
      ? doc.internal.pageSize.getHeight()
      : PDF_LAYOUT.pageHeight;
  const contentWidth = pageWidth - marginLeft * 2;
  const rightX = marginLeft + contentWidth;
  const footerLineY = pageHeight - 14;
  const textY = pageHeight - 9;

  const totalPages = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (typeof doc.setPage === 'function') {
      doc.setPage(pageNum);
    }

    // Divider Line
    const [lineR, lineG, lineB] = PDF_COLORS.borderGrayRgb;
    doc.setDrawColor(lineR, lineG, lineB);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, footerLineY, rightX, footerLineY);

    // Footer Text Styling
    const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;
    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    // Left text: Confidentiality / electronic generation notice
    const leftText =
      options?.confidentialityNotice ||
      'Generated by 7TIME Business Management • Electronic Record';
    doc.text(leftText, marginLeft, textY);

    // Right text: Page Numbers
    if (options?.includePageNumbers !== false) {
      const pageText = `Page ${pageNum} of ${totalPages}`;
      doc.text(pageText, rightX, textY, { align: 'right' });
    }
  }
}

