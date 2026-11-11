import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/useAuth';
import type { GeneratedPdfDocument } from '@/services/pdf/pdfTypes';
import { shareOrDownloadPdf, detectShareCapabilities, downloadPdfBlob } from '@/services/pdf/pdfShare';
import { normalizeWhatsAppPhoneNumber, openWhatsAppConversation } from '@/services/pdf/pdfWhatsApp';
import type { UserProfile } from '@/types/auth';

export interface WhatsAppNotice {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  whatsappUrl?: string;
  showProfileLink?: boolean;
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
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [whatsAppNotice, setWhatsAppNotice] = useState<WhatsAppNotice | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsAppSharing, setIsWhatsAppSharing] = useState(false);
  const shareCaps = detectShareCapabilities();

  const auth = useAuth();
  const profileToUse = userProfile ?? auth.profile;
  const phoneToUse = userPhone ?? profileToUse?.phone;

  const handleClose = useCallback(() => {
    setActionStatus(null);
    setWhatsAppNotice(null);
    setIsSharing(false);
    setIsWhatsAppSharing(false);
    // Perform cleanup on close
    if (document?.cleanup) {
      document.cleanup();
    }
    onClose();
  }, [document, onClose]);

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
      setActionStatus('Downloaded successfully');
      setTimeout(() => setActionStatus(null), 3500);
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
    setIsSharing(true);
    setActionStatus('Preparing to share...');

    try {
      const result = await shareOrDownloadPdf(document);
      if (result.status === 'shared') {
        setActionStatus('Shared successfully');
      } else if (result.status === 'downloaded') {
        setActionStatus('Downloaded (Share sheet unavailable on this device)');
      } else {
        setActionStatus(null);
      }
      setTimeout(() => setActionStatus(null), 4000);
      onActionComplete?.('share');
    } catch (err) {
      console.error('Failed to share PDF:', err);
      setActionStatus('Share error - downloading file instead');
      handleDownload();
    } finally {
      setIsSharing(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!document || isWhatsAppSharing) return;

    // Validate and normalize the authenticated user's profile phone
    const validation = normalizeWhatsAppPhoneNumber(phoneToUse);

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
      // 1. Ensure the generated PDF is saved/downloaded locally for manual attachment
      downloadPdfBlob(document.objectUrl, document.filename);

      // 2. Open WhatsApp conversation with the user's normalized profile number
      const openResult = openWhatsAppConversation(validation.whatsappUrl!);

      if (openResult.opened) {
        setWhatsAppNotice({
          type: 'success',
          title: 'WhatsApp Conversation Opened',
          message: `Opened WhatsApp conversation for your profile number (${validation.maskedNumber}). The PDF has been downloaded to your device — attach it using the paperclip (+) icon in WhatsApp.`,
          whatsappUrl: validation.whatsappUrl,
          canNativeShare: shareCaps.canShareFiles,
        });
      } else {
        // Browser popup blocker intercepted window.open
        setWhatsAppNotice({
          type: 'warning',
          title: 'Browser Popup Blocked',
          message: `Your browser blocked opening WhatsApp automatically. Click "Open WhatsApp" below to proceed. The PDF has been downloaded to your device.`,
          whatsappUrl: validation.whatsappUrl,
          canNativeShare: shareCaps.canShareFiles,
        });
      }

      onActionComplete?.('whatsapp');
    } catch (err: unknown) {
      console.error('Failed to initiate WhatsApp workflow:', err);
      setWhatsAppNotice({
        type: 'error',
        title: 'WhatsApp Error',
        message: 'Failed to open WhatsApp. The PDF has been downloaded to your device.',
      });
    } finally {
      setIsWhatsAppSharing(false);
    }
  };

  const handleNativeFileShare = async () => {
    if (!document) return;
    try {
      await navigator.share({
        title: document.title,
        text: document.title,
        files: [document.file],
      });
      setWhatsAppNotice({
        type: 'success',
        title: 'Shared Successfully',
        message: 'PDF document shared via system share sheet.',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled share sheet
        return;
      }
      console.warn('Native file share failed:', err);
    }
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
                >
                  <Download className="h-3.5 w-3.5 sm:mr-1.5 text-[#52627A]" />
                  <span className="hidden sm:inline">Download</span>
                </Button>

                {/* WhatsApp Share button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWhatsAppClick}
                  disabled={isWhatsAppSharing}
                  className="h-8.5 px-2.5 sm:px-3 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                  title="Share to WhatsApp (Profile Number)"
                >
                  {isWhatsAppSharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5 text-emerald-600" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5 sm:mr-1.5 text-emerald-600" />
                  )}
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>

                {/* General Share button */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="h-8.5 px-2.5 sm:px-3 text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                  title={
                    shareCaps.canShareFiles
                      ? 'Share via system share sheet (WhatsApp, etc.)'
                      : 'Download & share file'
                  }
                >
                  {isSharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5 sm:mr-1.5" />
                  )}
                  <span className="hidden sm:inline">
                    {shareCaps.canShareFiles ? 'Share' : 'Download & Share'}
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

        {/* Dedicated WhatsApp Sharing Notification Bar */}
        {whatsAppNotice && (
          <div
            role="alert"
            className={`px-4 py-3 text-xs border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in slide-in-from-top-2 duration-150 ${
              whatsAppNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : whatsAppNotice.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              {whatsAppNotice.type === 'error' ? (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : whatsAppNotice.type === 'warning' ? (
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
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
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
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
                  className="px-2.5 py-1 bg-blue-600 text-white font-semibold rounded-lg text-xs hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                >
                  Share File (OS Sheet)
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
