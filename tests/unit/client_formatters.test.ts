/**
 * Truespace — Client Formatters & Localization Unit Tests
 * `tests/unit/client_formatters.test.ts`
 */

import { describe, it, expect } from 'vitest';
import {
  formatRubles,
  formatMoneyRubles,
  roundRubles,
  formatDateRu,
  formatTime24h,
  formatDateTimeRu,
  formatPercent,
} from '../../src/client/utils/formatters.js';

// Helper to normalize any non-breaking spaces (\u00A0 or \u202F) to regular space for assertions
function normalizeSpaces(str: string): string {
  return str.replace(/[\u00A0\u202F]/g, ' ');
}

describe('Client Formatters & Localization', () => {
  describe('formatMoneyRubles / formatRubles', () => {
    it('formats round integer monetary sums in Russian rubles with space grouping and symbol', () => {
      const formatted = formatMoneyRubles(840000);
      expect(normalizeSpaces(formatted)).toBe('840 000 ₽');
      expect(formatted).toContain('₽');
    });

    it('formats zero correctly without decimals', () => {
      const formatted = formatMoneyRubles(0);
      expect(normalizeSpaces(formatted)).toBe('0 ₽');
    });

    it('handles null and undefined gracefully by returning 0 ₽', () => {
      expect(normalizeSpaces(formatMoneyRubles(null))).toBe('0 ₽');
      expect(normalizeSpaces(formatMoneyRubles(undefined))).toBe('0 ₽');
      expect(normalizeSpaces(formatMoneyRubles(NaN))).toBe('0 ₽');
    });

    it('formats fractional amounts with kopecks (2 decimal places with comma)', () => {
      const formatted = formatMoneyRubles(3500.5);
      expect(normalizeSpaces(formatted)).toBe('3 500,50 ₽');

      const formatted2 = formatMoneyRubles(12.75);
      expect(normalizeSpaces(formatted2)).toBe('12,75 ₽');
    });

    it('handles negative numbers with proper minus sign', () => {
      const formatted = formatMoneyRubles(-1500);
      expect(normalizeSpaces(formatted)).toBe('−1 500 ₽');
    });

    it('supports showSign option for positive numbers', () => {
      const formatted = formatMoneyRubles(50000, { showSign: true });
      expect(normalizeSpaces(formatted)).toBe('+50 000 ₽');
    });

    it('aliases formatMoneyRubles to formatRubles', () => {
      expect(formatMoneyRubles).toBe(formatRubles);
    });
  });

  describe('roundRubles', () => {
    it('prevents IEEE-754 precision drift by rounding to 2 decimals', () => {
      expect(roundRubles(0.1 + 0.2)).toBe(0.3);
      expect(roundRubles(1234.5678)).toBe(1234.57);
      expect(roundRubles(10.004)).toBe(10);
      expect(roundRubles(10.005)).toBe(10.01);
    });

    it('handles invalid inputs returning 0', () => {
      expect(roundRubles(NaN)).toBe(0);
      // @ts-expect-error test runtime boundary
      expect(roundRubles('invalid')).toBe(0);
    });
  });

  describe('formatDateRu & formatTime24h', () => {
    it('formats Date objects to ДД.ММ.ГГГГ Russian date format', () => {
      const testDate = new Date(2026, 8, 20); // Sept 20, 2026
      expect(formatDateRu(testDate)).toBe('20.09.2026');
    });

    it('handles null, undefined and invalid date inputs', () => {
      expect(formatDateRu(null)).toBe('');
      expect(formatDateRu(undefined)).toBe('');
      expect(formatDateRu('invalid-date')).toBe('invalid-date');
    });

    it('formats 24-hour time correctly with leading zeros (ЧЧ:ММ)', () => {
      const morningTime = new Date(2026, 8, 20, 9, 5);
      expect(formatTime24h(morningTime)).toBe('09:05');

      const eveningTime = new Date(2026, 8, 20, 21, 45);
      expect(formatTime24h(eveningTime)).toBe('21:45');
    });

    it('formats combined date and time with formatDateTimeRu', () => {
      const testDate = new Date(2026, 8, 20, 14, 30);
      expect(formatDateTimeRu(testDate)).toBe('20.09.2026, 14:30');
      expect(formatDateTimeRu(null)).toBe('');
    });
  });

  describe('Liquidity & Percentage Calculations', () => {
    it('formats percentages with localized comma and percent sign', () => {
      expect(formatPercent(69.84, 1)).toBe('69,8%');
      expect(formatPercent(100, 0)).toBe('100%');
      expect(formatPercent(0)).toBe('0%');
      expect(formatPercent(null)).toBe('0%');
    });

    it('correctly computes portfolio account liquidity shares across 5 accounts', () => {
      const accounts = [
        { id: 'cash_1', balance: 45000 },
        { id: 'cash_2', balance: 120000 },
        { id: 'bank_1', balance: 500000 },
        { id: 'bank_2', balance: 100000 },
        { id: 'card_sbp', balance: 75000 },
      ];

      const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
      expect(totalBalance).toBe(840000);

      // Bank 1 share: 500,000 / 840,000 = 59.5238% -> 59.5%
      const bank1Share = (accounts[2].balance / totalBalance) * 100;
      expect(formatPercent(bank1Share, 1)).toBe('59,5%');

      // Cash 1 share: 45,000 / 840,000 = 5.357% -> 5.4%
      const cash1Share = (accounts[0].balance / totalBalance) * 100;
      expect(formatPercent(cash1Share, 1)).toBe('5,4%');
    });

    it('handles zero total liquidity without division by zero NaN', () => {
      const totalBalance = 0;
      const accountBalance = 0;
      const share = totalBalance > 0 ? (accountBalance / totalBalance) * 100 : 0;
      expect(share).toBe(0);
      expect(formatPercent(share)).toBe('0%');
    });

    it('safely clamps liquidity shares between 0% and 100%', () => {
      const clampShare = (share: number) => Math.max(0, Math.min(100, share));
      expect(clampShare(-5)).toBe(0);
      expect(clampShare(120)).toBe(100);
      expect(clampShare(45.6)).toBe(45.6);
    });
  });
});
