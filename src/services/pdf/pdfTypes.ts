/**
 * 7TIME PDF Generation & Native Sharing Foundation
 * Strongly-typed Document, Share, and Branding Types
 */

export type PdfOrientation = 'portrait' | 'landscape';
export type PdfPageFormat = 'a4';

export type PdfDocumentCategory =
  | 'RECEIPT'
  | 'STATEMENT'
  | 'ACKNOWLEDGEMENT'
  | 'REPORT';

export type PdfDocumentType =
  | 'personal_ledger_receipt'
  | 'personal_ledger_statement'
  | 'qarz_receipt'
  | 'qarz_statement'
  | 'customer_credit_receipt'
  | 'customer_credit_statement'
  | 'business_report'
  | 'custom';

export interface PdfDocumentMetadata {
  documentType: PdfDocumentType;
  documentCategory: PdfDocumentCategory;
  generatedAt: string;
  workspaceId?: string;
  workspaceName?: string;
  recordId?: string;
  orientation: PdfOrientation;
  pageFormat: PdfPageFormat;
  pageCount?: number;
  recipientName?: string;
  recipientPhone?: string | null;
  customMetadata?: Record<string, unknown>;
}

export interface GeneratedPdfDocument {
  /** The raw generated PDF binary blob */
  blob: Blob;
  /** Browser File object ready for Web Share API file transfer */
  file: File;
  /** Reusable object URL created from blob (URL.createObjectURL) */
  objectUrl: string;
  /** Authoritative filename (e.g. 7TIME_Receipt_20261110.pdf) */
  filename: string;
  /** Document title for display, headers, and sharing */
  title: string;
  /** Strongly typed metadata attached to this generated instance */
  metadata: PdfDocumentMetadata;
  /**
   * Safe, idempotent cleanup function that revokes the objectUrl.
   * Calling multiple times is guaranteed safe.
   */
  cleanup: () => void;
  /** True if the document header has already been verified as a valid PDF */
  hasValidHeader?: boolean;
}

export interface ShareCapabilities {
  /** True if window.navigator.share is available */
  canUseWebShare: boolean;
  /** True if window.navigator.canShare exists and reports true for files */
  canShareFiles: boolean;
  /** True if window.isSecureContext is true (Web Share API requires HTTPS / localhost) */
  isSecureContext: boolean;
}

export type ShareResultStatus = 'shared' | 'downloaded' | 'cancelled' | 'unsupported' | 'failed';

export interface ShareResult {
  status: ShareResultStatus;
  method: 'web-share' | 'download' | 'unsupported';
  error?: Error;
}

export interface DocumentHeaderOptions {
  title: string;
  subtitle?: string;
  referenceNumber?: string;
  workspaceName?: string;
  date?: string | Date;
  category?: PdfDocumentCategory;
}

export interface DocumentFooterOptions {
  includePageNumbers?: boolean;
  confidentialityNotice?: string;
  generatedBy?: string;
}

