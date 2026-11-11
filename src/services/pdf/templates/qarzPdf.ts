/**
 * 7TIME PDF Generation — Qarz-e-Hasana Templates
 * Produces authoritative Qarz-e-Hasana Portfolio Statements and Individual Loan/Repayment Vouchers.
 * Fully compliant with Islamic ethical principles (prohibition of Riba).
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
  PersonalQarzEntry,
  PersonalLedgerSummary,
} from '@/services/personalLedger';

export interface QarzStatementParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  dateRangeLabel?: string;
  qarzEntries: PersonalQarzEntry[];
  summary?: PersonalLedgerSummary['qarz'];
}

export interface QarzReceiptParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  qarzEntry: PersonalQarzEntry;
}

const ISLAMIC_QARZ_DISCLOSURE =
  'This electronic document records interest-free benevolent loans (Qard Hasan) in accordance with Islamic ethical financial principles strictly prohibiting interest (Riba). It serves as an internal bookkeeping record of mutual trust and financial transparency, not a commercial loan contract or negotiable financial instrument.';

/**
 * Generates an authoritative multi-page Qarz-e-Hasana Portfolio Statement PDF.
 */
export async function generateQarzStatementPdf(
  params: QarzStatementParams
): Promise<GeneratedPdfDocument> {
  const doc = await createPdfInstance({ orientation: 'portrait' });
  const generatedAt = new Date().toISOString();

  // Compute summary metrics if not provided
  const totalGiven = params.summary?.totalGiven ?? params.qarzEntries
    .filter((q) => q.direction === 'GIVEN')
    .reduce((sum, q) => sum + q.original_amount, 0);

  const totalReceived = params.summary?.totalReceived ?? params.qarzEntries
    .filter((q) => q.direction === 'RECEIVED')
    .reduce((sum, q) => sum + q.original_amount, 0);

  const outstandingReceivables = params.summary?.outstandingReceivables ?? params.qarzEntries
    .filter((q) => q.direction === 'GIVEN')
    .reduce((sum, q) => sum + q.balance, 0);

  const outstandingPayables = params.summary?.outstandingPayables ?? params.qarzEntries
    .filter((q) => q.direction === 'RECEIVED')
    .reduce((sum, q) => sum + q.balance, 0);

  // 1. Draw Page 1 Header
  let currentY = drawDocumentHeader(doc, {
    title: 'Qarz-e-Hasana Statement',
    subtitle: `Workspace: ${params.workspaceName}${
      params.dateRangeLabel ? ` • Period: ${params.dateRangeLabel}` : ''
    }`,
    workspaceName: params.workspaceName,
    date: generatedAt,
    category: 'STATEMENT',
    referenceNumber: `QARZ-${params.workspaceId.slice(0, 8).toUpperCase()}`,
  });

  // 2. Summary Overview Cards
  currentY = addSectionHeading(doc, 'Benevolent Loan Summary (Qard Hasan)', currentY);

  const summaryGrid = [
    { label: 'Total Qarz Given (Disbursed)', value: formatPdfCurrency(totalGiven) },
    { label: 'Outstanding Receivables (Given)', value: formatPdfCurrency(outstandingReceivables) },
    { label: 'Total Qarz Received (Borrowed)', value: formatPdfCurrency(totalReceived) },
    { label: 'Outstanding Payables (Received)', value: formatPdfCurrency(outstandingPayables) },
    { label: 'Total Qarz Accounts', value: `${params.qarzEntries.length} records` },
    {
      label: 'Settled Accounts',
      value: `${params.qarzEntries.filter((q) => q.balance <= 0 || q.status === 'FULLY_SETTLED').length} settled`,
    },
  ];

  currentY = addKeyValueGrid(doc, summaryGrid, currentY, 2);
  currentY += 4;

  // 3. Qarz Entries Table
  currentY = addSectionHeading(doc, 'Loan Portfolios & Counterparties', currentY);

  const tableHead = [
    ['Date', 'Direction', 'Person / Counterparty', 'Account', 'Initial (Rs)', 'Repaid (Rs)', 'Balance (Rs)', 'Status'],
  ];

  const tableBody = params.qarzEntries.map((q) => {
    const isGiven = q.direction === 'GIVEN';
    const directionLabel = isGiven ? 'Given (Receivable)' : 'Received (Payable)';
    const statusLabel =
      q.balance <= 0 || q.status === 'FULLY_SETTLED'
        ? 'Settled'
        : q.status === 'PARTIALLY_REPAID'
        ? 'Partial'
        : 'Active';

    return [
      formatPdfDate(q.transaction_date),
      directionLabel,
      q.person_name,
      q.account || '-',
      formatPdfCurrency(q.original_amount),
      formatPdfCurrency(q.amount_repaid || 0),
      formatPdfCurrency(q.balance),
      statusLabel,
    ];
  });

  const totalBalance = outstandingReceivables + outstandingPayables;
  const tableFoot = [
    [
      'Total',
      '',
      '',
      '',
      formatPdfCurrency(totalGiven + totalReceived),
      '',
      formatPdfCurrency(totalBalance),
      '',
    ],
  ];

  await renderTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody.length > 0 ? tableBody : [['-', '-', 'No Qarz records found', '-', '-', '-', '-', '-']],
    foot: tableFoot,
    columnStyles: {
      0: { cellWidth: 20 }, // Date
      1: { cellWidth: 28 }, // Direction
      2: { cellWidth: 'auto' }, // Person
      3: { cellWidth: 20 }, // Account
      4: { cellWidth: 22, halign: 'right' }, // Initial
      5: { cellWidth: 20, halign: 'right' }, // Repaid
      6: { cellWidth: 22, halign: 'right' }, // Balance
      7: { cellWidth: 18, halign: 'center' }, // Status
    },
  });

  // 4. Ethical Disclosure Section
  const { marginLeft, contentWidth } = { marginLeft: 14, contentWidth: 182 };
  const discY = doc.internal.pageSize.getHeight() - 28;
  const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    doc.splitTextToSize(ISLAMIC_QARZ_DISCLOSURE, contentWidth),
    marginLeft,
    discY
  );

  // 5. Corporate Footer
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: '7TIME Qarz-e-Hasana Ledger • Interest-Free Benevolent Record',
    generatedBy: params.generatedBy,
  });

  const filename = sanitizeFilename(
    `7TIME_Qarz_Statement_${params.workspaceName}_${formatPdfDate(new Date())}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'qarz_statement',
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
    'Qarz-e-Hasana Portfolio Statement',
    metadata
  );
}

/**
 * Generates an authoritative single/multi-page Qarz-e-Hasana Loan & Repayment Receipt PDF.
 */
export async function generateQarzReceiptPdf(
  params: QarzReceiptParams
): Promise<GeneratedPdfDocument> {
  const doc = await createPdfInstance({ orientation: 'portrait' });
  const q = params.qarzEntry;
  const generatedAt = new Date().toISOString();
  const isGiven = q.direction === 'GIVEN';

  const refNumber = `QZ-${q.id.slice(0, 8).toUpperCase()}`;
  const directionTitle = isGiven ? 'Qarz-e-Hasana Disbursement' : 'Qarz-e-Hasana Receipt';

  // 1. Draw Document Header
  let currentY = drawDocumentHeader(doc, {
    title: directionTitle,
    subtitle: `Counterparty: ${q.person_name} • Workspace: ${params.workspaceName}`,
    workspaceName: params.workspaceName,
    date: q.transaction_date,
    category: 'ACKNOWLEDGEMENT',
    referenceNumber: refNumber,
  });

  // 2. Financial Balance Summary Banner
  const { marginLeft, contentWidth } = { marginLeft: 14, contentWidth: 182 };
  const bannerHeight = 26;
  const bannerY = currentY;

  const [surfR, surfG, surfB] = PDF_COLORS.surfaceLightRgb;
  const [bordR, bordG, bordB] = PDF_COLORS.borderGrayRgb;
  doc.setFillColor(surfR, surfG, surfB);
  doc.setDrawColor(bordR, bordG, bordB);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, bannerY, contentWidth, bannerHeight, 2, 2, 'FD');

  const [navyR, navyG, navyB] = PDF_COLORS.primaryNavyRgb;
  const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;

  // Box Column 1: Original Amount
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('ORIGINAL AMOUNT', marginLeft + 6, bannerY + 7);
  doc.setTextColor(navyR, navyG, navyB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(formatPdfCurrency(q.original_amount), marginLeft + 6, bannerY + 17);

  // Box Column 2: Total Repaid
  const col2X = marginLeft + 65;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL REPAID', col2X, bannerY + 7);
  doc.setTextColor(0, 135, 90); // Emerald
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(formatPdfCurrency(q.amount_repaid || 0), col2X, bannerY + 17);

  // Box Column 3: Outstanding Balance
  const col3X = marginLeft + 125;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('REMAINING BALANCE', col3X, bannerY + 7);
  const [amberR, amberG, amberB] = PDF_COLORS.warningAmberRgb;
  doc.setTextColor(q.balance > 0 ? amberR : 0, q.balance > 0 ? amberG : 135, q.balance > 0 ? amberB : 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(formatPdfCurrency(q.balance), col3X, bannerY + 17);

  currentY = bannerY + bannerHeight + 8;

  // 3. Counterparty & Agreement Details
  currentY = addSectionHeading(doc, 'Benevolent Loan Agreement Details', currentY);

  const agreementDetails = [
    { label: 'Voucher Reference', value: refNumber },
    { label: 'Counterparty Name', value: q.person_name },
    { label: 'Loan Direction', value: isGiven ? 'Disbursed (Given)' : 'Received (Borrowed)' },
    { label: 'Disbursement Date', value: formatPdfDate(q.transaction_date) },
    { label: 'Settlement Account', value: q.account || 'Primary' },
    { label: 'Due Date', value: q.due_date ? formatPdfDate(q.due_date) : 'Open-ended (Upon ease)' },
    {
      label: 'Current Status',
      value:
        q.balance <= 0 || q.status === 'FULLY_SETTLED'
          ? 'Fully Settled'
          : q.status === 'PARTIALLY_REPAID'
          ? 'Partially Repaid'
          : 'Outstanding',
    },
    { label: 'Notes / Purpose', value: q.notes || 'None recorded' },
  ];

  currentY = addKeyValueGrid(doc, agreementDetails, currentY, 2);
  currentY += 6;

  // 4. Repayment History Table (if repayments exist)
  if (q.repayments && q.repayments.length > 0) {
    currentY = addSectionHeading(doc, 'Logged Repayments History', currentY);

    const repayHead = [['Date', 'Repayment Reference', 'Account', 'Notes', 'Amount (Rs)']];
    const repayBody = q.repayments.map((r) => [
      formatPdfDate(r.repayment_date),
      `RP-${r.id.slice(0, 8).toUpperCase()}`,
      r.payment_account || '-',
      r.notes || '-',
      formatPdfCurrency(r.amount),
    ]);

    const repayFoot = [
      ['Total Repaid', '', '', '', formatPdfCurrency(q.amount_repaid || 0)],
    ];

    currentY = await renderTable(doc, {
      startY: currentY,
      head: repayHead,
      body: repayBody,
      foot: repayFoot,
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 32 },
        2: { cellWidth: 28 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 28, halign: 'right' },
      },
    });
    currentY += 4;
  }

  // 5. Islamic Disclosure Callout Box
  const calloutHeight = 20;
  const calloutY = currentY;
  doc.setFillColor(surfR, surfG, surfB);
  doc.setDrawColor(bordR, bordG, bordB);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginLeft, calloutY, contentWidth, calloutHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    doc.splitTextToSize(ISLAMIC_QARZ_DISCLOSURE, contentWidth - 8),
    marginLeft + 4,
    calloutY + 6
  );

  // 6. Corporate Footer
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: '7TIME Qarz-e-Hasana • Islamic Ethical Financial Voucher',
    generatedBy: params.generatedBy,
  });

  const filename = sanitizeFilename(
    `7TIME_Qarz_${refNumber}_${sanitizeFilename(q.person_name)}_${formatPdfDate(q.transaction_date)}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'qarz_receipt',
    documentCategory: 'ACKNOWLEDGEMENT',
    generatedAt,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    recordId: q.id,
    orientation: 'portrait',
    pageFormat: 'a4',
  };

  return buildGeneratedPdfDocument(
    doc,
    filename,
    `Qarz-e-Hasana Acknowledgment: ${q.person_name} (${formatPdfCurrency(q.original_amount)})`,
    metadata
  );
}

