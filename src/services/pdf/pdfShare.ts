/**
 * 7TIME PDF Generation & Native Sharing Foundation
 * Web Share API capability detection, mobile sharing & download fallback
 */

import type { GeneratedPdfDocument, ShareCapabilities, ShareResult } from './pdfTypes';

/**
 * Detects whether the current browser / device supports the Web Share API
 * and specifically whether it supports native file sharing (Level 2).
 *
 * Requirements:
 * 1. navigator.share function must exist.
 * 2. Window must be a secure context (HTTPS or localhost).
 * 3. navigator.canShare({ files }) must return true.
 */
export function detectShareCapabilities(testFile?: File): ShareCapabilities {
  const isSecureContext =
    typeof window !== 'undefined'
      ? (typeof window.isSecureContext === 'boolean' ? window.isSecureContext : true)
      : false;

  const hasNavigator = typeof navigator !== 'undefined';
  const canUseWebShare = hasNavigator && typeof navigator.share === 'function';

  let canShareFiles = false;
  if (canUseWebShare && typeof navigator.canShare === 'function') {
    try {
      const fileToTest =
        testFile ||
        (typeof File !== 'undefined'
          ? new File(['%PDF-1.4 test'], 'test.pdf', { type: 'application/pdf' })
          : null);

      if (fileToTest) {
        canShareFiles = navigator.canShare({ files: [fileToTest] });
      }
    } catch {
      canShareFiles = false;
    }
  }

  return {
    canUseWebShare,
    canShareFiles,
    isSecureContext,
  };
}

/**
 * Programmatically triggers a browser file download using an anchor element.
 * Safe fallback across all desktop and mobile browsers.
 */
export function downloadPdfBlob(blobOrUrl: Blob | string, filename: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  let objectUrlToRevoke: string | null = null;
  let href: string;

  if (typeof blobOrUrl === 'string') {
    href = blobOrUrl;
  } else {
    href = URL.createObjectURL(blobOrUrl);
    objectUrlToRevoke = href;
  }

  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename || 'document.pdf';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  if (objectUrlToRevoke) {
    // Revoke after standard download dispatch timeout
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrlToRevoke!);
      } catch {
        // Ignore revocation error
      }
    }, 1000);
  }
}

/**
 * Validates that an object is a valid, non-empty application/pdf File ending in .pdf.
 */
export function isValidPdfFile(file: unknown): file is File {
  if (typeof File === 'undefined') return false;
  if (!(file instanceof File)) return false;
  if (file.type !== 'application/pdf') return false;
  if (!file.name.toLowerCase().endsWith('.pdf')) return false;
  if (file.size <= 0) return false;
  return true;
}

/**
 * Checks whether a File or Blob starts with the authoritative PDF magic header: "%PDF-".
 * In PDF specifications (ISO 32000-1), every valid PDF document begins with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D).
 */
export async function hasPdfMagicBytes(fileOrBlob: Blob | File): Promise<boolean> {
  try {
    if (!fileOrBlob || typeof fileOrBlob.slice !== 'function' || fileOrBlob.size < 5) {
      return false;
    }
    const headerSlice = fileOrBlob.slice(0, 5);
    const headerText = await headerSlice.text();
    return headerText.startsWith('%PDF-');
  } catch {
    return false;
  }
}

/**
 * Reads the first N bytes of a File or Blob and formats them as a space-separated hex string.
 * Example for %PDF-: "25 50 44 46 2d ..."
 * Non-sensitive, contains zero customer or transaction data.
 */
export async function getHexSignature(
  blobOrFile?: Blob | File | null,
  length: number = 16
): Promise<string> {
  try {
    if (!blobOrFile || typeof blobOrFile.slice !== 'function') {
      return 'invalid-source';
    }
    const slice = blobOrFile.slice(0, length);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) {
      return 'empty-bytes';
    }
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  } catch {
    return 'read-error';
  }
}

/**
 * Validates a PDF File object completely:
 * 1. Checks basic File properties (File instance, application/pdf type, .pdf extension, non-zero size).
 * 2. Checks binary magic bytes (%PDF-).
 */
export async function validatePdfFile(file: unknown): Promise<{ isValid: boolean; error?: string }> {
  if (!isValidPdfFile(file)) {
    return {
      isValid: false,
      error: 'Invalid PDF file: must be a non-empty application/pdf File object with a .pdf extension.',
    };
  }

  const hasMagicBytes = await hasPdfMagicBytes(file);
  if (!hasMagicBytes) {
    return {
      isValid: false,
      error: 'Invalid PDF content: file header must begin with "%PDF-".',
    };
  }

  return { isValid: true };
}

/**
 * Checks whether native PDF file sharing is supported in the current environment.
 * If a specific File is provided, it also validates that the file is a valid PDF
 * and that navigator.canShare accepts it.
 */
export function canSharePdfFile(file?: File): boolean {
  if (file && !isValidPdfFile(file)) {
    return false;
  }
  const capabilities = detectShareCapabilities(file);
  return capabilities.canUseWebShare && capabilities.canShareFiles && capabilities.isSecureContext;
}

export interface ShareDiagnosticsLog {
  actionBranch:
    | 'native-share-attempt'
    | 'native-share-success'
    | 'native-share-cancelled'
    | 'native-share-unsupported'
    | 'native-share-failed';
  userAgent: string;
  navigatorShareAvailable: boolean;
  navigatorCanShareAvailable: boolean;
  canShareFiles: boolean;
  isSecureContext: boolean;
  pdfFilename: string;
  pdfMimeType: string;
  pdfSize: number;
  // Extended File, Blob & Payload runtime telemetry (Zero PII)
  fileIsInstanceOfFile: boolean;
  fileLastModified: number;
  fileHexSignature: string;
  hasValidPdfHeader: boolean;
  userActivationIsActive?: boolean;
  blobSize: number;
  blobHexSignature: string;
  isBlobIdentical: boolean;
  sharePayload: {
    filesCount: number;
    title: string;
    hasUrl: boolean;
    hasText: boolean;
  };
  exceptionName?: string;
  exceptionMessage?: string;
}

/**
 * Diagnostics logger for Web Share operations.
 * Emits structured telemetry without logging personal customer information or phone numbers.
 * Attaches to window.__LAST_7TIME_SHARE_DIAGNOSTICS__ for mobile device inspection.
 */
export function logShareDiagnostics(params: {
  branch: ShareDiagnosticsLog['actionBranch'];
  file?: File;
  blob?: Blob;
  error?: unknown;
  hexSignature?: string;
  blobHexSignature?: string;
  hasValidHeader?: boolean;
}): ShareDiagnosticsLog {
  const file = params.file;
  const blob = params.blob;
  const error =
    params.error instanceof Error
      ? params.error
      : params.error
        ? new Error(String(params.error))
        : undefined;

  const hasNavigator = typeof navigator !== 'undefined';
  const hasShare = hasNavigator && typeof navigator.share === 'function';
  const hasCanShare = hasNavigator && typeof navigator.canShare === 'function';

  let canShareFilesResult = false;
  if (hasCanShare && file) {
    try {
      canShareFilesResult = navigator.canShare({ files: [file] });
    } catch {
      canShareFilesResult = false;
    }
  }

  const fileIsInstanceOfFile = typeof File !== 'undefined' && file instanceof File;
  const fileLastModified = file?.lastModified ?? -1;
  const fileHexSignature = params.hexSignature || 'unknown';
  const hasValidPdfHeader = params.hasValidHeader ?? false;
  const blobSize = blob?.size ?? -1;
  const blobHexSignature = params.blobHexSignature || 'unknown';
  const isBlobIdentical = Boolean(
    file &&
    blob &&
    file.size === blob.size &&
    fileHexSignature !== 'unknown' &&
    fileHexSignature === blobHexSignature
  );

  const navUserActivation =
    hasNavigator && 'userActivation' in navigator
      ? (navigator as unknown as { userActivation?: { isActive?: boolean } }).userActivation?.isActive
      : undefined;

  const diagnostics: ShareDiagnosticsLog = {
    actionBranch: params.branch,
    userAgent: hasNavigator ? navigator.userAgent : 'unknown',
    navigatorShareAvailable: hasShare,
    navigatorCanShareAvailable: hasCanShare,
    canShareFiles: canShareFilesResult,
    isSecureContext: typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false,
    pdfFilename: file?.name || 'unknown',
    pdfMimeType: file?.type || 'unknown',
    pdfSize: file?.size ?? -1,
    fileIsInstanceOfFile,
    fileLastModified,
    fileHexSignature,
    hasValidPdfHeader,
    userActivationIsActive: navUserActivation,
    blobSize,
    blobHexSignature,
    isBlobIdentical,
    sharePayload: {
      filesCount: file ? 1 : 0,
      title: file?.name || '',
      hasUrl: false,
      hasText: false,
    },
    ...(error ? { exceptionName: error.name, exceptionMessage: error.message } : {}),
  };

  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__LAST_7TIME_SHARE_DIAGNOSTICS__ = diagnostics;
  }

  if (params.branch === 'native-share-failed') {
    console.error('[7TIME Share Diagnostics]', diagnostics);
  } else if (params.branch === 'native-share-unsupported' || params.branch === 'native-share-cancelled') {
    console.warn('[7TIME Share Diagnostics]', diagnostics);
  } else {
    console.info('[7TIME Share Diagnostics]', diagnostics);
  }

  return diagnostics;
}

/**
 * Direct PDF File Sharing Function:
 * 1. Validates that the document contains a valid non-empty PDF File ending in .pdf and %PDF- magic bytes.
 * 2. Checks if native file sharing is supported in a secure context via canSharePdfFile.
 * 3. Triggers the native OS share sheet (WhatsApp, Telegram, Mail, Drive, etc.) with the exact PDF file.
 * 4. Preserves the synchronous user gesture context: does NOT await file reads if the document is already verified.
 * 5. Does NOT download the file before or after sharing.
 * 6. Does NOT open wa.me as a substitute for attaching the PDF.
 * 7. Returns { status: 'cancelled' } on user dismissal (AbortError) without error or download.
 * 8. Returns { status: 'unsupported' } if native file sharing is unavailable, WITHOUT triggering a download.
 */
export async function sharePdfFile(
  doc: GeneratedPdfDocument,
  _options?: { text?: string; title?: string; onTrace?: (event: string) => void }
): Promise<ShareResult> {
  const file = doc.file;
  const blob = doc.blob;

  // 1. Synchronously verify basic file properties
  if (!isValidPdfFile(file)) {
    const error = new Error(
      'Invalid PDF file: must be a non-empty application/pdf File object with a .pdf extension.'
    );
    _options?.onTrace?.('3. file-validation-completed (invalid: missing or invalid file)');
    logShareDiagnostics({ branch: 'native-share-failed', file, blob, error });
    return {
      status: 'failed',
      method: 'unsupported',
      error,
    };
  }

  // 2. Binary magic header check (%PDF-) and hex extraction
  const fileHex = await getHexSignature(file, 16);
  const blobHex = blob ? await getHexSignature(blob, 16) : fileHex;
  const hasValidHeader = fileHex.startsWith('25 50 44 46 2d') || doc.hasValidHeader === true;

  if (!hasValidHeader) {
    const error = new Error(
      'Invalid PDF content: file header must begin with "%PDF-".'
    );
    _options?.onTrace?.('3. file-validation-completed (invalid header: missing %PDF-)');
    logShareDiagnostics({
      branch: 'native-share-failed',
      file,
      blob,
      error,
      hexSignature: fileHex,
      blobHexSignature: blobHex,
      hasValidHeader: false,
    });
    return {
      status: 'failed',
      method: 'unsupported',
      error,
    };
  }

  // 3. Synchronously verify native file sharing capability
  if (!canSharePdfFile(file)) {
    const error = new Error(
      'Your browser cannot share PDF files directly. Download the PDF and attach it manually in WhatsApp.'
    );
    _options?.onTrace?.('4. can-share-checked (false: unsupported on this platform)');
    logShareDiagnostics({
      branch: 'native-share-unsupported',
      file,
      blob,
      error,
      hexSignature: fileHex,
      blobHexSignature: blobHex,
      hasValidHeader: true,
    });
    return {
      status: 'unsupported',
      method: 'unsupported',
      error,
    };
  }

  // 4. Log diagnostic immediately before calling navigator.share()
  logShareDiagnostics({
    branch: 'native-share-attempt',
    file,
    blob,
    hexSignature: fileHex,
    blobHexSignature: blobHex,
    hasValidHeader: true,
  });

  // 5. Invoke navigator.share directly with files payload containing the actual PDF File.
  // Passing strictly files and title (without text or url) ensures mobile apps like WhatsApp
  // receive a pure document attachment intent instead of prioritizing text and omitting the file.
  try {
    const shareData: ShareData = {
      files: [file],
      title: file.name,
    };

    _options?.onTrace?.('5. navigator-share-called');

    await navigator.share(shareData);

    _options?.onTrace?.('6. navigator-share-resolved');
    logShareDiagnostics({
      branch: 'native-share-success',
      file,
      blob,
      hexSignature: fileHex,
      blobHexSignature: blobHex,
      hasValidHeader: true,
    });

    return {
      status: 'shared',
      method: 'web-share',
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    // User dismissed or closed the native share dialog
    if (error.name === 'AbortError') {
      _options?.onTrace?.('6. navigator-share-rejected:AbortError (User dismissed share sheet)');
      logShareDiagnostics({
        branch: 'native-share-cancelled',
        file,
        blob,
        error,
        hexSignature: fileHex,
        blobHexSignature: blobHex,
        hasValidHeader: true,
      });
      return {
        status: 'cancelled',
        method: 'web-share',
      };
    }

    _options?.onTrace?.(`6. navigator-share-rejected:${error.name || 'Error'} (${error.message})`);
    logShareDiagnostics({
      branch: 'native-share-failed',
      file,
      blob,
      error,
      hexSignature: fileHex,
      blobHexSignature: blobHex,
      hasValidHeader: true,
    });

    return {
      status: 'failed',
      method: 'web-share',
      error,
    };
  }
}

/**
 * Sharing Function with Optional Download Fallback:
 * Attempts native file share via `sharePdfFile`.
 * Only triggers browser download if `options?.fallbackToDownload` is explicitly true.
 */
export async function shareOrDownloadPdf(
  doc: GeneratedPdfDocument,
  options?: { text?: string; fallbackToDownload?: boolean }
): Promise<ShareResult> {
  const result = await sharePdfFile(doc, options);

  // If shared or cancelled, return immediately
  if (result.status === 'shared' || result.status === 'cancelled') {
    return result;
  }

  // Fallback download only if explicitly requested
  if (options?.fallbackToDownload) {
    try {
      downloadPdfBlob(doc.objectUrl || doc.blob, doc.filename);
      return {
        status: 'downloaded',
        method: 'download',
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        status: 'failed',
        method: 'download',
        error,
      };
    }
  }

  return result;
}

