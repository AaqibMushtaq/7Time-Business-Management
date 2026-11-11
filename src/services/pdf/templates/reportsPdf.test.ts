import { describe, it, expect } from 'vitest';
import { generateBusinessReportPdf } from './reportsPdf';

describe('Business Reports PDF Templates', () => {
  it('generates a portrait Business Report PDF for compact tables (<7 columns)', async () => {
    const head = [['ID', 'Date', 'Dealer', 'Amount', 'Payment Method']];
    const body = [
      ['PAY-001', '10 Nov 2026', 'Al-Haram Hardware', 'Rs 25,000.00', 'Bank Transfer'],
      ['PAY-002', '09 Nov 2026', 'Kashmir Timber', 'Rs 45,000.00', 'Cash'],
    ];

    const doc = await generateBusinessReportPdf({
      workspaceId: 'ws-reports',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'admin@7time.com',
      reportType: 'DEALER_PAYMENTS',
      reportTitle: 'Dealer Payments Report',
      head,
      body,
      summaryCards: [
        { label: 'Total Amount Paid', value: 'Rs 70,000.00' },
        { label: 'Total Settlements', value: '2 records' },
      ],
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toBe('Dealer Payments Report');
    expect(doc.filename).toContain('7TIME_Report_DEALER_PAYMENTS_');
    expect(doc.metadata.documentCategory).toBe('REPORT');
    expect(doc.metadata.orientation).toBe('portrait');

    expect(() => doc.cleanup()).not.toThrow();
  });

  it('generates a landscape Business Report PDF for wide tables (>=7 columns)', async () => {
    const head = [
      ['ID', 'Date', 'Customer', 'Product', 'Quantity', 'Rate', 'Total', 'Paid', 'Balance', 'Status'],
    ];
    const body = [
      [
        'SALE-001',
        '10 Nov 2026',
        'Bashir Ahmad',
        'Wire Mesh',
        '10 Rolls',
        'Rs 1,850.00',
        'Rs 18,500.00',
        'Rs 10,000.00',
        'Rs 8,500.00',
        'PARTIAL',
      ],
    ];

    const doc = await generateBusinessReportPdf({
      workspaceId: 'ws-reports',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'admin@7time.com',
      reportType: 'WHOLESALE_SALES',
      reportTitle: 'Wholesale Sales Report',
      head,
      body,
    });

    expect(doc).toBeDefined();
    expect(doc.metadata.orientation).toBe('landscape');
    expect(doc.metadata.documentType).toBe('business_report');

    expect(() => doc.cleanup()).not.toThrow();
  });
});

