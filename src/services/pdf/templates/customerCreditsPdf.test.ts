import { describe, it, expect } from 'vitest';
import {
  generateCustomerCreditReceiptPdf,
  generateCustomerCreditStatementPdf,
} from './customerCreditsPdf';
import type { CustomerCredit } from '@/services/customerCredits';
import type { ResellerCustomer } from '@/services/resellers';

describe('Customer Credits & Expense on Behalf PDF Templates', () => {
  const mockCustomer: ResellerCustomer = {
    id: 'cust-101',
    name: 'Bashir Ahmad Reseller',
    phone: '+91 9419111222',
    address: 'Lal Chowk, Srinagar',
    notes: 'Premium customer',
    contact_type: 'PERSONAL',
    workspace_id: 'ws-enterprise',
  };

  const mockCredits: CustomerCredit[] = [
    {
      id: 'credit-001',
      customer_id: 'cust-101',
      entry_type: 'PRODUCT_CREDIT',
      entry_date: '2026-11-08',
      funding_source: '7TIME_FUNDS',
      account: 'HDFC Current',
      shopkeeper_name: 'Al-Haram Hardware Store',
      purchase_location: 'Batamaloo Market',
      product_id: 'prod-001',
      product_name: 'Industrial Wire Mesh',
      category: 'Hardware',
      quantity: 10,
      unit: 'Rolls',
      rate_per_unit: 1850,
      description: 'Industrial Wire Mesh Rolls',
      total_amount: 18500,
      amount_paid: 10000,
      balance: 8500,
      status: 'PARTIAL',
      notes: 'Purchased on behalf for site project',
      customer: mockCustomer,
      allocations: [
        {
          id: 'alloc-001',
          payment_id: 'pay-001',
          credit_id: 'credit-001',
          amount: 10000,
          notes: 'Advance cash payment',
          payment: {
            id: 'pay-001',
            customer_id: 'cust-101',
            payment_date: '2026-11-09',
            amount: 10000,
            payment_method: 'UPI',
            reference: 'UPI/987654321',
            notes: 'Advance installment',
          },
        },
      ],
    },
    {
      id: 'credit-002',
      customer_id: 'cust-101',
      entry_type: 'PRODUCT_CREDIT',
      entry_date: '2026-11-09',
      funding_source: 'PERSONAL_FUNDS',
      account: 'Cash In Hand',
      shopkeeper_name: 'Noorani Electric Works',
      purchase_location: 'Nowhatta',
      product_id: null,
      product_name: 'LED Panel Lights',
      category: 'Electrical',
      quantity: 5,
      unit: 'Pcs',
      rate_per_unit: 800,
      description: 'LED Panel Lights',
      total_amount: 4000,
      amount_paid: 4000,
      balance: 0,
      status: 'PAID',
      notes: 'Fully settled at purchase',
      customer: mockCustomer,
    },
  ];

  it('generates an authoritative Expense on Behalf Receipt PDF with shopkeeper and location', async () => {
    const doc = await generateCustomerCreditReceiptPdf({
      workspaceId: 'ws-enterprise',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'sales@7time.com',
      credit: mockCredits[0],
      customer: mockCustomer,
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toContain('Expense on Behalf Receipt: Bashir Ahmad Reseller');
    expect(doc.filename).toContain('7TIME_Expense_CR-CREDIT-0_Bashir_Ahmad_Reseller');
    expect(doc.metadata.documentCategory).toBe('RECEIPT');
    expect(doc.metadata.documentType).toBe('customer_credit_receipt');
    expect(doc.metadata.recordId).toBe('credit-001');

    expect(() => doc.cleanup()).not.toThrow();
  });

  it('generates a multi-page Customer Ledger Account Statement PDF with balances', async () => {
    const doc = await generateCustomerCreditStatementPdf({
      workspaceId: 'ws-enterprise',
      workspaceName: '7TIME Primary Enterprise',
      generatedBy: 'sales@7time.com',
      customer: mockCustomer,
      credits: mockCredits,
      dateRangeLabel: 'November 2026',
    });

    expect(doc).toBeDefined();
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(doc.file).toBeInstanceOf(File);
    expect(doc.title).toBe('Customer Statement: Bashir Ahmad Reseller');
    expect(doc.filename).toContain('7TIME_Ledger_Bashir_Ahmad_Reseller_');
    expect(doc.metadata.documentCategory).toBe('STATEMENT');
    expect(doc.metadata.documentType).toBe('customer_credit_statement');
    expect(doc.metadata.recordId).toBe(mockCustomer.id);

    expect(() => doc.cleanup()).not.toThrow();
  });
});
