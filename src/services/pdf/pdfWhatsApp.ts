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

export interface PhoneNormalizationOptions {
  /** Optional country code to assume or enforce (e.g. "91" or "+91") */
  countryCode?: string | null;
  /** Role/entity for contextual error messages ('profile' | 'customer' | 'creditor' | 'contact') */
  entityType?: 'profile' | 'customer' | 'creditor' | 'contact';
  /** Entity display name for contextual error messages (e.g. "ummar bai") */
  entityName?: string | null;
}

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
 * Normalizes and validates a phone number for WhatsApp click-to-chat.
 *
 * Rules:
 * 1. Rejects missing, empty, or whitespace-only phone numbers.
 * 2. Rejects invalid characters (letters or special characters other than +, -, (, ), ., space).
 * 3. Strips spaces, hyphens, brackets, and periods.
 * 4. Recognizes leading '+' or leading '00' (international exit code) as explicit country codes.
 * 5. Supports separate countryCode parameter or PhoneNormalizationOptions if provided.
 * 6. Normalizes valid Indian national mobile numbers (10 digits starting with 6, 7, 8, or 9)
 *    to '+91' plus 10 digits without double-prefixing.
 * 7. Normalizes numbers with national trunk prefix 0 followed by 10-digit Indian mobile to +91.
 * 8. Enforces ITU-T E.164 length constraints (8 to 15 digits).
 */
export function normalizeWhatsAppPhoneNumber(
  rawPhone: string | null | undefined,
  countryCodeOrOptions?: string | null | PhoneNormalizationOptions,
  extraOptions?: PhoneNormalizationOptions
): WhatsAppPhoneResult {
  let countryCode: string | null | undefined;
  let options: PhoneNormalizationOptions | undefined;

  if (typeof countryCodeOrOptions === 'object' && countryCodeOrOptions !== null) {
    options = countryCodeOrOptions;
    countryCode = options.countryCode;
  } else if (typeof countryCodeOrOptions === 'string') {
    countryCode = countryCodeOrOptions;
    options = extraOptions;
  } else {
    countryCode = null;
    options = extraOptions;
  }

  const entityType = options?.entityType ?? 'profile';
  const entityName = options?.entityName ?? null;

  const entityLabel =
    entityType === 'customer'
      ? 'Customer'
      : entityType === 'creditor'
        ? 'Creditor'
        : entityType === 'contact'
          ? 'Contact'
          : 'Profile';

  const entityDescriptor = entityName || `this ${entityLabel.toLowerCase()}`;

  const getMissingPhoneMessage = () => {
    if (entityType === 'profile') {
      return 'No phone number found in your profile. Please add your international phone number (e.g. +91 98765 43210) in Settings > Profile to use WhatsApp sharing.';
    }
    return `No phone number found for ${entityDescriptor}. Please add their phone number in People Directory to open WhatsApp.`;
  };

  const getInvalidFormatMessage = () => {
    if (entityType === 'profile') {
      return 'Profile phone number contains invalid characters. Please update your profile in Settings with digits and country code (e.g. +91 98765 43210).';
    }
    return `The phone number for ${entityDescriptor} contains invalid characters. Please update their number in People Directory (e.g. +91 98765 43210).`;
  };

  const getMissingCountryCodeMessage = (trunk = false) => {
    if (entityType === 'profile') {
      if (trunk) {
        return 'Your profile phone number includes a national trunk prefix (0) without an international country code. Please update your profile with a full country code (e.g. +91 98765 43210).';
      }
      return 'Your profile phone number is missing an international country code. Please update your profile with your country code (e.g. +91 98765 43210).';
    }
    if (trunk) {
      return `The phone number for ${entityDescriptor} includes a national trunk prefix (0) without an international country code. Please update their number in People Directory with a full country code (e.g. +91 98765 43210).`;
    }
    return `The phone number for ${entityDescriptor} is missing an international country code. Please update their number in People Directory with a valid format (e.g. +91 98765 43210).`;
  };

  const getTooShortMessage = () => {
    if (entityType === 'profile') {
      return 'Phone number is too short to be a valid international number. Please update your profile in Settings.';
    }
    return `The phone number for ${entityDescriptor} is too short. Please update their number in People Directory.`;
  };

  const getTooLongMessage = () => {
    if (entityType === 'profile') {
      return 'Phone number exceeds the maximum international length of 15 digits. Please update your profile in Settings.';
    }
    return `The phone number for ${entityDescriptor} exceeds the maximum international length of 15 digits. Please update their number in People Directory.`;
  };

  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'MISSING_PHONE',
      errorMessage: getMissingPhoneMessage(),
    };
  }

  const trimmed = rawPhone.trim();

  // Check for invalid characters (letters, unexpected symbols)
  if (/[^\d\s+\-().]/.test(trimmed)) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'INVALID_FORMAT',
      errorMessage: getInvalidFormatMessage(),
    };
  }

  const hasPlus = trimmed.startsWith('+');
  const hasDoubleZero = trimmed.startsWith('00');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  const cleanCountryCode = countryCode ? countryCode.replace(/[^\d]/g, '') : '';

  let resolvedDigits = '';

  if (hasDoubleZero) {
    // 00 is international exit code (e.g. 00917006138763 -> 917006138763)
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
    // No leading +, no 00, no explicit country code supplied:

    // 1. Check if digits already start with Indian international code '91' followed by a 10-digit Indian mobile number
    // (12 digits total: 91 + [6-9]\d{9}, e.g. 917006138763 or 919876543210)
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]/.test(digitsOnly.slice(2))) {
      resolvedDigits = digitsOnly;
    }
    // 2. Check if national 10-digit Indian mobile number starting with 6, 7, 8, or 9 (/^[6-9]\d{9}$/)
    else if (/^[6-9]\d{9}$/.test(digitsOnly)) {
      resolvedDigits = `91${digitsOnly}`;
    }
    // 3. Check if 11 digits starting with national trunk prefix '0' followed by 10-digit Indian mobile (/^0[6-9]\d{9}$/)
    else if (/^0[6-9]\d{9}$/.test(digitsOnly)) {
      resolvedDigits = `91${digitsOnly.slice(1)}`;
    }
    // 4. Numbers starting with trunk '0' that are NOT valid Indian mobile numbers
    else if (digitsOnly.startsWith('0')) {
      return {
        isValid: false,
        normalizedNumber: '',
        errorCode: 'MISSING_COUNTRY_CODE',
        errorMessage: getMissingCountryCodeMessage(true),
      };
    }
    // 5. 10 digits or fewer that do NOT match an Indian mobile number
    else if (digitsOnly.length <= 10) {
      return {
        isValid: false,
        normalizedNumber: '',
        errorCode: 'MISSING_COUNTRY_CODE',
        errorMessage: getMissingCountryCodeMessage(false),
      };
    }
    // 6. 11 to 15 digits without a leading + (assume already international)
    else {
      resolvedDigits = digitsOnly;
    }
  }

  // Length validation according to E.164: 8 to 15 digits
  if (resolvedDigits.length < 8) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'TOO_SHORT',
      errorMessage: getTooShortMessage(),
    };
  }

  if (resolvedDigits.length > 15) {
    return {
      isValid: false,
      normalizedNumber: '',
      errorCode: 'TOO_LONG',
      errorMessage: getTooLongMessage(),
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

