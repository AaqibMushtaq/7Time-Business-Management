/**
 * 7TIME PDF Generation — Reports Template
 * Generates authoritative, formatted multi-page Business Reports for all modules:
 * Purchases, Wholesale Sales, Inventory, Dealer Payments, Reseller Payments, Personal Ledger, and Deliveries.
 */

import type {
  GeneratedPdfDocument,
  PdfDocumentMetadata,
  PdfOrientation,
} from '../pdfTypes';
import {
  createPdfInstance,
  addSectionHeading,
  addKeyValueGrid,
  renderTable,
  buildGeneratedPdfDocument,
} from '../pdfEngine';
import {
  drawDocumentHeader,
  drawDocumentFooter,
} from '../pdfBranding';
import {
  formatPdfDate,
  sanitizeFilename,
} from '../pdfUtils';

export interface BusinessReportPdfParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  reportType: string;
  reportTitle: string;
  dateRangeLabel?: string;
  head: string[][];
  body: (string | number)[][] ;
  foot?: (string | number)[][];
  summaryCards?: { label: string; value: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnStyles?: Record<number, any>;
  orientation?: PdfOrientation;
}

/**
 * Generates an authoritative multi-page formatted Business Report PDF.
 */
export async function generateBusinessReportPdf(
  params: BusinessReportPdfParams
): Promise<GeneratedPdfDocument> {
  const columnCount = params.head[0]?.length || 0;
  // Automatically choose landscape orientation for wide tabular reports (>= 7 columns)
  const chosenOrientation: PdfOrientation =
    params.orientation || (columnCount >= 7 ? 'landscape' : 'portrait');

  const doc = await createPdfInstance({ orientation: chosenOrientation });
  const generatedAt = new Date().toISOString();

  const refNumber = `REP-${params.reportType.slice(0, 6).toUpperCase()}-${formatPdfDate(new Date()).replace(/ /g, '')}`;

  // 1. Draw Page 1 Header
  let currentY = drawDocumentHeader(doc, {
    title: params.reportTitle,
    subtitle: `Workspace: ${params.workspaceName}${
      params.dateRangeLabel ? ` • Period: ${params.dateRangeLabel}` : ''
    }`,
    workspaceName: params.workspaceName,
    date: generatedAt,
    category: 'REPORT',
    referenceNumber: refNumber,
  });

  // 2. Summary Overview (if provided)
  if (params.summaryCards && params.summaryCards.length > 0) {
    currentY = addSectionHeading(doc, 'Report Summary Metrics', currentY);
    currentY = addKeyValueGrid(
      doc,
      params.summaryCards,
      currentY,
      chosenOrientation === 'landscape' ? 3 : 2
    );
    currentY += 4;
  }

  // 3. Tabular Report Data
  currentY = addSectionHeading(
    doc,
    `Tabular Data (${params.body.length} records)`,
    currentY
  );

  await renderTable(doc, {
    startY: currentY,
    head: params.head,
    body:
      params.body.length > 0
        ? params.body
        : [new Array(columnCount).fill('-').map((v, i) => (i === 0 ? 'No records' : v))],
    foot: params.foot,
    columnStyles: params.columnStyles,
  });

  // 4. Footer across all pages
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: `7TIME Enterprise System • ${params.reportTitle} • Official Business Report`,
    generatedBy: params.generatedBy,
  });

  const filename = sanitizeFilename(
    `7TIME_Report_${params.reportType}_${formatPdfDate(new Date())}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'business_report',
    documentCategory: 'REPORT',
    generatedAt,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    orientation: chosenOrientation,
    pageFormat: 'a4',
  };

  return buildGeneratedPdfDocument(
    doc,
    filename,
    params.reportTitle,
    metadata
  );
}

