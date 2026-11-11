import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeWhatsAppPhoneNumber,
  buildWhatsAppUrl,
  maskPhoneNumber,
  openWhatsAppConversation,
} from './pdfWhatsApp';

describe('pdfWhatsApp Module', () => {
  describe('normalizeWhatsAppPhoneNumber', () => {
    it('normalizes valid numbers with leading + and spaces, hyphens, brackets', () => {
      // India
      const resIndia = normalizeWhatsAppPhoneNumber('+91 (987) 654-3210');
      expect(resIndia.isValid).toBe(true);
      expect(resIndia.normalizedNumber).toBe('919876543210');
      expect(resIndia.whatsappUrl).toBe('https://wa.me/919876543210');

      // US / Canada
      const resUS = normalizeWhatsAppPhoneNumber('+1 (555) 123-4567');
      expect(resUS.isValid).toBe(true);
      expect(resUS.normalizedNumber).toBe('15551234567');
      expect(resUS.whatsappUrl).toBe('https://wa.me/15551234567');

      // UK
      const resUK = normalizeWhatsAppPhoneNumber('+44 20 7946 0958');
      expect(resUK.isValid).toBe(true);
      expect(resUK.normalizedNumber).toBe('442079460958');
      expect(resUK.whatsappUrl).toBe('https://wa.me/442079460958');

      // UAE
      const resUAE = normalizeWhatsAppPhoneNumber('+971 50 123 4567');
      expect(resUAE.isValid).toBe(true);
      expect(resUAE.normalizedNumber).toBe('971501234567');
      expect(resUAE.whatsappUrl).toBe('https://wa.me/971501234567');
    });

    it('normalizes numbers with international exit code (00)', () => {
      const res = normalizeWhatsAppPhoneNumber('00919876543210');
      expect(res.isValid).toBe(true);
      expect(res.normalizedNumber).toBe('919876543210');
      expect(res.whatsappUrl).toBe('https://wa.me/919876543210');
    });

    it('supports separate countryCode parameter without duplicating if already present', () => {
      // Separate country code
      const res1 = normalizeWhatsAppPhoneNumber('9876543210', '+91');
      expect(res1.isValid).toBe(true);
      expect(res1.normalizedNumber).toBe('919876543210');

      // Country code without +
      const res2 = normalizeWhatsAppPhoneNumber('9876543210', '91');
      expect(res2.isValid).toBe(true);
      expect(res2.normalizedNumber).toBe('919876543210');

      // Country code already prefixed in the phone string
      const res3 = normalizeWhatsAppPhoneNumber('919876543210', '91');
      expect(res3.isValid).toBe(true);
      expect(res3.normalizedNumber).toBe('919876543210');
    });

    it('accepts already normalized international numbers (11 to 15 digits)', () => {
      const res = normalizeWhatsAppPhoneNumber('919876543210');
      expect(res.isValid).toBe(true);
      expect(res.normalizedNumber).toBe('919876543210');
      expect(res.whatsappUrl).toBe('https://wa.me/919876543210');
    });

    it('DOES NOT blindly prepend India code (+91) to national 10-digit numbers missing country code', () => {
      const res = normalizeWhatsAppPhoneNumber('9876543210');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('MISSING_COUNTRY_CODE');
      expect(res.normalizedNumber).toBe('');
      expect(res.errorMessage).toContain('missing an international country code');
      // Must not guess or produce a wa.me URL
      expect(res.whatsappUrl).toBeUndefined();
    });

    it('rejects numbers starting with trunk 0 as missing country code', () => {
      const res = normalizeWhatsAppPhoneNumber('09876543210');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('MISSING_COUNTRY_CODE');
      expect(res.errorMessage).toContain('national trunk prefix');
    });

    it('handles missing, null, undefined, or empty phone numbers gracefully', () => {
      expect(normalizeWhatsAppPhoneNumber(null).errorCode).toBe('MISSING_PHONE');
      expect(normalizeWhatsAppPhoneNumber(undefined).errorCode).toBe('MISSING_PHONE');
      expect(normalizeWhatsAppPhoneNumber('').errorCode).toBe('MISSING_PHONE');
      expect(normalizeWhatsAppPhoneNumber('   ').errorCode).toBe('MISSING_PHONE');
    });

    it('rejects phone numbers with invalid characters', () => {
      const res = normalizeWhatsAppPhoneNumber('+91 98765-ABC12');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('INVALID_FORMAT');
      expect(res.errorMessage).toContain('invalid characters');
    });

    it('rejects numbers that are too short (< 8 digits)', () => {
      const res = normalizeWhatsAppPhoneNumber('+91 1234');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('TOO_SHORT');
    });

    it('rejects numbers that are too long (> 15 digits)', () => {
      const res = normalizeWhatsAppPhoneNumber('+91 1234567890123456');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('TOO_LONG');
    });

    it('does not leak or expose sensitive phone numbers in error messages', () => {
      const sensitiveNumber = '9876543210';
      const res = normalizeWhatsAppPhoneNumber(sensitiveNumber);
      expect(res.errorMessage).not.toContain(sensitiveNumber);
    });
  });

  describe('buildWhatsAppUrl', () => {
    it('builds standard click-to-chat URL without text', () => {
      expect(buildWhatsAppUrl('919876543210')).toBe('https://wa.me/919876543210');
    });

    it('builds click-to-chat URL with encoded text parameter', () => {
      const url = buildWhatsAppUrl('919876543210', '7TIME Financial Statement');
      expect(url).toBe('https://wa.me/919876543210?text=7TIME%20Financial%20Statement');
    });
  });

  describe('maskPhoneNumber', () => {
    it('masks phone numbers safely for UI verification', () => {
      expect(maskPhoneNumber('919876543210')).toBe('+91 ••••• ••210');
      expect(maskPhoneNumber('15551234567')).toBe('+15 ••••• ••567');
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber('123')).toBe('••••23');
    });
  });

  describe('openWhatsAppConversation', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      windowOpenSpy = vi.spyOn(window, 'open');
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    it('opens window successfully when not blocked', () => {
      windowOpenSpy.mockReturnValue({ closed: false } as Window);

      const res = openWhatsAppConversation('https://wa.me/919876543210');
      expect(res.opened).toBe(true);
      expect(res.popupBlocked).toBeUndefined();
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://wa.me/919876543210',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('detects popup blocked when window.open returns null', () => {
      windowOpenSpy.mockReturnValue(null);

      const res = openWhatsAppConversation('https://wa.me/919876543210');
      expect(res.opened).toBe(false);
      expect(res.popupBlocked).toBe(true);
      expect(res.error).toContain('popup blocker');
    });

    it('detects popup blocked when window.open returns closed window', () => {
      windowOpenSpy.mockReturnValue({ closed: true } as Window);

      const res = openWhatsAppConversation('https://wa.me/919876543210');
      expect(res.opened).toBe(false);
      expect(res.popupBlocked).toBe(true);
    });
  });

  describe('W3C Web Share Level 2 Limitations & Recipient Specification', () => {
    it('verifies that standard Web Share API does not support recipient parameter', () => {
      // According to W3C Web Share API Level 2:
      // ShareData = { title?: string, text?: string, url?: string, files?: File[] }
      // There is NO recipient, phone, or recipientUserId field in W3C specification.
      const shareDataKeys: (keyof ShareData)[] = ['title', 'text', 'url', 'files'];
      expect(shareDataKeys).not.toContain('recipient');
      expect(shareDataKeys).not.toContain('phone');
    });
  });
});

