/**
 * 7TIME PDF Generation & Native Sharing Subsystem
 * WhatsApp Sharing & Profile Phone Number Normalization Module
 *
 * Implements strict international number normalization (E.164),
 * click-to-chat URL generation, and manual PDF attachment workflow.
 * Privacy rule: Does not expose or log raw phone numbers in application logs.
 */

export type PhoneValidationErrorCode =
  | 'MISSING_PHONE'
  | 'INVALID_FORMAT'
  | 'MISSING_COUNTRY_CODE'
  | 'TOO_SHORT'
  | 'TOO_LONG';

export interface WhatsAppPhoneResult {
  /** Whether the phone number is a valid international format for WhatsApp */
  isValid: boolean;
  /** Normalized digits-only international number (e.g. "919876543210"), empty string if invalid */
  normalizedNumber: string;
  /** Formatted WhatsApp click-to-chat URL: https://wa.me/<normalizedNumber> */
  whatsappUrl?: string;
  /** Masked phone number representation for safe UI display (e.g. "+91 ••••• ••210") */
  maskedNumber?: string;
  /** Specific error code if validation failed */
  errorCode?: PhoneValidationErrorCode;
  /** User-friendly error message guiding the user to update their profile */
  errorMessage?: string;
}

/**
 * Masks a phone number for display in the UI so the user can verify their
 * profile number without exposing full details or leaking raw PII.
 * Example: "919876543210" -> "+91 ••••• ••210"
 */
export function maskPhoneNumber(phoneDigits: string): string {
  const digits = phoneDigits.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length <= 5) {
    return `••••${digits.slice(-2)}`;
  }
  const prefix = digits.slice(0, 2);
  const suffix = digits.slice(-3);
  return `+${prefix} ••••• ••${suffix}`;
}

/**
 * Normalizes and validates a profile phone number for WhatsApp click-to-chat.
 *
 * Rules:
 * 1. Rejects missing, empty, or whitespace-only phone numbers.
 * 2. Rejects invalid characters (letters or special characters other than +, -, (, ), ., space).
 * 3. Strips spaces, hyphens, brackets, and periods.
 * 4. Recognizes leading '+' or leading '00' (international exit code) as explicit country codes.
 * 5. Supports separate countryCode parameter if provided.
 * 6. Strictly DOES NOT blindly prepend India's code (+91) or any default country code.
 *    If country code is missing or cannot be reliably determined (e.g. 10 digits without +),
 *    it returns MISSING_COUNTRY_CODE so the user is guided to update their profile.
 * 7. Enforces ITU-T E.164 length constraints (8 to 15 digits).
 */
export function normalizeWhatsAppPhoneNumber(
  rawPhone: string | null | undefined,
  countryCode?: string | null
): WhatsAppPhoneResult {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'MISSING_PHONE',
      errorMessage:
        'No phone number found in your profile. Please add your international phone number (e.g. +91 98765 43210) in Settings > Profile to use WhatsApp sharing.',
    };
  }

  const trimmed = rawPhone.trim();

  // Check for invalid characters (letters, unexpected symbols)
  if (/[^\d\s+\-().]/.test(trimmed)) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'INVALID_FORMAT',
      errorMessage:
        'Profile phone number contains invalid characters. Please update your profile in Settings with digits and country code (e.g. +91 98765 43210).',
    };
  }

  const hasPlus = trimmed.startsWith('+');
  const hasDoubleZero = trimmed.startsWith('00');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  const cleanCountryCode = countryCode ? countryCode.replace(/[^\d]/g, '') : '';

  let resolvedDigits = '';

  if (hasDoubleZero) {
    // 00 is international exit code (e.g. 00919876543210 -> 919876543210)
    resolvedDigits = digitsOnly.replace(/^00/, '');
  } else if (hasPlus) {
    // Leading + explicitly indicates an international number
    resolvedDigits = digitsOnly;
  } else if (cleanCountryCode) {
    // Country code supplied separately
    resolvedDigits = digitsOnly.startsWith(cleanCountryCode)
      ? digitsOnly
      : `${cleanCountryCode}${digitsOnly}`;
  } else {
    // No leading +, no 00, no explicit country code supplied
    if (digitsOnly.startsWith('0')) {
      // Numbers starting with trunk '0' (e.g. UK 07... or India 098...) are missing international country code
      return {
        isValid: false,
        normalizedNumber: '',
        errorCode: 'MISSING_COUNTRY_CODE',
        errorMessage:
          'Your profile phone number includes a national trunk prefix (0) without an international country code. Please update your profile with a full country code (e.g. +91 98765 43210).',
      };
    }

    if (digitsOnly.length <= 10) {
      // 10 digits or fewer without a country code cannot be reliably mapped without guessing.
      // Do not blindly guess or default to India (+91)
      return {
        isValid: false,
        normalizedNumber: '',
        errorCode: 'MISSING_COUNTRY_CODE',
        errorMessage:
          'Your profile phone number is missing an international country code. Please update your profile with your country code (e.g. +91 98765 43210).',
      };
    }

    // If 11 to 15 digits without a leading +, assume it is already a normalized international number
    resolvedDigits = digitsOnly;
  }

  // Length validation according to E.164: 8 to 15 digits
  if (resolvedDigits.length < 8) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'TOO_SHORT',
      errorMessage:
        'Phone number is too short to be a valid international number. Please update your profile in Settings.',
    };
  }

  if (resolvedDigits.length > 15) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'TOO_LONG',
      errorMessage:
        'Phone number exceeds the maximum international length of 15 digits. Please update your profile in Settings.',
    };
  }

  const whatsappUrl = buildWhatsAppUrl(resolvedDigits);
  const maskedNumber = maskPhoneNumber(resolvedDigits);

  return {
    isValid: true,
    normalizedNumber: resolvedDigits,
    whatsappUrl,
    maskedNumber,
  };
}

/**
 * Builds the official WhatsApp click-to-chat URL:
 * https://wa.me/<number>
 * With optional prefilled text message parameter.
 */
export function buildWhatsAppUrl(normalizedNumber: string, message?: string): string {
  const cleanNumber = normalizedNumber.replace(/[^\d]/g, '');
  const baseUrl = `https://wa.me/${cleanNumber}`;
  if (!message || !message.trim()) {
    return baseUrl;
  }
  return `${baseUrl}?text=${encodeURIComponent(message.trim())}`;
}

export interface OpenWhatsAppResult {
  opened: boolean;
  popupBlocked?: boolean;
  error?: string;
}

/**
 * Safely opens a WhatsApp click-to-chat URL in a new window/tab.
 * Handles popup blockers gracefully without throwing exceptions.
 */
export function openWhatsAppConversation(whatsappUrl: string): OpenWhatsAppResult {
  if (typeof window === 'undefined') {
    return { opened: false, error: 'Window context is unavailable.' };
  }

  try {
    const popup = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      return {
        opened: false,
        popupBlocked: true,
        error: 'Browser popup blocker prevented opening WhatsApp automatically.',
      };
    }
    return { opened: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      opened: false,
      popupBlocked: true,
      error: errorMsg,
    };
  }
}

