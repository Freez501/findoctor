/**
 * Truespace — Барный кейтеринг и финансы
 * Client Formatters & Localization (`src/client/utils/formatters.ts`)
 *
 * Full Russian localization utilities for currency (₽), dates (ДД.ММ.ГГГГ),
 * 24-hour time formatting, percentages, and floating-point math rounding.
 * Strictly adheres to AGENTS.md and DESIGN_SYSTEM.md standards.
 */

/**
 * Normalizes floating-point currency numbers to 2 decimal places
 * preventing IEEE-754 precision drift (e.g. 0.1 + 0.2 = 0.30000000000000004).
 */
export function roundRubles(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Formats a monetary number into Russian Rubles with non-breaking spaces (\u00A0)
 * and the official ruble symbol (₽).
 *
 * Examples:
 *   formatRubles(25000) => "25 000 ₽"
 *   formatRubles(3500.5) => "3 500,50 ₽"
 *   formatRubles(0) => "0 ₽"
 */
export function formatRubles(
  amount: number | null | undefined,
  options?: { hideDecimalsIfZero?: boolean; showSign?: boolean }
): string {
  if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount)) {
    return '0\u00A0₽';
  }

  const rounded = roundRubles(amount);
  const hasKopecks = Math.abs(rounded % 1) >= 0.005;
  const hideZero = options?.hideDecimalsIfZero ?? true;
  const minimumFractionDigits = (!hasKopecks && hideZero) ? 0 : 2;
  const maximumFractionDigits = 2;

  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Math.abs(rounded));

  const sign = options?.showSign && rounded > 0 ? '+' : (rounded < 0 ? '−' : '');

  return `${sign}${formatted}\u00A0₽`;
}

/**
 * Alias for formatRubles adhering to milestone requirements.
 */
export const formatMoneyRubles = formatRubles;

/**
 * Formats an ISO 8601 string or Date object into Russian standard date format (ДД.ММ.ГГГГ).
 * Example: "2026-09-20T14:30:00Z" => "20.09.2026"
 */
export function formatDateRu(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return typeof dateInput === 'string' ? dateInput : '';
  }
}

/**
 * Formats an ISO 8601 string or Date object into 24-hour Russian time format (ЧЧ:ММ).
 * Example: "2026-09-20T14:30:00Z" => "14:30"
 */
export function formatTime24h(dateInput: string | Date | null | undefined, includeSeconds: boolean = false): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Formats an ISO date into full Russian date and time string: "20.09.2026, 14:30".
 */
export function formatDateTimeRu(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const datePart = formatDateRu(dateInput);
  const timePart = formatTime24h(dateInput);
  if (!datePart) return '';
  return timePart ? `${datePart}, ${timePart}` : datePart;
}

/**
 * Formats a decimal ratio or percentage into a localized percentage string.
 * Example: formatPercent(69.84, 1) => "69,8%"
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

  return `${formatted}%`;
}
