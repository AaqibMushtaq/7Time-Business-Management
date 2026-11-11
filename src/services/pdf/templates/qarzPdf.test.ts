import { describe, it, expect } from 'vitest';
import {
  generateQarzStatementPdf,
  generateQarzReceiptPdf,
} from './qarzPdf';
import type { PersonalQarzEntry } from '@/services/personalLedger';

describe('Qarz-e-Hasana PDF Templates', () => {
  const mockQarzEntries: PersonalQarzEntry[] = [
    {
      id: 'qarz-001',
      user_id: 'user-001',
      workspace_id: 'ws-test',
      person_name: 'Dr. Farooq',
      direction: 'GIVEN',
      original_amount: 50000,
      amount_repaid: 20000,
      balance: 30000,
      transaction_date: '2026-10-15',
      account: 'HDFC Bank',
      status: 'PARTIALLY_REPAID',
      notes: 'Medical support interest-free loan',
      repayments: [
        {
          id: 'rep-001',
          qarz_entry_id: 'qarz-001',
          user_id: 'user-001',
          workspace_id: 'ws-test',
          amount: 20000,
          repayment_date: '2026-11-01',
          payment_account: 'HDFC Bank',
          notes: 'First installment received via NEFT',
          created_at: '2026-11-01T11:00:00Z',
        },
      ],
    },
    {
      id: 'qarz-002',
      user_id: 'user-001',
      workspace_id: 'ws-test',
      person_name: 'Ghulam Hassan',
      direction: 'RECEIVED',
      original_amount: 15000,
      amount_repaid: 15000,
      balance: 0,
      transaction_date: '2026-09-01',
      account: 'Cash',
      status: 'FULLY_SETTLED',
      notes: 'Emergency home repair assistance',
      repayments: [],
    },
  ];

  it('generates an authoritative multi-page Qarz-e-Hasana portfolio statement PDF', async () => {
    const doc = await generateQarzStatementPdf({
      workspaceId: 'ws-test',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'finance@7time.com',
      dateRangeLabel: 'All Time',
      qarzEntries: mockQarzEntries,
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toBe('Qarz-e-Hasana Portfolio Statement');
    expect(doc.filename).toContain('7TIME_Qarz_Statement_');
    expect(doc.metadata.documentCategory).toBe('STATEMENT');
    expect(doc.metadata.documentType).toBe('qarz_statement');
    expect(doc.metadata.workspaceId).toBe('ws-test');

    expect(() => doc.cleanup()).not.toThrow();
  });

  it('generates an individual Qarz-e-Hasana acknowledgment and repayment receipt PDF', async () => {
    const q = mockQarzEntries[0];
    const doc = await generateQarzReceiptPdf({
      workspaceId: 'ws-test',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'finance@7time.com',
      qarzEntry: q,
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toContain('Qarz-e-Hasana Acknowledgment: Dr. Farooq');
    expect(doc.filename).toContain('7TIME_Qarz_QZ-QARZ-001_Dr._Farooq');
    expect(doc.metadata.documentCategory).toBe('ACKNOWLEDGEMENT');
    expect(doc.metadata.recordId).toBe(q.id);

    expect(() => doc.cleanup()).not.toThrow();
  });
});

