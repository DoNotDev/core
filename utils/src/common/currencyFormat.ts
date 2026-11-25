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
 * Formats an amount of money in the reader's language: `locale` (the UI language) sets
 * the number format and the symbol position, the currency its standard fraction digits
 * (EUR, USD 2; KRW, JPY 0; BHD 3), so `15.5` EUR reads "15,50 €" in French and
 * "€15.50" in English. Without `locale`, the currency's own locale
 * ({@link getCurrencyLocale}): pass the UI language wherever a person reads the amount.
 *
 * @param value - Numeric value to format
 * @param currencyCode - ISO 4217 currency code
 * @param options - Additional Intl.NumberFormat options (override the fraction digits)
 * @param locale - BCP 47 locale of the reader (i18next language, e.g. 'fr', 'en')
 * @returns Formatted currency string, '' for a missing or NaN value
 *
 * @example
 * ```typescript
 * formatCurrency(15.5, 'EUR', {}, 'fr') // → "15,50 €"
 * formatCurrency(15.5, 'EUR', {}, 'en') // → "€15.50"
 * formatCurrency(15000, 'KRW', {}, 'en') // → "₩15,000"
 * formatCurrency(15.5, 'EUR') // → "15,50 €" (EUR's locale, fr-FR)
 * ```
 *
 * @version 0.2.0
 * @since 0.0.1
 */
export function formatCurrency(
  value: number | null | undefined,
  currencyCode: string,
  options: Intl.NumberFormatOptions = {},
  locale?: string
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }

  return new Intl.NumberFormat(locale ?? getCurrencyLocale(currencyCode), {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'symbol',
    ...options,
  }).format(value);
}
