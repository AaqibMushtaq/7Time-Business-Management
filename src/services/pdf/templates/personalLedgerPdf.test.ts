import { describe, it, expect } from 'vitest';
import {
  generatePersonalLedgerStatementPdf,
  generatePersonalTransactionReceiptPdf,
} from './personalLedgerPdf';
import type {
  PersonalTransaction,
  PersonalLedgerSummary,
  UnifiedPersonalEntry,
} from '@/services/personalLedger';

describe('Personal Ledger PDF Templates', () => {
  const mockSummary: PersonalLedgerSummary = {
    totalIncome: 150000,
    totalExpense: 45000.5,
    netBalance: 104999.5,
    qarz: {
      totalGiven: 20000,
      totalReceived: 5000,
      outstandingReceivables: 15000,
      outstandingPayables: 2000,
    },
  };

  const mockTransactions: PersonalTransaction[] = [
    {
      id: 'tx-001-uuid',
      user_id: 'user-001',
      workspace_id: 'ws-personal',
      entry_type: 'INCOME',
      amount: 50000,
      transaction_date: '2026-11-01',
      category: 'Consulting',
      particulars: 'Monthly Consulting Retainer',
      account: 'HDFC Bank',
      notes: 'Direct client deposit',
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'tx-002-uuid',
      user_id: 'user-001',
      workspace_id: 'ws-personal',
      entry_type: 'EXPENSE',
      amount: 12500.75,
      transaction_date: '2026-11-05',
      category: 'Utilities',
      particulars: 'Office Electricity and High-Speed Fiber',
      account: 'Cash',
      notes: 'Paid via cash counter',
      created_at: '2026-11-05T14:30:00Z',
    },
  ];

  const mockUnifiedEntries: UnifiedPersonalEntry[] = [
    {
      id: 'u-001',
      date: '2026-11-01',
      particulars: 'Consulting Retainer',
      category: 'Consulting',
      type: 'INCOME',
      account: 'HDFC Bank',
      amount: 50000,
    },
    {
      id: 'u-002',
      date: '2026-11-05',
      particulars: 'Electricity & Internet',
      category: 'Utilities',
      type: 'EXPENSE',
      account: 'Cash',
      amount: 12500.75,
    },
    {
      id: 'u-003',
      date: '2026-11-08',
      particulars: 'Qarz to Farooq',
      category: 'Qarz',
      type: 'QARZ_GIVEN',
      account: 'HDFC Bank',
      amount: 15000,
    },
  ];

  it('generates an authoritative multi-page personal ledger statement PDF', async () => {
    const doc = await generatePersonalLedgerStatementPdf({
      workspaceId: 'ws-personal',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'admin@7time.com',
      dateRangeLabel: 'November 2026',
      entries: mockUnifiedEntries,
      summary: mockSummary,
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toBe('Personal Ledger Statement');
    expect(doc.filename).toContain('7TIME_Personal_Statement_');
    expect(doc.objectUrl).toMatch(/^blob:/);
    expect(doc.metadata.documentCategory).toBe('STATEMENT');
    expect(doc.metadata.documentType).toBe('personal_ledger_statement');
    expect(doc.metadata.workspaceId).toBe('ws-personal');

    // Test cleanup
    expect(() => doc.cleanup()).not.toThrow();
  });

  it('generates an individual transaction receipt PDF with single-Blob contract', async () => {
    const tx = mockTransactions[0];
    const doc = await generatePersonalTransactionReceiptPdf({
      workspaceId: 'ws-personal',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'admin@7time.com',
      transaction: tx,
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toContain('INCOME Receipt');
    expect(doc.filename).toContain('7TIME_Receipt_TX-TX-001-');
    expect(doc.metadata.documentCategory).toBe('RECEIPT');
    expect(doc.metadata.recordId).toBe(tx.id);

    // Test cleanup
    expect(() => doc.cleanup()).not.toThrow();
  });
});

