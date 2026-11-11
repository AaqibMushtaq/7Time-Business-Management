/**
 * 7TIME PDF Generation — Customer Credits & Record Expense on Behalf Templates
 * Generates authoritative itemized Expense on Behalf Receipts and Customer Ledger Statements.
 * Fully supports merchant information (shopkeeper_name, purchase_location) and dual funding sources.
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
import type { CustomerCredit } from '@/services/customerCredits';
import type { ResellerCustomer } from '@/services/resellers';

export interface CustomerCreditReceiptParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  credit: CustomerCredit;
  customer?: ResellerCustomer | null;
}

export interface CustomerCreditStatementParams {
  workspaceId: string;
  workspaceName: string;
  generatedBy?: string;
  customer: ResellerCustomer;
  credits: CustomerCredit[];
  dateRangeLabel?: string;
  totalCredits?: number;
  totalPaid?: number;
  totalBalance?: number;
}

/**
 * Returns user-friendly funding source label.
 */
function getFundingLabel(source?: string | null): string {
  if (source === '7TIME_FUNDS') return '7TIME Business Funds';
  if (source === 'PERSONAL_FUNDS') return 'Personal Funds';
  return 'Direct / Unallocated';
}

/**
 * Returns user-friendly entry type label.
 */
function getEntryTypeLabel(type: string): string {
  if (type === 'PRODUCT_CREDIT') return 'Expense on Behalf (Product)';
  if (type === 'CASH_LOAN') return 'Cash Loan (Qard Hasan)';
  return 'General Credit';
}

/**
 * Generates an authoritative itemized Customer Credit / Expense on Behalf Receipt PDF.
 */
export async function generateCustomerCreditReceiptPdf(
  params: CustomerCreditReceiptParams
): Promise<GeneratedPdfDocument> {
  const doc = await createPdfInstance({ orientation: 'portrait' });
  const credit = params.credit;
  const customer = credit.customer || params.customer;
  const generatedAt = new Date().toISOString();

  const refNumber = `CR-${credit.id.slice(0, 8).toUpperCase()}`;
  const customerName = customer?.name || 'Customer / Person';

  // 1. Draw Document Header
  let currentY = drawDocumentHeader(doc, {
    title: getEntryTypeLabel(credit.entry_type),
    subtitle: `Person: ${customerName} • Workspace: ${params.workspaceName}`,
    workspaceName: params.workspaceName,
    date: credit.entry_date,
    category: 'RECEIPT',
    referenceNumber: refNumber,
  });

  // 2. Financial Amount Summary Banner
  const { marginLeft, contentWidth } = { marginLeft: 14, contentWidth: 182 };
  const bannerHeight = 24;
  const bannerY = currentY;

  const [surfR, surfG, surfB] = PDF_COLORS.surfaceLightRgb;
  const [bordR, bordG, bordB] = PDF_COLORS.borderGrayRgb;
  doc.setFillColor(surfR, surfG, surfB);
  doc.setDrawColor(bordR, bordG, bordB);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, bannerY, contentWidth, bannerHeight, 2, 2, 'FD');

  const [navyR, navyG, navyB] = PDF_COLORS.primaryNavyRgb;
  const [mutedR, mutedG, mutedB] = PDF_COLORS.textMutedRgb;

  // Box Column 1: Total Amount
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL AMOUNT', marginLeft + 6, bannerY + 7);
  doc.setTextColor(navyR, navyG, navyB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(formatPdfCurrency(credit.total_amount), marginLeft + 6, bannerY + 17);

  // Box Column 2: Amount Paid
  const col2X = marginLeft + 65;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('AMOUNT PAID', col2X, bannerY + 7);
  doc.setTextColor(0, 135, 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(formatPdfCurrency(credit.amount_paid), col2X, bannerY + 17);

  // Box Column 3: Outstanding Balance
  const col3X = marginLeft + 125;
  doc.setTextColor(mutedR, mutedG, mutedB);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('BALANCE DUE', col3X, bannerY + 7);
  const [amberR, amberG, amberB] = PDF_COLORS.warningAmberRgb;
  doc.setTextColor(credit.balance > 0 ? amberR : 0, credit.balance > 0 ? amberG : 135, credit.balance > 0 ? amberB : 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(formatPdfCurrency(credit.balance), col3X, bannerY + 17);

  currentY = bannerY + bannerHeight + 8;

  // 3. Customer & Funding Details Section
  currentY = addSectionHeading(doc, 'Parties & Funding Classification', currentY);

  const partiesDetails = [
    { label: 'Receipt Reference', value: refNumber },
    { label: 'Recipient Person', value: customerName },
    { label: 'Contact Phone', value: customer?.phone || 'N/A' },
    { label: 'Address / Location', value: customer?.address || 'N/A' },
    { label: 'Funding Source', value: getFundingLabel(credit.funding_source) },
    { label: 'Payment Account', value: credit.account || 'Primary' },
    { label: 'Merchant / Shopkeeper', value: credit.shopkeeper_name || 'N/A' },
    { label: 'Purchase Location', value: credit.purchase_location || 'N/A' },
  ];

  currentY = addKeyValueGrid(doc, partiesDetails, currentY, 2);
  currentY += 6;

  // 4. Itemized Product / Expense Breakdown Table
  currentY = addSectionHeading(doc, 'Itemized Expense Details', currentY);

  const itemHead = [['Item / Description', 'Category', 'Quantity', 'Rate (Rs)', 'Total (Rs)']];
  const itemRow = [
    credit.product_name || credit.description || 'General Expense',
    credit.category || '-',
    credit.quantity ? `${credit.quantity} ${credit.unit || ''}`.trim() : '1',
    credit.rate_per_unit ? formatPdfCurrency(credit.rate_per_unit) : formatPdfCurrency(credit.total_amount),
    formatPdfCurrency(credit.total_amount),
  ];

  currentY = await renderTable(doc, {
    startY: currentY,
    head: itemHead,
    body: [itemRow],
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 28 },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
  });
  currentY += 4;

  // 5. Payment Allocations Table (if payments have been made)
  if (credit.allocations && credit.allocations.length > 0) {
    currentY = addSectionHeading(doc, 'Applied Payment Allocations', currentY);

    const allocHead = [['Date', 'Payment Ref', 'Method', 'Notes', 'Amount (Rs)']];
    const allocBody = credit.allocations.map((a) => [
      formatPdfDate(a.payment?.payment_date || a.created_at),
      `PAY-${a.payment_id.slice(0, 8).toUpperCase()}`,
      a.payment?.payment_method || 'Direct',
      a.notes || a.payment?.notes || '-',
      formatPdfCurrency(a.amount),
    ]);

    const allocFoot = [
      ['Total Paid', '', '', '', formatPdfCurrency(credit.amount_paid)],
    ];

    currentY = await renderTable(doc, {
      startY: currentY,
      head: allocHead,
      body: allocBody,
      foot: allocFoot,
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 32 },
        2: { cellWidth: 24 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 28, halign: 'right' },
      },
    });
    currentY += 4;
  }

  // 6. Notes section
  if (credit.notes) {
    currentY = addSectionHeading(doc, 'Remarks & Notes', currentY);
    doc.setTextColor(mutedR, mutedG, mutedB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(credit.notes, marginLeft, currentY);
  }

  // 7. Footer on all pages
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: '7TIME Customer Ledger • Expense on Behalf Voucher',
    generatedBy: params.generatedBy,
  });

  const filename = sanitizeFilename(
    `7TIME_Expense_${refNumber}_${sanitizeFilename(customerName)}_${formatPdfDate(credit.entry_date)}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'customer_credit_receipt',
    documentCategory: 'RECEIPT',
    generatedAt,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    recordId: credit.id,
    orientation: 'portrait',
    pageFormat: 'a4',
  };

  return buildGeneratedPdfDocument(
    doc,
    filename,
    `Expense on Behalf Receipt: ${customerName} (${formatPdfCurrency(credit.total_amount)})`,
    metadata
  );
}

/**
 * Generates an authoritative multi-page Customer Ledger Account Statement PDF.
 */
export async function generateCustomerCreditStatementPdf(
  params: CustomerCreditStatementParams
): Promise<GeneratedPdfDocument> {
  const doc = await createPdfInstance({ orientation: 'portrait' });
  const cust = params.customer;
  const generatedAt = new Date().toISOString();

  const totalCredits =
    params.totalCredits ?? params.credits.reduce((sum, c) => sum + c.total_amount, 0);
  const totalPaid =
    params.totalPaid ?? params.credits.reduce((sum, c) => sum + c.amount_paid, 0);
  const totalBalance =
    params.totalBalance ?? params.credits.reduce((sum, c) => sum + c.balance, 0);

  // 1. Draw Page 1 Document Header
  let currentY = drawDocumentHeader(doc, {
    title: 'Customer Ledger Statement',
    subtitle: `Person: ${cust.name} • Workspace: ${params.workspaceName}${
      params.dateRangeLabel ? ` • Period: ${params.dateRangeLabel}` : ''
    }`,
    workspaceName: params.workspaceName,
    date: generatedAt,
    category: 'STATEMENT',
    referenceNumber: `CUST-${cust.id.slice(0, 8).toUpperCase()}`,
  });

  // 2. Customer Profile & Financial Summary
  currentY = addSectionHeading(doc, 'Account Profile & Balance Overview', currentY);

  const summaryGrid = [
    { label: 'Customer / Person', value: cust.name },
    { label: 'Phone', value: cust.phone || 'N/A' },
    { label: 'Address / Market', value: cust.address || 'N/A' },
    { label: 'Total Credits Extended', value: formatPdfCurrency(totalCredits) },
    { label: 'Total Payments Received', value: formatPdfCurrency(totalPaid) },
    { label: 'Current Outstanding Balance', value: formatPdfCurrency(totalBalance) },
  ];

  currentY = addKeyValueGrid(doc, summaryGrid, currentY, 3);
  currentY += 4;

  // 3. Transactions Table
  currentY = addSectionHeading(doc, 'Detailed Ledger Entries', currentY);

  const tableHead = [
    ['Date', 'Type / Item', 'Merchant / Location', 'Funding', 'Total (Rs)', 'Paid (Rs)', 'Balance (Rs)', 'Status'],
  ];

  const tableBody = params.credits.map((c) => {
    const merchantLocation = [c.shopkeeper_name, c.purchase_location].filter(Boolean).join(' • ') || '-';
    const itemDesc = c.product_name || c.description || getEntryTypeLabel(c.entry_type);

    return [
      formatPdfDate(c.entry_date),
      itemDesc,
      merchantLocation,
      getFundingLabel(c.funding_source),
      formatPdfCurrency(c.total_amount),
      formatPdfCurrency(c.amount_paid),
      formatPdfCurrency(c.balance),
      c.status,
    ];
  });

  const tableFoot = [
    [
      'Total',
      '',
      '',
      '',
      formatPdfCurrency(totalCredits),
      formatPdfCurrency(totalPaid),
      formatPdfCurrency(totalBalance),
      '',
    ],
  ];

  await renderTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody.length > 0 ? tableBody : [['-', 'No ledger entries found', '-', '-', '-', '-', '-', '-']],
    foot: tableFoot,
    columnStyles: {
      0: { cellWidth: 20 }, // Date
      1: { cellWidth: 'auto' }, // Item
      2: { cellWidth: 28 }, // Merchant / Location
      3: { cellWidth: 24 }, // Funding
      4: { cellWidth: 22, halign: 'right' }, // Total
      5: { cellWidth: 20, halign: 'right' }, // Paid
      6: { cellWidth: 22, halign: 'right' }, // Balance
      7: { cellWidth: 16, halign: 'center' }, // Status
    },
  });

  // 4. Draw Footer across all pages
  drawDocumentFooter(doc, {
    includePageNumbers: true,
    confidentialityNotice: '7TIME Customer Ledger • Authoritative Account Statement',
    generatedBy: params.generatedBy,
  });

  const filename = sanitizeFilename(
    `7TIME_Ledger_${sanitizeFilename(cust.name)}_${formatPdfDate(new Date())}.pdf`
  );

  const metadata: PdfDocumentMetadata = {
    documentType: 'customer_credit_statement',
    documentCategory: 'STATEMENT',
    generatedAt,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    recordId: cust.id,
    orientation: 'portrait',
    pageFormat: 'a4',
  };

  return buildGeneratedPdfDocument(
    doc,
    filename,
    `Customer Statement: ${cust.name}`,
    metadata
  );
}

