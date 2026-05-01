// packages/core/utils/src/common/currencyFormat.ts

/**
 * @fileoverview Currency Formatting Utilities
 * @description Single mapping of ISO 4217 currency codes to locale and symbol. Top ~50 currencies.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/** Entry: 3-letter code → locale (for Intl) and display symbol */
export interface CurrencyEntry {
  locale: string;
  symbol: string;
}

/**
 * Top ~50 currencies: 3-letter code, locale, symbol.
 * Unknown codes: getCurrencyLocale → 'en-US', getCurrencySymbol → code as-is.
 */
export const CURRENCY_MAP: Record<string, CurrencyEntry> = {
  AED: { locale: 'ar-AE', symbol: 'د.إ' },
  ARS: { locale: 'es-AR', symbol: '$' },
  AUD: { locale: 'en-AU', symbol: '$' },
  BDT: { locale: 'bn-BD', symbol: '৳' },
  BGN: { locale: 'bg-BG', symbol: 'лв' },
  BHD: { locale: 'ar-BH', symbol: 'د.ب' },
  BRL: { locale: 'pt-BR', symbol: 'R$' },
  CAD: { locale: 'en-CA', symbol: '$' },
  CHF: { locale: 'fr-CH', symbol: 'CHF' },
  CLP: { locale: 'es-CL', symbol: '$' },
  CNY: { locale: 'zh-CN', symbol: '¥' },
  COP: { locale: 'es-CO', symbol: '$' },
  CZK: { locale: 'cs-CZ', symbol: 'Kč' },
  DKK: { locale: 'da-DK', symbol: 'kr' },
  EGP: { locale: 'ar-EG', symbol: 'E£' },
  EUR: { locale: 'fr-FR', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  HKD: { locale: 'zh-HK', symbol: '$' },
  HUF: { locale: 'hu-HU', symbol: 'Ft' },
  IDR: { locale: 'id-ID', symbol: 'Rp' },
  ILS: { locale: 'he-IL', symbol: '₪' },
  INR: { locale: 'en-IN', symbol: '₹' },
  JOD: { locale: 'ar-JO', symbol: 'د.أ' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  KES: { locale: 'sw-KE', symbol: 'KSh' },
  KRW: { locale: 'ko-KR', symbol: '₩' },
  KWD: { locale: 'ar-KW', symbol: 'د.ك' },
  LKR: { locale: 'si-LK', symbol: 'Rs' },
  MXN: { locale: 'es-MX', symbol: '$' },
  MYR: { locale: 'ms-MY', symbol: 'RM' },
  NGN: { locale: 'en-NG', symbol: '₦' },
  NOK: { locale: 'nb-NO', symbol: 'kr' },
  NZD: { locale: 'en-NZ', symbol: '$' },
  OMR: { locale: 'ar-OM', symbol: 'ر.ع.' },
  PEN: { locale: 'es-PE', symbol: 'S/.' },
  PHP: { locale: 'en-PH', symbol: '₱' },
  PKR: { locale: 'ur-PK', symbol: '₨' },
  PLN: { locale: 'pl-PL', symbol: 'zł' },
  QAR: { locale: 'ar-QA', symbol: 'ر.ق' },
  RON: { locale: 'ro-RO', symbol: 'lei' },
  RUB: { locale: 'ru-RU', symbol: '₽' },
  SAR: { locale: 'ar-SA', symbol: 'ر.س' },
  SEK: { locale: 'sv-SE', symbol: 'kr' },
  SGD: { locale: 'en-SG', symbol: '$' },
  THB: { locale: 'th-TH', symbol: '฿' },
  TRY: { locale: 'tr-TR', symbol: '₺' },
  TWD: { locale: 'zh-TW', symbol: '$' },
  UAH: { locale: 'uk-UA', symbol: '₴' },
  USD: { locale: 'en-US', symbol: '$' },
  UYU: { locale: 'es-UY', symbol: '$' },
  VND: { locale: 'vi-VN', symbol: '₫' },
  ZAR: { locale: 'en-ZA', symbol: 'R' },
};

/**
 * Returns the locale for a currency code (for Intl formatting).
 * Unknown codes → 'en-US'.
 *
 * @param currencyCode - ISO 4217 currency code (e.g. 'EUR', 'USD')
 * @returns Locale string
 */
export function getCurrencyLocale(currencyCode: string): string {
  return CURRENCY_MAP[currencyCode]?.locale ?? 'en-US';
}

/**
 * Returns the symbol for a currency code (e.g. EUR → '€').
 * Unknown codes → code as-is (no validation).
 *
 * @param currencyCode - ISO 4217 currency code or any string
 * @returns Symbol string or the code itself
 */
export function getCurrencySymbol(currencyCode: string): string {
  if (!currencyCode || typeof currencyCode !== 'string') {
    return currencyCode ?? '';
  }
  return CURRENCY_MAP[currencyCode]?.symbol ?? currencyCode;
}

/**
 * Format currency value with proper locale based on currency code
 *
 * @param value - Numeric value to format
 * @param currencyCode - ISO 4217 currency code
 * @param options - Additional Intl.NumberFormat options
 * @returns Formatted currency string
 *
 * @example
 * ```typescript
 * formatCurrency(12345, 'EUR') // → "12 345 €"
 * formatCurrency(12345, 'USD') // → "$12,345"
 * ```
 */
export function formatCurrency(
  value: number | null | undefined,
  currencyCode: string,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }

  const locale = getCurrencyLocale(currencyCode);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    currencyDisplay: 'symbol',
    ...options,
  }).format(value);
}
