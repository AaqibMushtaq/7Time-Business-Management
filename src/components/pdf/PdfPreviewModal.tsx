import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  Printer,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  ExternalLink,
  MessageCircle,
  Info,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/useAuth';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import {
  sharePdfFile,
  canSharePdfFile,
  detectShareCapabilities,
  downloadPdfBlob,
  isValidPdfFile,
} from '@/services/pdf/pdfShare';
import { normalizeWhatsAppPhoneNumber, openWhatsAppConversation } from '@/services/pdf/pdfWhatsApp';
import type { UserProfile } from '@/types/auth';

export interface ModalDiagnostics {
  platform: string;
  browser: string;
  userAgent: string;
  typeofShare: string;
  typeofCanShare: string;
  hasShare: boolean;
  hasCanShare: boolean;
  canShareFiles: boolean;
  isPdfValid: boolean;
  pdfFilename: string;
  pdfMimeType: string;
  pdfFileSize: number;
  isSecureContext: boolean;
  userActivation: string;
  userActivationAtStart?: string;
  userActivationBeforeShare?: string;
  shareAttempted: boolean;
  lastShareResult: string;
  lastShareError?: string;
  executionTrace: string[];
}

function computeModalDiagnostics(doc: GeneratedPdfDocument | null): ModalDiagnostics {
  const hasNav = typeof navigator !== 'undefined';
  const typeofShare = hasNav ? typeof navigator.share : 'undefined';
  const typeofCanShare = hasNav ? typeof navigator.canShare : 'undefined';
  const hasCanShare = hasNav && typeof navigator.canShare === 'function';
  const caps = detectShareCapabilities(doc?.file);
  const hasShare = caps.canUseWebShare;
  const canShareFiles = caps.canShareFiles;
  const isSecure = caps.isSecureContext;

  const isPdfValid = Boolean(doc?.file && isValidPdfFile(doc.file));

  const ua = hasNav ? navigator.userAgent : 'Unknown';
  const platform =
    hasNav
      ? (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
        navigator.platform ||
        'Unknown'
      : 'Unknown';

  const isBrave =
    hasNav &&
    (Boolean((navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave) ||
      ua.includes('Brave'));
  const isEdge = ua.includes('Edg/');
  const isChrome = !isBrave && !isEdge && ua.includes('Chrome/');
  const isSafari = !isBrave && !isEdge && !isChrome && ua.includes('Safari/');

  const browser = isBrave
    ? 'Brave'
    : isEdge
      ? 'Edge'
      : isChrome
        ? 'Chrome'
        : isSafari
          ? 'Safari'
          : 'Browser';

  const userAct =
    hasNav && (navigator as unknown as { userActivation?: { isActive?: boolean } }).userActivation
      ? (navigator as unknown as { userActivation: { isActive: boolean } }).userActivation.isActive
        ? 'Active (User gesture active)'
        : 'Inactive / Consumed'
      : 'Supported (Click context)';

  return {
    platform,
    browser,
    userAgent: ua,
    typeofShare,
    typeofCanShare,
    hasShare,
    hasCanShare,
    canShareFiles,
    isPdfValid,
    pdfFilename: doc?.file?.name || 'None',
    pdfMimeType: doc?.file?.type || 'None',
    pdfFileSize: doc?.file?.size ?? 0,
    isSecureContext: isSecure,
    userActivation: userAct,
    shareAttempted: false,
    lastShareResult: 'Not yet invoked',
    executionTrace: ['Ready — Click "Share PDF" to trace order of operations'],
  };
}

export interface WhatsAppNotice {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  whatsappUrl?: string;
  showProfileLink?: boolean;
  showDownloadAction?: boolean;
  showWhatsAppAction?: boolean;
  canNativeShare?: boolean;
}

export interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedPdfDocument | null;
  isLoading?: boolean;
  error?: string | null;
  /** Optional custom title override */
  title?: string;
  /** Optional callback after successful share or download */
  onActionComplete?: (action: 'download' | 'share' | 'print' | 'whatsapp') => void;
  /** Optional override for user profile (defaults to useAuth().profile) */
  userProfile?: UserProfile | null;
  /** Optional override for phone number */
  userPhone?: string | null;
  /** Optional recipient/customer/creditor name for counterparty documents */
  recipientName?: string | null;
  /** Optional recipient/customer/creditor phone number for counterparty documents */
  recipientPhone?: string | null;
  /** Flag indicating this is an external creditor/contact document (preserved for backwards compatibility) */
  isCreditorDocument?: boolean;
  /** Role/entity for contextual error messages and labels ('customer' | 'creditor' | 'contact') */
  recipientType?: 'customer' | 'creditor' | 'contact';
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  isLoading = false,
  error = null,
  title,
  onActionComplete,
  userProfile,
  userPhone,
  recipientName,
  recipientPhone,
  isCreditorDocument,
  recipientType,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [whatsAppNotice, setWhatsAppNotice] = useState<WhatsAppNotice | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsAppSharing, setIsWhatsAppSharing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(true);
  const [shareExecutionStatus, setShareExecutionStatus] = useState<{
    shareAttempted: boolean;
    lastShareResult: string;
    lastShareError?: string;
    userActivationAtStart?: string;
    userActivationBeforeShare?: string;
    executionTrace: string[];
  }>({
    shareAttempted: false,
    lastShareResult: 'Not yet invoked',
    executionTrace: ['Ready — Click "Share PDF" to trace order of operations'],
  });

  const diagnostics = useMemo<ModalDiagnostics>(() => {
    const base = computeModalDiagnostics(document);
    return {
      ...base,
      shareAttempted: shareExecutionStatus.shareAttempted,
      lastShareResult: shareExecutionStatus.lastShareResult,
      lastShareError: shareExecutionStatus.lastShareError,
      userActivationAtStart: shareExecutionStatus.userActivationAtStart,
      userActivationBeforeShare: shareExecutionStatus.userActivationBeforeShare,
      executionTrace: shareExecutionStatus.executionTrace.length > 0
        ? shareExecutionStatus.executionTrace
        : base.executionTrace,
    };
  }, [document, shareExecutionStatus]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const setTimedActionStatus = useCallback((msg: string | null) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setActionStatus(msg);
    if (msg) {
      statusTimerRef.current = setTimeout(() => {
        setActionStatus(null);
        statusTimerRef.current = null;
      }, 3500);
    }
  }, []);

  const auth = useAuth();
  const profileToUse = userProfile ?? auth.profile;

  const docType = document?.metadata?.documentType;

  // Determine if this document is for an external counterparty (Customer, Creditor, or Contact)
  const isExternalDoc = Boolean(
    isCreditorDocument ||
    recipientType !== undefined ||
    recipientPhone !== undefined ||
    recipientName ||
    document?.metadata?.recipientPhone !== undefined ||
    document?.metadata?.recipientName ||
    docType === 'qarz_receipt' ||
    docType === 'qarz_statement' ||
    docType === 'customer_credit_receipt' ||
    docType === 'customer_credit_statement'
  );

  // Determine specific recipient role: 'customer' | 'creditor' | 'contact'
  const effectiveRecipientType: 'customer' | 'creditor' | 'contact' = (() => {
    if (recipientType) return recipientType;
    if (docType === 'customer_credit_receipt' || docType === 'customer_credit_statement') return 'customer';
    if (docType === 'qarz_receipt' || docType === 'qarz_statement' || isCreditorDocument) return 'creditor';
    return 'contact';
  })();

  const entityTypeLabel =
    effectiveRecipientType === 'customer'
      ? 'Customer'
      : effectiveRecipientType === 'creditor'
        ? 'Creditor'
        : 'Contact';

  const effectiveRecipientName =
    recipientName ??
    document?.metadata?.recipientName ??
    (isExternalDoc ? entityTypeLabel : null);

  const effectiveRecipientPhone =
    recipientPhone !== undefined
      ? recipientPhone
      : (document?.metadata?.recipientPhone as string | null | undefined);

  // STRICT RECIPIENT RESOLUTION:
  // For external counterparty documents (Customer, Creditor, Contact): strictly use the counterparty's resolved phone.
  // NEVER fall back to auth.profile.phone or userPhone!
  // For personal documents: use userPhone ?? profileToUse?.phone.
  const targetPhone = isExternalDoc
    ? (effectiveRecipientPhone ?? null)
    : (userPhone ?? profileToUse?.phone ?? null);

  const handleClose = useCallback(() => {
    if (isSharing) return; // Prevent closing or cleaning up while native share sheet is active
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setActionStatus(null);
    setWhatsAppNotice(null);
    setIsSharing(false);
    setIsWhatsAppSharing(false);
    // Perform cleanup on close
    if (document?.cleanup) {
      document.cleanup();
    }
    onClose();
  }, [document, isSharing, onClose]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleDownload = () => {
    if (!document) return;
    try {
      downloadPdfBlob(document.objectUrl, document.filename);
      setTimedActionStatus('Downloaded successfully');
      onActionComplete?.('download');
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setActionStatus('Download failed');
    }
  };

  const handlePrint = () => {
    if (!document) return;
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        onActionComplete?.('print');
      } else {
        // Fallback: open in new window and print
        const printWindow = window.open(document.objectUrl, '_blank');
        printWindow?.addEventListener('load', () => {
          printWindow.print();
        });
        onActionComplete?.('print');
      }
    } catch (err) {
      console.error('Failed to print PDF:', err);
      // Fallback to download if printing is blocked by cross-origin/sandbox
      handleDownload();
    }
  };

  const handleShare = async () => {
    if (!document || isSharing) return;

    // 1. Capture user activation token status at immediate start of user gesture
    const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { userActivation?: { isActive?: boolean } }) : null;
    const initialActivation = nav?.userActivation?.isActive;
    const initialActivationStr =
      initialActivation === true
        ? 'Active (true)'
        : initialActivation === false
          ? 'Inactive (false)'
          : 'Unsupported';

    const file = document.file;
    const isValid = isValidPdfFile(file);
    const canShare = canSharePdfFile(file);

    const preShareActivation = nav?.userActivation?.isActive;
    const preShareActivationStr =
      preShareActivation === true
        ? 'Active (true)'
        : preShareActivation === false
          ? 'Inactive (false)'
          : 'Unsupported';

    const trace: string[] = [
      `1. share-button-clicked (userActivation: ${initialActivationStr})`,
      `2. pdf-file-resolved (${file?.name || 'none'}, ${file?.size ?? 0} B, ${file?.type || 'none'})`,
      `3. file-validation-completed (${isValid ? 'valid' : 'invalid'})`,
      `4. can-share-checked (${canShare ? 'true' : 'false'}, pre-share userActivation: ${preShareActivationStr})`,
    ];

    if (canShare) {
      trace.push('5. navigator-share-called');
    }

    setIsSharing(true);
    setActionStatus('Opening share sheet...');

    setShareExecutionStatus({
      shareAttempted: true,
      lastShareResult: 'Attempting native share...',
      lastShareError: undefined,
      userActivationAtStart: initialActivationStr,
      userActivationBeforeShare: preShareActivationStr,
      executionTrace: [...trace],
    });

    try {
      const result = await sharePdfFile(document);

      if (result.status === 'shared') {
        trace.push('6. navigator-share-resolved');
        setTimedActionStatus('PDF shared successfully');
        setShareExecutionStatus((prev) => ({
          ...prev,
          shareAttempted: true,
          lastShareResult: 'shared (Native share sheet completed)',
          executionTrace: [...trace],
        }));
        onActionComplete?.('share');
      } else if (result.status === 'cancelled') {
        // User closed or dismissed the share sheet - do not download, keep preview active
        trace.push('6. navigator-share-cancelled (User dismissed native share sheet)');
        setActionStatus(null);
        setShareExecutionStatus((prev) => ({
          ...prev,
          lastShareResult: 'cancelled (User dismissed native share sheet)',
          executionTrace: [...trace],
        }));
      } else if (result.status === 'unsupported') {
        // Desktop browser or device without Web Share Level 2 file sharing (e.g. Windows Brave / Desktop)
        // Strategy B Fallback: Display clear explanation and provide explicit separate actions
        // (Download PDF, Open WhatsApp) without forced download.
        trace.push(`6. navigator-share-unsupported: ${result.error?.message || 'Unsupported'}`);
        setActionStatus(null);
        setShareExecutionStatus((prev) => ({
          ...prev,
          lastShareResult: 'unsupported (Strategy B Desktop Fallback: Manual Download & WhatsApp)',
          executionTrace: [...trace],
        }));
        setWhatsAppNotice({
          type: 'info',
          title: 'Direct File Sharing Unavailable',
          message:
            'Your browser cannot share PDF files directly. Download the PDF and attach it manually in WhatsApp.',
          showDownloadAction: true,
          showWhatsAppAction: true,
        });
      } else if (result.status === 'failed') {
        // Native share rejected or threw error - DO NOT redirect to WhatsApp!
        trace.push(`6. navigator-share-rejected: ${result.error?.message || 'Rejected'}`);
        setActionStatus(null);
        const errMsg = result.error?.message || 'Could not complete file sharing.';
        setShareExecutionStatus((prev) => ({
          ...prev,
          lastShareResult: 'failed',
          lastShareError: errMsg,
          executionTrace: [...trace],
        }));
        setWhatsAppNotice({
          type: 'warning',
          title: 'Sharing Unsuccessful',
          message: `${errMsg} You can download the PDF manually.`,
          showDownloadAction: true,
          showWhatsAppAction: true,
        });
      }
    } catch (err: unknown) {
      console.warn('Direct PDF file sharing error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      trace.push(`error: ${errMsg}`);
      setActionStatus(null);
      setShareExecutionStatus((prev) => ({
        ...prev,
        lastShareResult: 'exception',
        lastShareError: errMsg,
        executionTrace: [...trace],
      }));
      setWhatsAppNotice({
        type: 'warning',
        title: 'Sharing Error',
        message: 'Could not complete file sharing. You can download the PDF manually.',
        showDownloadAction: true,
        showWhatsAppAction: true,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!document || isWhatsAppSharing) return;

    if (isExternalDoc) {
      if (!targetPhone || !targetPhone.trim()) {
        setWhatsAppNotice({
          type: 'error',
          title: `${entityTypeLabel} Phone Number Required`,
          message: `No phone number found for ${effectiveRecipientName || `this ${entityTypeLabel.toLowerCase()}`}. Please add their phone number in People Directory to open WhatsApp.`,
          showProfileLink: false,
        });
        return;
      }

      const validation = normalizeWhatsAppPhoneNumber(targetPhone, {
        entityType: effectiveRecipientType,
        entityName: effectiveRecipientName,
      });

      if (!validation.isValid) {
        setWhatsAppNotice({
          type: 'error',
          title: `Invalid ${entityTypeLabel} Phone Number`,
          message:
            validation.errorMessage ||
            `The phone number for ${effectiveRecipientName || `this ${entityTypeLabel.toLowerCase()}`} is invalid. Please update their number in People Directory with a valid international format (e.g. +91 98765 43210).`,
          showProfileLink: false,
        });
        return;
      }

      setIsWhatsAppSharing(true);
      try {
        const openResult = openWhatsAppConversation(validation.whatsappUrl!);

        if (openResult.opened) {
          setWhatsAppNotice({
            type: 'info',
            title: 'WhatsApp Conversation Opened',
            message: `Opened WhatsApp conversation for ${effectiveRecipientName || entityTypeLabel.toLowerCase()} (${validation.maskedNumber}). To send this PDF, please attach the document in WhatsApp. Direct file attachment is not supported by WhatsApp Web links; please download the PDF and attach it using WhatsApp's paperclip icon.`,
            whatsappUrl: validation.whatsappUrl,
            showDownloadAction: true,
            canNativeShare: diagnostics.canShareFiles,
          });
        } else {
          setWhatsAppNotice({
            type: 'warning',
            title: 'Browser Popup Blocked',
            message: `Your browser blocked opening WhatsApp automatically. Click "Open WhatsApp" below to proceed.`,
            whatsappUrl: validation.whatsappUrl,
            showDownloadAction: true,
            canNativeShare: diagnostics.canShareFiles,
          });
        }

        onActionComplete?.('whatsapp');
      } catch (err: unknown) {
        console.error(`Failed to open WhatsApp conversation for ${entityTypeLabel.toLowerCase()}:`, err);
        setWhatsAppNotice({
          type: 'error',
          title: 'WhatsApp Error',
          message: 'Failed to open WhatsApp conversation.',
          showDownloadAction: true,
        });
      } finally {
        setIsWhatsAppSharing(false);
      }
    } else {
      // Validate and normalize the authenticated user's profile phone
      const validation = normalizeWhatsAppPhoneNumber(targetPhone, {
        entityType: 'profile',
      });

      if (!validation.isValid) {
        setWhatsAppNotice({
          type: 'error',
          title: 'Profile Phone Number Required',
          message:
            validation.errorMessage ||
            'Please update your profile in Settings with a valid international phone number (e.g. +91 98765 43210).',
          showProfileLink: true,
        });
        return;
      }

      setIsWhatsAppSharing(true);
      try {
        // NOTE: Direct WhatsApp navigation only (cannot attach file via wa.me URL).
        const openResult = openWhatsAppConversation(validation.whatsappUrl!);

        if (openResult.opened) {
          setWhatsAppNotice({
            type: 'info',
            title: 'WhatsApp Conversation Opened',
            message: `Opened WhatsApp conversation for your profile number (${validation.maskedNumber}). To send this PDF, please attach the document in WhatsApp. Direct file attachment is not supported by WhatsApp Web links; please download the PDF and attach it using WhatsApp's paperclip icon.`,
            whatsappUrl: validation.whatsappUrl,
            showDownloadAction: true,
            canNativeShare: diagnostics.canShareFiles,
          });
        } else {
          // Browser popup blocker intercepted window.open
          setWhatsAppNotice({
            type: 'warning',
            title: 'Browser Popup Blocked',
            message: `Your browser blocked opening WhatsApp automatically. Click "Open WhatsApp" below to proceed.`,
            whatsappUrl: validation.whatsappUrl,
            showDownloadAction: true,
            canNativeShare: diagnostics.canShareFiles,
          });
        }

        onActionComplete?.('whatsapp');
      } catch (err: unknown) {
        console.error('Failed to initiate WhatsApp workflow:', err);
        setWhatsAppNotice({
          type: 'error',
          title: 'WhatsApp Error',
          message: 'Failed to open WhatsApp conversation.',
          showDownloadAction: true,
        });
      } finally {
        setIsWhatsAppSharing(false);
      }
    }
  };

  const handleNativeFileShare = async () => {
    if (!document || isSharing) return;
    await handleShare();
  };

  if (!isOpen) return null;

  const displayTitle = title || document?.title || 'PDF Document Preview';
  const category = document?.metadata.documentCategory || 'DOCUMENT';

  const categoryColorClass =
    {
      RECEIPT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      STATEMENT: 'bg-blue-100 text-blue-800 border-blue-200',
      ACKNOWLEDGEMENT: 'bg-purple-100 text-purple-800 border-purple-200',
      REPORT: 'bg-slate-100 text-slate-800 border-slate-200',
      DOCUMENT: 'bg-slate-100 text-slate-800 border-slate-200',
    }[category] || 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
    >
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#D9E0E8] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-[#D9E0E8] gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="pdf-preview-title"
                  className="text-base sm:text-lg font-bold text-[#172B4D] truncate"
                >
                  {displayTitle}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${categoryColorClass}`}
                >
                  {category}
                </span>
              </div>
              {document?.filename && (
                <p className="text-xs text-[#52627A] truncate font-mono">
                  {document.filename}
                </p>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {document && !isLoading && (
              <>
                {/* Print button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-8.5 px-2.5 sm:px-3 text-xs font-semibold text-[#172B4D] border-[#D9E0E8] hover:bg-slate-50 cursor-pointer"
                  title="Print PDF"
                >
                  <Printer className="h-3.5 w-3.5 sm:mr-1.5 text-[#52627A]" />
                  <span className="hidden sm:inline">Print</span>
                </Button>

                {/* Download button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8.5 px-2.5 sm:px-3 text-xs font-semibold text-[#172B4D] border-[#D9E0E8] hover:bg-slate-50 cursor-pointer"
                  title="Download PDF"
                  data-testid="download-pdf-button"
                >
                  <Download className="h-3.5 w-3.5 sm:mr-1.5 text-[#52627A]" />
                  <span className="hidden sm:inline">Download</span>
                </Button>

                {/* Open WhatsApp conversation button (chat link only, separate from Share PDF) */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWhatsAppClick}
                  disabled={isWhatsAppSharing}
                  className="h-8.5 px-2.5 sm:px-3 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                  title={
                    isExternalDoc
                      ? effectiveRecipientName
                        ? `Open WhatsApp with ${effectiveRecipientName}`
                        : `Open WhatsApp with ${entityTypeLabel}`
                      : 'Open WhatsApp Conversation (Profile Number)'
                  }
                  aria-label="Open WhatsApp"
                  data-testid="open-whatsapp-button"
                >
                  {isWhatsAppSharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5 text-emerald-600" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5 sm:mr-1.5 text-emerald-600" />
                  )}
                  <span className="hidden sm:inline">Open WhatsApp</span>
                </Button>

                {/* Share PDF button (PRIMARY ACTION - native file share sheet with attached PDF) */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="h-8.5 px-2.5 sm:px-3 text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white cursor-pointer shadow-xs inline-flex items-center"
                  title={
                    diagnostics.canShareFiles
                      ? 'Share PDF directly using native share sheet'
                      : 'Share PDF'
                  }
                  aria-label="Share PDF"
                  data-testid="share-pdf-button"
                >
                  {isSharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  <span>Share PDF</span>
                </Button>

                {/* Toggle Diagnostics Panel */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiagnostics((prev) => !prev)}
                  className="h-8.5 px-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                  title="Toggle runtime sharing diagnostics panel"
                  aria-label="Toggle Diagnostics"
                  data-testid="toggle-diagnostics-btn"
                >
                  <Terminal className="h-3.5 w-3.5 sm:mr-1 text-slate-500" />
                  <span className="hidden sm:inline">
                    {showDiagnostics ? 'Diagnostics' : 'Diag'}
                  </span>
                </Button>
              </>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              aria-label="Close PDF preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* General Action Status Notification Bar */}
        {actionStatus && (
          <div className="bg-slate-900 text-white text-xs px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-2 duration-150">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {actionStatus}
            </span>
          </div>
        )}

        {/* Dedicated WhatsApp / Share Notification Bar */}
        {whatsAppNotice && (
          <div
            role="alert"
            className={`px-4 py-3 text-xs border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in slide-in-from-top-2 duration-150 ${
              whatsAppNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : whatsAppNotice.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : whatsAppNotice.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              {whatsAppNotice.type === 'error' ? (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : whatsAppNotice.type === 'warning' ? (
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : whatsAppNotice.type === 'info' ? (
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="min-w-0">
                <p className="font-bold">{whatsAppNotice.title}</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {whatsAppNotice.message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
              {whatsAppNotice.showDownloadAction && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-2.5 py-1 bg-slate-800 text-white font-semibold rounded-lg text-xs hover:bg-slate-900 transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="h-3 w-3" /> Download PDF
                </button>
              )}
              {whatsAppNotice.showWhatsAppAction && (
                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  className="px-2.5 py-1 bg-emerald-600 text-white font-semibold rounded-lg text-xs hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <MessageCircle className="h-3 w-3" />{' '}
                  {isExternalDoc ? `Open ${entityTypeLabel} WhatsApp` : 'Open WhatsApp'}
                </button>
              )}
              {whatsAppNotice.whatsappUrl && (
                <a
                  href={whatsAppNotice.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-600 text-white font-semibold rounded-lg text-xs hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 shadow-2xs"
                >
                  Open WhatsApp <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {whatsAppNotice.canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeFileShare}
                  className="px-2.5 py-1 bg-blue-600 text-white font-semibold rounded-lg text-xs hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                >
                  <Share2 className="h-3 w-3" /> Share File Directly
                </button>
              )}
              {whatsAppNotice.showProfileLink && (
                <a
                  href="#/settings?tab=profile"
                  onClick={handleClose}
                  className="px-2.5 py-1 bg-amber-600 text-white font-semibold rounded-lg text-xs hover:bg-amber-700 transition-colors shadow-2xs"
                >
                  Update Profile
                </a>
              )}
              <button
                type="button"
                onClick={() => setWhatsAppNotice(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors ml-1 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Runtime Diagnostics Panel (Zero PII) */}
        {showDiagnostics && (
          <div
            data-testid="runtime-diagnostic-panel"
            className="bg-slate-900 border-b border-slate-800 text-slate-200 text-xs px-4 py-2.5 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-blue-400" />
                PDF Sharing Runtime Diagnostics
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Environment Telemetry (Zero PII)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Browser & Platform</div>
                <div className="font-bold text-white truncate" title={diagnostics.userAgent}>
                  {diagnostics.browser} ({diagnostics.platform})
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Secure Context (HTTPS)</div>
                <div className={diagnostics.isSecureContext ? "font-bold text-emerald-400" : "font-bold text-rose-400"}>
                  {diagnostics.isSecureContext ? "Yes (Secure)" : "No (Insecure)"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">typeof navigator.share</div>
                <div className={diagnostics.hasShare ? "font-bold text-emerald-400 truncate" : "font-bold text-amber-400 truncate"}>
                  {diagnostics.typeofShare} ({diagnostics.hasShare ? "available" : "unavailable"})
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">typeof navigator.canShare</div>
                <div className={diagnostics.hasCanShare ? "font-bold text-emerald-400 truncate" : "font-bold text-amber-400 truncate"}>
                  {diagnostics.typeofCanShare} ({diagnostics.hasCanShare ? "available" : "unavailable"})
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">canShare({'{ files: [PDF] }'})</div>
                <div className={diagnostics.canShareFiles ? "font-bold text-emerald-400" : "font-bold text-amber-400"}>
                  {diagnostics.canShareFiles ? "true (Supported)" : "false (Unsupported)"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">PDF File Validity</div>
                <div className={diagnostics.isPdfValid ? "font-bold text-emerald-400 truncate" : "font-bold text-rose-400"}>
                  {diagnostics.isPdfValid ? `${diagnostics.pdfFilename} (${diagnostics.pdfFileSize} B)` : "Invalid File"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">User Activation Status</div>
                <div className="font-bold text-blue-300 truncate">
                  {diagnostics.userActivationAtStart
                    ? `${diagnostics.userActivationAtStart} → ${diagnostics.userActivationBeforeShare || 'pending'}`
                    : diagnostics.userActivation}
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">navigator.share() Called</div>
                <div className={diagnostics.shareAttempted ? "font-bold text-emerald-400" : "font-bold text-slate-300"}>
                  {diagnostics.shareAttempted ? "Yes (Invoked)" : "No (Awaiting Action)"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Actual Share Result</div>
                <div className={
                  diagnostics.lastShareResult === 'shared'
                    ? "font-bold text-emerald-400 truncate"
                    : diagnostics.lastShareResult === 'failed'
                    ? "font-bold text-rose-400 truncate"
                    : diagnostics.lastShareResult.startsWith('unsupported')
                    ? "font-bold text-amber-400 truncate"
                    : "font-bold text-slate-300 truncate"
                }>
                  {diagnostics.lastShareResult}
                  {diagnostics.lastShareError ? `: ${diagnostics.lastShareError}` : ''}
                </div>
              </div>
            </div>

            {/* Step-by-Step Diagnostic Execution Trace */}
            <div className="mt-2.5 pt-2 border-t border-slate-800 font-mono text-[11px]" data-testid="diagnostic-trace-section">
              <div className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider mb-1 flex items-center justify-between">
                <span>Execution Trace (Order of Operations):</span>
                <span className="text-slate-500 font-normal">Active gesture check: {diagnostics.userActivationAtStart || 'Awaiting click'} → {diagnostics.userActivationBeforeShare || 'Pending'}</span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-slate-800/80 space-y-1">
                {diagnostics.executionTrace.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-blue-400 font-bold select-none">▶</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Body / Viewer */}
        <div className="flex-1 bg-slate-100 overflow-hidden relative flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8">
              <Loader2 className="h-10 w-10 text-[#2563EB] animate-spin" />
              <p className="text-sm font-semibold text-[#172B4D]">
                Generating PDF document...
              </p>
              <p className="text-xs text-[#52627A]">
                Rendering authoritative vector layout and calculations
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-md">
              <div className="p-3 bg-red-100 text-red-600 rounded-full">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-[#172B4D]">
                Unable to Generate PDF
              </h3>
              <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 font-mono w-full text-left">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="mt-2 text-xs font-semibold"
              >
                Close
              </Button>
            </div>
          ) : document ? (
            <div className="w-full h-full flex flex-col">
              <iframe
                ref={iframeRef}
                src={document.objectUrl}
                title={document.title}
                className="w-full h-full border-none bg-white"
              />
              <noscript>
                <div className="p-4 bg-white text-center text-xs">
                  <a
                    href={document.objectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2563EB] underline flex items-center justify-center gap-1"
                  >
                    Open PDF in new tab <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </noscript>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-slate-500">
              <FileText className="h-10 w-10 text-slate-300" />
              <p className="text-xs">No PDF document ready for preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default PdfPreviewModal;
