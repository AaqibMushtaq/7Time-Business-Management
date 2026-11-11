/**
 * 7TIME PDF Generation & Native Sharing Foundation
 * Core PDF Engine: dynamic loader, document initialization,
 * structured section renderers, table rendering & single-Blob lifecycle builder.
 */

import type { jsPDF as JsPdfType } from 'jspdf';
import type {
  GeneratedPdfDocument,
  PdfDocumentMetadata,
  PdfOrientation,
  PdfPageFormat,
} from './pdfTypes';
import { PDF_COLORS, PDF_LAYOUT } from './pdfBranding';
import { revokePdfDocument } from './pdfUtils';

export interface PdfEngineDependencies {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsPDF: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable?: any;
}

/** Cached module reference for fast subsequent document generation */
let cachedPdfDeps: PdfEngineDependencies | null = null;

/**
 * Dynamically loads jsPDF and jspdf-autotable asynchronously.
 * This guarantees that jsPDF is bundled in an isolated asynchronous chunk,
 * keeping the initial application bundle size completely unaffected.
 */
export async function loadPdfDependencies(): Promise<PdfEngineDependencies> {
  if (cachedPdfDeps) {
    return cachedPdfDeps;
  }

  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawJsPdf: any = jsPdfModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAutoTable: any = autoTableModule;

  const jsPdfConstructor =
    rawJsPdf.default?.jsPDF || rawJsPdf.jsPDF || rawJsPdf.default || rawJsPdf;
  const autoTableFn = rawAutoTable.default || rawAutoTable;

  cachedPdfDeps = {
    jsPDF: jsPdfConstructor,
    autoTable: autoTableFn,
  };

  return cachedPdfDeps;
}

export interface CreatePdfDocOptions {
  orientation?: PdfOrientation;
  format?: PdfPageFormat;
}

/**
 * Creates and initializes a new configured jsPDF instance with default styling.
 */
export async function createPdfInstance(options?: CreatePdfDocOptions): Promise<JsPdfType> {
  const { jsPDF } = await loadPdfDependencies();

  const doc = new jsPDF({
    orientation: options?.orientation || 'portrait',
    unit: 'mm',
    format: options?.format || 'a4',
    compress: true,
  });

  // Set default document properties
  doc.setProperties({
    creator: '7TIME Business Management',
    author: '7TIME Enterprise System',
  });

  return doc;
}

/**
 * Draws a clean, styled section heading in the PDF.
 * Returns the updated Y coordinate.
 */
export function addSectionHeading(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  title: string,
  startY: number
): number {
  const marginLeft = PDF_LAYOUT.marginLeft;
  const pageWidth =
    typeof doc?.internal?.pageSize?.getWidth === 'function'
      ? doc.internal.pageSize.getWidth()
      : PDF_LAYOUT.pageWidth;
  const contentWidth = pageWidth - marginLeft * 2;
  const rightX = marginLeft + contentWidth;

  const [navyR, navyG, navyB] = PDF_COLORS.primaryNavyRgb;
  doc.setTextColor(navyR, navyG, navyB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(title.toUpperCase(), marginLeft, startY);

  const [bordR, bordG, bordB] = PDF_COLORS.borderGrayRgb;
  doc.setDrawColor(bordR, bordG, bordB);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, startY + 2, rightX, startY + 2);

  return startY + 6;
}

export interface KeyValueItem {
  label: string;
  value: string;
}

/**
 * Draws a 2-column or 3-column key-value grid for metadata and summary blocks.
 * Returns the updated Y coordinate.
 */
export function addKeyValueGrid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  items: KeyValueItem[],
  startY: number,
  columns: 2 | 3 = 2
): number {
  const marginLeft = PDF_LAYOUT.marginLeft;
  const pageWidth =
    typeof doc?.internal?.pageSize?.getWidth === 'function'
      ? doc.internal.pageSize.getWidth()
      : PDF_LAYOUT.pageWidth;
  const contentWidth = pageWidth - marginLeft * 2;
  const colWidth = contentWidth / columns;
  const rowHeight = 7.5;

  let currentY = startY;

  for (let i = 0; i < items.length; i++) {
    const colIndex = i % columns;
    const rowIndex = Math.floor(i / columns);
    const itemY = startY + rowIndex * rowHeight;
    const itemX = marginLeft + colIndex * colWidth;

    const item = items[i];

    // Label
    const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;
    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${item.label}:`, itemX, itemY);

    // Value
    const labelWidth = doc.getTextWidth(`${item.label}: `);
    const [textR, textG, textB] = PDF_COLORS.textPrimaryRgb;
    doc.setTextColor(textR, textG, textB);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(item.value, itemX + labelWidth + 1, itemY);

    if (itemY + rowHeight > currentY) {
      currentY = itemY + rowHeight;
    }
  }

  return currentY + 2;
}

export interface RenderTableOptions {
  startY: number;
  head: string[][];
  body: (string | number)[][];
  foot?: (string | number)[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnStyles?: Record<number, any>;
  theme?: 'striped' | 'grid' | 'plain';
}

/**
 * Standardized table renderer using jspdf-autotable with 7TIME styling.
 * Returns the final Y coordinate after table completion.
 */
export async function renderTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  options: RenderTableOptions
): Promise<number> {
  const { autoTable } = await loadPdfDependencies();
  const { marginLeft } = PDF_LAYOUT;

  const [navyR, navyG, navyB] = PDF_COLORS.primaryNavyRgb;
  const [surfR, surfG, surfB] = PDF_COLORS.surfaceLightRgb;
  const [bordR, bordG, bordB] = PDF_COLORS.borderGrayRgb;
  const [textR, textG, textB] = PDF_COLORS.textPrimaryRgb;

  const tableConfig = {
    startY: options.startY,
    margin: { left: marginLeft, right: marginLeft },
    head: options.head,
    body: options.body,
    foot: options.foot,
    theme: options.theme || 'plain',
    headStyles: {
      fillColor: [navyR, navyG, navyB] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontSize: 8.5,
      fontStyle: 'bold' as const,
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: [textR, textG, textB] as [number, number, number],
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [surfR, surfG, surfB] as [number, number, number],
    },
    footStyles: {
      fillColor: [surfR, surfG, surfB] as [number, number, number],
      textColor: [navyR, navyG, navyB] as [number, number, number],
      fontSize: 8.5,
      fontStyle: 'bold' as const,
      cellPadding: 2.5,
      lineColor: [bordR, bordG, bordB] as [number, number, number],
      lineWidth: 0.2,
    },
    columnStyles: options.columnStyles || {},
  };

  if (typeof doc.autoTable === 'function') {
    doc.autoTable(tableConfig);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableConfig);
  } else {
    throw new Error('jspdf-autotable is not properly initialized on jsPDF instance');
  }

  // Retrieve the end Y coordinate from jsPDF autoTable instance state
  const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return lastAutoTable ? lastAutoTable.finalY + 5 : options.startY + 20;
}

/**
 * Builds the final GeneratedPdfDocument single-Blob result.
 * Produces:
 * - 1 raw binary Blob (application/pdf)
 * - 1 browser File ready for Web Share Level 2
 * - 1 Object URL for iframe/embed preview or programmatic download
 * - Idempotent cleanup function to release objectUrl memory
 */
export function buildGeneratedPdfDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  filename: string,
  title: string,
  metadata: PdfDocumentMetadata
): GeneratedPdfDocument {
  // Produce raw binary Blob
  const blobOutput = doc.output('blob');
  const blob = blobOutput instanceof Blob ? blobOutput : new Blob([blobOutput], { type: 'application/pdf' });

  // Produce Web Share Level 2 File
  const file = new File([blob], filename, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  // Produce reusable Object URL
  const objectUrl = URL.createObjectURL(blob);

  // Update page count in metadata if available
  const totalPages = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
  const enrichedMetadata: PdfDocumentMetadata = {
    ...metadata,
    pageCount: metadata.pageCount || totalPages,
  };

  // Safe idempotent cleanup closure
  let isRevoked = false;
  const cleanup = () => {
    if (isRevoked) return;
    isRevoked = true;
    revokePdfDocument(objectUrl);
  };

  return {
    blob,
    file,
    objectUrl,
    filename,
    title,
    metadata: enrichedMetadata,
    cleanup,
  };
}

