/**
 * 7TIME PDF Generation — Personal Ledger Templates
 * Produces authoritative Personal Ledger Statements and Individual Transaction Receipts.
 */

import type {
  GeneratedPdfDocument,
  PdfDocumentMetadata,
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
  PDF_COLORS,
} from '../pdfBranding';
import {
  formatPdfCurrency,
  formatPdfDate,
  sanitizeFilename,
} from '../pdfUtils';
import type {
  PersonalTransaction,
  PersonalLedgerSummary,
  UnifiedPersonalEntry,
} from '@/services/personalLedger';

export interface PersonalLedgerStatementParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  dateRangeLabel?: string;
  entries: (PersonalTransaction | UnifiedPersonalEntry)[];
  summary: PersonalLedgerSummary;
}

export interface PersonalTransactionReceiptParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  transaction: PersonalTransaction;
}

/**
 * Generates an authoritative multi-page Personal Ledger Statement PDF.
 */
export async function generatePersonalLedgerStatementPdf(
  params: PersonalLedgerStatementParams
): Promise<GeneratedPdfDocument> {
  const doc = await createPdfInstance({ orientation: 'portrait' });
  const generatedAt = new Date().toISOString();

  // 1. Draw Page 1 Document Header
  let currentY = drawDocumentHeader(doc, {
    title: 'Personal Ledger Statement',
    subtitle: `Workspace: ${params.workspaceName}${
      params.dateRangeLabel ? ` • Period: ${params.dateRangeLabel}` : ''
    }`,
    workspaceName: params.workspaceName,
    date: generatedAt,
    category: 'STATEMENT',
    referenceNumber: `PLS-${params.workspaceId.slice(0, 8).toUpperCase()}`,
  });

  // 2. Summary Overview Block
  currentY = addSectionHeading(doc, 'Financial Summary Overview', currentY);

  const summaryGrid = [
    { label: 'Total Inflow (Income)', value: formatPdfCurrency(params.summary.totalIncome) },
    { label: 'Total Outflow (Expense)', value: formatPdfCurrency(params.summary.totalExpense) },
    { label: 'Net Available Balance', value: formatPdfCurrency(params.summary.netBalance) },
    {
      label: 'Qarz Given (Receivable)',
      value: formatPdfCurrency(params.summary.qarz?.outstandingReceivables ?? 0),
    },
    {
      label: 'Qarz Taken (Payable)',
      value: formatPdfCurrency(params.summary.qarz?.outstandingPayables ?? 0),
    },
    {
      label: 'Total Entries in Period',
      value: `${params.entries.length} records`,
    },
  ];

  currentY = addKeyValueGrid(doc, summaryGrid, currentY, 3);
  currentY += 4;

  // 3. Transactions Table
  currentY = addSectionHeading(doc, 'Detailed Ledger Records', currentY);

  const tableHead = [
    ['Date', 'Type', 'Category', 'Particulars / Description', 'Account', 'In (Rs)', 'Out (Rs)'],
  ];

  const tableBody = params.entries.map((entry) => {
    const isUnified = 'type' in entry && typeof (entry as UnifiedPersonalEntry).type === 'string';
    const rawType = isUnified
      ? (entry as UnifiedPersonalEntry).type
      : (entry as PersonalTransaction).entry_type;
    const date = 'date' in entry ? (entry as UnifiedPersonalEntry).date : (entry as PersonalTransaction).transaction_date;
    const particulars = entry.particulars || '-';
    const category = entry.category || '-';
    const account = entry.account || '-';
    const amount = entry.amount;

    let inAmount = '-';
    let outAmount = '-';

    if (rawType === 'INCOME' || rawType === 'REPAYMENT_RECEIVED') {
      inAmount = formatPdfCurrency(amount);
    } else if (rawType === 'EXPENSE' || rawType === 'QARZ_GIVEN' || rawType === 'REPAYMENT_PAID') {
      outAmount = formatPdfCurrency(amount);
    } else if (rawType === 'QARZ_RECEIVED') {
      inAmount = formatPdfCurrency(amount);
    } else {
      // TRANSFER
      outAmount = formatPdfCurrency(amount);
    }

    return [
      formatPdfDate(date),
      rawType.replace('_', ' '),
      category,
      particulars,
      account,
      inAmount,
      outAmount,
    ];
  });

  const tableFoot = [
    [
      'Total',
      '',
      '',
      '',
      '',
      formatPdfCurrency(params.summary.totalIncome),
      formatPdfCurrency(params.summary.totalExpense),
    ],
  ];

  await renderTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody.length > 0 ? tableBody : [['-', '-', '-', 'No records found in selected range', '-', '-', '-']],
    foot: tableFoot,
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 22 }, // Type
      2: { cellWidth: 24 }, // Category
      3: { cellWidth: 'auto' }, // Particulars
      4: { cellWidth: 24 }, // Account
      5: { cellWidth: 24, halign: 'right' }, // In
      6: { cellWidth: 24, halign: 'right' }, // Out
    },
  });

  // 4. Draw Footer on all pages
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: '7TIME Personal Ledger • Confidential Accounting Statement',
    generatedBy: params.generatedBy,
  });

  // 5. Build Generated Document
  const filename = sanitizeFilename(
    `7TIME_Personal_Statement_${params.workspaceName}_${formatPdfDate(new Date())}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'personal_ledger_statement',
    documentCategory: 'STATEMENT',
    generatedAt,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    orientation: 'portrait',
    pageFormat: 'a4',
  };

  return buildGeneratedPdfDocument(
    doc,
    filename,
    'Personal Ledger Statement',
    metadata
  );
}

/**
 * Generates an authoritative single-page Personal Transaction Receipt PDF.
 */
export async function generatePersonalTransactionReceiptPdf(
  params: PersonalTransactionReceiptParams
): Promise<GeneratedPdfDocument> {
  const doc = await createPdfInstance({ orientation: 'portrait' });
  const tx = params.transaction;
  const generatedAt = new Date().toISOString();

  const refNumber = `TX-${tx.id.slice(0, 8).toUpperCase()}`;

  // 1. Draw Header
  let currentY = drawDocumentHeader(doc, {
    title: `${tx.entry_type} Receipt`,
    subtitle: `Workspace: ${params.workspaceName}`,
    workspaceName: params.workspaceName,
    date: tx.transaction_date,
    category: 'RECEIPT',
    referenceNumber: refNumber,
  });

  // 2. Prominent Amount Card Banner
  const { marginLeft, contentWidth } = { marginLeft: 14, contentWidth: 182 };
  const bannerHeight = 24;
  const bannerY = currentY;

  // Background box
  const [surfR, surfG, surfB] = PDF_COLORS.surfaceLightRgb;
  const [bordR, bordG, bordB] = PDF_COLORS.borderGrayRgb;
  doc.setFillColor(surfR, surfG, surfB);
  doc.setDrawColor(bordR, bordG, bordB);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, bannerY, contentWidth, bannerHeight, 2, 2, 'FD');

  // Amount Label
  const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('TOTAL AMOUNT TRANSACTED', marginLeft + 6, bannerY + 7);

  // Formatted Amount
  const [navyR, navyG, navyB] = PDF_COLORS.primaryNavyRgb;
  doc.setTextColor(navyR, navyG, navyB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(formatPdfCurrency(tx.amount), marginLeft + 6, bannerY + 17);

  // Type Pill on the right side of the banner
  const typeText = tx.entry_type.toUpperCase();
  doc.setFontSize(9);
  const typeWidth = doc.getTextWidth(typeText) + 8;
  const typeX = marginLeft + contentWidth - typeWidth - 6;
  const typeY = bannerY + 7;

  let pillBgRgb = PDF_COLORS.accentBlueRgb;
  if (tx.entry_type === 'INCOME') pillBgRgb = PDF_COLORS.successEmeraldRgb;
  else if (tx.entry_type === 'EXPENSE') pillBgRgb = [190, 18, 60]; // Rose-700

  doc.setFillColor(pillBgRgb[0], pillBgRgb[1], pillBgRgb[2]);
  doc.roundedRect(typeX, typeY, typeWidth, 8, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(typeText, typeX + 4, typeY + 5.5);

  currentY = bannerY + bannerHeight + 8;

  // 3. Transaction Details Key-Value Section
  currentY = addSectionHeading(doc, 'Transaction Details', currentY);

  const detailsList = [
    { label: 'Transaction ID', value: tx.id },
    { label: 'Date', value: formatPdfDate(tx.transaction_date) },
    { label: 'Transaction Type', value: tx.entry_type },
    { label: 'Category', value: tx.category || 'General' },
    { label: 'Payment Account', value: tx.account || 'Primary' },
    ...(tx.to_account ? [{ label: 'Transfer Destination', value: tx.to_account }] : []),
    { label: 'Particulars', value: tx.particulars || '-' },
    { label: 'Notes / Remarks', value: tx.notes || 'None recorded' },
  ];

  currentY = addKeyValueGrid(doc, detailsList, currentY, 2);
  currentY += 8;

  // 4. Verification & Audit Footnote
  currentY = addSectionHeading(doc, 'Verification & Record Status', currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.text(
    'This electronic receipt is an authoritative bookkeeping voucher generated from the 7TIME Personal Ledger system.',
    marginLeft,
    currentY
  );
  doc.text(
    'It serves as a verified record of the individual financial transaction logged in the workspace.',
    marginLeft,
    currentY + 4
  );

  // 5. Draw Footer
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: '7TIME Enterprise System • Personal Transaction Voucher',
    generatedBy: params.generatedBy,
  });

  const filename = sanitizeFilename(
    `7TIME_Receipt_${refNumber}_${formatPdfDate(tx.transaction_date)}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'personal_ledger_receipt',
    documentCategory: 'RECEIPT',
    generatedAt,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    recordId: tx.id,
    orientation: 'portrait',
    pageFormat: 'a4',
  };

  return buildGeneratedPdfDocument(
    doc,
    filename,
    `${tx.entry_type} Receipt: ${formatPdfCurrency(tx.amount)}`,
    metadata
  );
}

