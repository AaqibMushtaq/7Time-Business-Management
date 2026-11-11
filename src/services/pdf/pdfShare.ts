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
    typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean'
      ? window.isSecureContext
      : false;

  const hasNavigator = typeof navigator !== 'undefined';
  const canUseWebShare = hasNavigator && typeof navigator.share === 'function';

  let canShareFiles = false;
  if (canUseWebShare && typeof navigator.canShare === 'function') {
    try {
      const fileToTest =
        testFile ||
        (typeof File !== 'undefined'
          ? new File(['test'], 'test.pdf', { type: 'application/pdf' })
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
 * Unified Sharing Function:
 * 1. Checks if native file sharing is supported and context is secure.
 * 2. If supported, triggers the native mobile share sheet (WhatsApp, Telegram, Mail, Drive, etc.).
 * 3. If the user dismisses/cancels the share sheet (AbortError), returns { status: 'cancelled' } without forcing a download.
 * 4. If native file sharing is not supported, or encounters an unexpected error, falls back to direct browser download.
 */
export async function shareOrDownloadPdf(
  doc: GeneratedPdfDocument,
  options?: { text?: string }
): Promise<ShareResult> {
  const capabilities = detectShareCapabilities(doc.file);

  // If mobile Web Share Level 2 is supported in a secure context
  if (capabilities.canUseWebShare && capabilities.canShareFiles && capabilities.isSecureContext) {
    try {
      await navigator.share({
        title: doc.title,
        text: options?.text || doc.title,
        files: [doc.file],
      });

      return {
        status: 'shared',
        method: 'web-share',
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      // User closed or cancelled the share dialog
      if (error.name === 'AbortError') {
        return {
          status: 'cancelled',
          method: 'web-share',
        };
      }

      // If share failed due to unexpected device error, log and fallback to download
      console.warn('Native PDF sharing failed, falling back to download:', error);
    }
  }

  // Fallback: Trigger standard browser download
  try {
    downloadPdfBlob(doc.objectUrl || doc.blob, doc.filename);
    return {
      status: 'downloaded',
      method: 'download',
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      status: 'downloaded',
      method: 'download',
      error,
    };
  }
}

