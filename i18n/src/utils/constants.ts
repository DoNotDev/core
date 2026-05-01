// packages/core/i18n/src/utils/constants.ts

/**
 * @fileoverview I18n Constants
 * @description All shared constants for the i18n system. Defines default language settings, storage keys, time constants, and language data.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * All shared constants for the i18n system
 */

// Default language settings
/**
 * Default language constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DEFAULT_LANGUAGE = 'en';

// Storage keys
/**
 * Storage keys for i18n system
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const STORAGE_KEYS = {
  LANGUAGE_PREFERENCE: 'i18n_user_language',
  TRANSLATIONS_PREFIX: 'i18n_translations_',
  CACHE_ALL: 'i18n_cache_all',
};

// Time constants
/**
 * Time constants for i18n system
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const TIME = {
  ERROR_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  HEALTH_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  CACHE_PERSISTENCE_DELAY: 1000, // 1 second
  INITIALIZATION_TIMEOUT: 10000, // 10 seconds
};

// Debug settings
/**
 * Debug settings for i18n system
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DEBUG = {
  isDevelopment:
    typeof window !== 'undefined'
      ? window.location.hostname === 'localhost'
      : false,
};

// Error messages
/**
 * Error messages for i18n system
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const ERROR_MESSAGES = {
  TIMEOUT: 'i18n initialization timed out. Please check your configuration.',
  INVALID_LANGUAGE: 'Invalid language code.',
  INVALID_NAMESPACE: 'Invalid namespace.',
  LOAD_FAILURE: 'Failed to load translation.',
};

import type { LanguageData } from '@donotdev/types';

// Re-export LanguageData from the canonical source in @donotdev/types
export type { LanguageData } from '@donotdev/types';

/**
 * Complete language data array with all information
 * Single source of truth for all language-related data
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const LANGUAGES: readonly LanguageData[] = [
  // Core languages
  { id: 'en', name: 'English', nativeName: 'English', flagCode: 'gb' },
  {
    id: 'us',
    name: 'English (US)',
    nativeName: 'English (US)',
    countryCode: 'US',
    dialCode: '+1',
  },
  {
    id: 'gb',
    name: 'English (UK)',
    nativeName: 'English (UK)',
    countryCode: 'GB',
    dialCode: '+44',
  },
  {
    id: 'en-ca',
    name: 'English (Canada)',
    nativeName: 'English (Canada)',
    flagCode: 'ca',
    countryCode: 'CA',
    dialCode: '+1',
  },
  {
    id: 'au',
    name: 'English (Australia)',
    nativeName: 'English (Australia)',
    countryCode: 'AU',
    dialCode: '+61',
  },
  {
    id: 'ie',
    name: 'English (Ireland)',
    nativeName: 'English (Ireland)',
    countryCode: 'IE',
    dialCode: '+353',
  },
  {
    id: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    countryCode: 'ES',
    dialCode: '+34',
  },
  {
    id: 'mx',
    name: 'Spanish (Mexico)',
    nativeName: 'Español (México)',
    countryCode: 'MX',
    dialCode: '+52',
  },
  {
    id: 'es-ar',
    name: 'Spanish (Argentina)',
    nativeName: 'Español (Argentina)',
    flagCode: 'ar',
    countryCode: 'AR',
    dialCode: '+54',
  },
  {
    id: 'fr',
    name: 'French',
    nativeName: 'Français',
    flagCode: 'fr',
    countryCode: 'FR',
    dialCode: '+33',
  },
  {
    id: 'fr-be',
    name: 'French (Belgium)',
    nativeName: 'Français (Belgique)',
    flagCode: 'be',
    countryCode: 'BE',
    dialCode: '+32',
  },
  {
    id: 'ch',
    name: 'French (Switzerland)',
    nativeName: 'Français (Suisse)',
    countryCode: 'CH',
    dialCode: '+41',
  },
  {
    id: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    countryCode: 'DE',
    dialCode: '+49',
  },
  {
    id: 'at',
    name: 'German (Austria)',
    nativeName: 'Deutsch (Österreich)',
    countryCode: 'AT',
    dialCode: '+43',
  },
  {
    id: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    countryCode: 'IT',
    dialCode: '+39',
  },
  {
    id: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    countryCode: 'PT',
    dialCode: '+351',
  },
  {
    id: 'br',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português (Brasil)',
    flagCode: 'br',
    countryCode: 'BR',
    dialCode: '+55',
  },
  {
    id: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    countryCode: 'RU',
    dialCode: '+7',
  },
  {
    id: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    countryCode: 'JP',
    dialCode: '+81',
  },
  {
    id: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    countryCode: 'KR',
    dialCode: '+82',
  },
  {
    id: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    countryCode: 'CN',
    dialCode: '+86',
  },
  {
    id: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flagCode: 'sa',
    countryCode: 'SA',
    dialCode: '+966',
  },
  {
    id: 'ar-ma',
    name: 'Arabic (Morocco)',
    nativeName: 'العربية (المغرب)',
    flagCode: 'ma',
    countryCode: 'MA',
    dialCode: '+212',
  },
  {
    id: 'ar-dz',
    name: 'Arabic (Algeria)',
    nativeName: 'العربية (الجزائر)',
    flagCode: 'dz',
    countryCode: 'DZ',
    dialCode: '+213',
  },
  {
    id: 'ar-tn',
    name: 'Arabic (Tunisia)',
    nativeName: 'العربية (تونس)',
    flagCode: 'tn',
    countryCode: 'TN',
    dialCode: '+216',
  },
  {
    id: 'ar-ly',
    name: 'Arabic (Libya)',
    nativeName: 'العربية (ليبيا)',
    flagCode: 'ly',
    countryCode: 'LY',
    dialCode: '+218',
  },
  {
    id: 'ar-mr',
    name: 'Arabic (Mauritania)',
    nativeName: 'العربية (موريتانيا)',
    flagCode: 'mr',
    countryCode: 'MR',
    dialCode: '+222',
  },
  {
    id: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    countryCode: 'NL',
    dialCode: '+31',
  },
  {
    id: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    countryCode: 'SE',
    dialCode: '+46',
  },
  {
    id: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    countryCode: 'DK',
    dialCode: '+45',
  },
  {
    id: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    countryCode: 'NO',
    dialCode: '+47',
  },
  {
    id: 'fi',
    name: 'Finnish',
    nativeName: 'Suomi',
    countryCode: 'FI',
    dialCode: '+358',
  },
  {
    id: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    countryCode: 'PL',
    dialCode: '+48',
  },
  {
    id: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    countryCode: 'TR',
    dialCode: '+90',
  },
  {
    id: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    countryCode: 'TH',
    dialCode: '+66',
  },
  {
    id: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    countryCode: 'VN',
    dialCode: '+84',
  },
  {
    id: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    countryCode: 'ID',
    dialCode: '+62',
  },
  {
    id: 'ms',
    name: 'Malay',
    nativeName: 'Bahasa Melayu',
    flagCode: 'my',
    countryCode: 'MY',
    dialCode: '+60',
  },
  {
    id: 'tl',
    name: 'Filipino',
    nativeName: 'Tagalog',
    countryCode: 'PH',
    dialCode: '+63',
  },

  // Additional European languages
  {
    id: 'bg',
    name: 'Bulgarian',
    nativeName: 'Български',
    countryCode: 'BG',
    dialCode: '+359',
  },
  {
    id: 'cs',
    name: 'Czech',
    nativeName: 'Čeština',
    countryCode: 'CZ',
    dialCode: '+420',
  },
  {
    id: 'el',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    countryCode: 'GR',
    dialCode: '+30',
  },
  {
    id: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    countryCode: 'IL',
    dialCode: '+972',
  },
  {
    id: 'hu',
    name: 'Hungarian',
    nativeName: 'Magyar',
    countryCode: 'HU',
    dialCode: '+36',
  },
  {
    id: 'is',
    name: 'Icelandic',
    nativeName: 'Íslenska',
    countryCode: 'IS',
    dialCode: '+354',
  },
  {
    id: 'lt',
    name: 'Lithuanian',
    nativeName: 'Lietuvių',
    countryCode: 'LT',
    dialCode: '+370',
  },
  {
    id: 'lv',
    name: 'Latvian',
    nativeName: 'Latviešu',
    countryCode: 'LV',
    dialCode: '+371',
  },
  {
    id: 'mt',
    name: 'Maltese',
    nativeName: 'Malti',
    countryCode: 'MT',
    dialCode: '+356',
  },
  {
    id: 'ro',
    name: 'Romanian',
    nativeName: 'Română',
    countryCode: 'RO',
    dialCode: '+40',
  },
  {
    id: 'sk',
    name: 'Slovak',
    nativeName: 'Slovenčina',
    countryCode: 'SK',
    dialCode: '+421',
  },
  {
    id: 'sl',
    name: 'Slovenian',
    nativeName: 'Slovenščina',
    flagCode: 'si',
    countryCode: 'SI',
    dialCode: '+386',
  },
  {
    id: 'uk',
    name: 'Ukrainian',
    nativeName: 'Українська',
    flagCode: 'ua',
    countryCode: 'UA',
    dialCode: '+380',
  },
  {
    id: 'et',
    name: 'Estonian',
    nativeName: 'Eesti',
    countryCode: 'EE',
    dialCode: '+372',
  },

  // Regional languages
  {
    id: 'ca',
    name: 'Catalan',
    nativeName: 'Català',
    countryCode: 'ES',
    dialCode: '+34',
  },
  {
    id: 'eu',
    name: 'Basque',
    nativeName: 'Euskara',
    countryCode: 'ES',
    dialCode: '+34',
  },
  {
    id: 'gl',
    name: 'Galician',
    nativeName: 'Galego',
    countryCode: 'ES',
    dialCode: '+34',
  },
  {
    id: 'cy',
    name: 'Welsh',
    nativeName: 'Cymraeg',
    countryCode: 'GB',
    dialCode: '+44',
  },
  {
    id: 'ga',
    name: 'Irish',
    nativeName: 'Gaeilge',
    flagCode: 'ie',
    countryCode: 'IE',
    dialCode: '+353',
  },
  {
    id: 'gd',
    name: 'Scottish Gaelic',
    nativeName: 'Gàidhlig',
    flagCode: 'gb-sct',
    countryCode: 'GB',
    dialCode: '+44',
  },
  {
    id: 'br-fr',
    name: 'Breton',
    nativeName: 'Brezhoneg',
    flagCode: 'bzh',
    countryCode: 'FR',
    dialCode: '+33',
  }, // Fixed ID collision (was 'br') and added flagCode 'bzh'
  {
    id: 'co',
    name: 'Corsican',
    nativeName: 'Corsu',
    flagCode: 'fr-cor',
    countryCode: 'FR',
    dialCode: '+33',
  }, // Added flagCode 'fr-cor'
  {
    id: 'oc',
    name: 'Occitan',
    nativeName: 'Occitan',
    countryCode: 'FR',
    dialCode: '+33',
  },
  {
    id: 'rm',
    name: 'Romansh',
    nativeName: 'Rumantsch',
    countryCode: 'CH',
    dialCode: '+41',
  },
  {
    id: 'lb',
    name: 'Luxembourgish',
    nativeName: 'Lëtzebuergesch',
    countryCode: 'LU',
    dialCode: '+352',
  },

  // African languages
  {
    id: 'af',
    name: 'Afrikaans',
    nativeName: 'Afrikaans',
    countryCode: 'ZA',
    dialCode: '+27',
  },
  {
    id: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    countryCode: 'KE',
    dialCode: '+254',
  },
  {
    id: 'am',
    name: 'Amharic',
    nativeName: 'አማርኛ',
    flagCode: 'et',
    countryCode: 'ET',
    dialCode: '+251',
  },

  // South Asian languages
  {
    id: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flagCode: 'bd',
    countryCode: 'BD',
    dialCode: '+880',
  },
  {
    id: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'ne',
    name: 'Nepali',
    nativeName: 'नेपाली',
    flagCode: 'np',
    countryCode: 'NP',
    dialCode: '+977',
  },
  {
    id: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flagCode: 'pk',
    countryCode: 'PK',
    dialCode: '+92',
  },
  {
    id: 'si',
    name: 'Sinhala',
    nativeName: 'සිංහල',
    countryCode: 'LK',
    dialCode: '+94',
  },
  {
    id: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flagCode: 'in',
    countryCode: 'IN',
    dialCode: '+91',
  },
  {
    id: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    flagCode: 'pk',
    countryCode: 'PK',
    dialCode: '+92',
  },

  // Middle Eastern languages
  {
    id: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    flagCode: 'ir',
    countryCode: 'IR',
    dialCode: '+98',
  },
  {
    id: 'ps',
    name: 'Pashto',
    nativeName: 'پښتو',
    countryCode: 'AF',
    dialCode: '+93',
  },

  // Central Asian languages
  {
    id: 'uz',
    name: 'Uzbek',
    nativeName: 'Oʻzbek',
    countryCode: 'UZ',
    dialCode: '+998',
  },
  {
    id: 'kk',
    name: 'Kazakh',
    nativeName: 'Қазақ',
    flagCode: 'kz',
    countryCode: 'KZ',
    dialCode: '+7',
  },
  {
    id: 'ky',
    name: 'Kyrgyz',
    nativeName: 'Кыргызча',
    flagCode: 'kg',
    countryCode: 'KG',
    dialCode: '+996',
  },
  {
    id: 'tg',
    name: 'Tajik',
    nativeName: 'Тоҷикӣ',
    flagCode: 'tj',
    countryCode: 'TJ',
    dialCode: '+992',
  },
  {
    id: 'mn',
    name: 'Mongolian',
    nativeName: 'Монгол',
    countryCode: 'MN',
    dialCode: '+976',
  },

  // Southeast Asian languages
  {
    id: 'my',
    name: 'Burmese',
    nativeName: 'မြန်မာ',
    flagCode: 'mm',
    countryCode: 'MM',
    dialCode: '+95',
  },
  {
    id: 'km',
    name: 'Khmer',
    nativeName: 'ខ្មែរ',
    flagCode: 'kh',
    countryCode: 'KH',
    dialCode: '+855',
  },
  {
    id: 'lo',
    name: 'Lao',
    nativeName: 'ລາວ',
    flagCode: 'la',
    countryCode: 'LA',
    dialCode: '+856',
  },

  // Caucasian languages
  {
    id: 'ka',
    name: 'Georgian',
    nativeName: 'ქართული',
    flagCode: 'ge',
    countryCode: 'GE',
    dialCode: '+995',
  },
  {
    id: 'hy',
    name: 'Armenian',
    nativeName: 'Հայերեն',
    flagCode: 'am',
    countryCode: 'AM',
    dialCode: '+374',
  },
  {
    id: 'az',
    name: 'Azerbaijani',
    nativeName: 'Azərbaycan',
    countryCode: 'AZ',
    dialCode: '+994',
  },

  // Slavic languages
  {
    id: 'be',
    name: 'Belarusian',
    nativeName: 'Беларуская',
    flagCode: 'by',
    countryCode: 'BY',
    dialCode: '+375',
  },
  {
    id: 'mk',
    name: 'Macedonian',
    nativeName: 'Македонски',
    countryCode: 'MK',
    dialCode: '+389',
  },
  {
    id: 'sr',
    name: 'Serbian',
    nativeName: 'Српски',
    countryCode: 'RS',
    dialCode: '+381',
  },
  {
    id: 'bs',
    name: 'Bosnian',
    nativeName: 'Bosanski',
    flagCode: 'ba',
    countryCode: 'BA',
    dialCode: '+387',
  },
  {
    id: 'hr',
    name: 'Croatian',
    nativeName: 'Hrvatski',
    countryCode: 'HR',
    dialCode: '+385',
  },

  // Other languages
  {
    id: 'sq',
    name: 'Albanian',
    nativeName: 'Shqip',
    flagCode: 'al',
    countryCode: 'AL',
    dialCode: '+355',
  },
  {
    id: 'md',
    name: 'Moldovan',
    nativeName: 'Moldovenească',
    countryCode: 'MD',
    dialCode: '+373',
  },
] as const;

/** Country metadata for phone inputs and country selectors. */
export type CountryData = {
  code: string;
  dialCode: string;
  flagCode: string;
  /** Display name for the country in the current UI language */
  name: string;
};

/**
 * Mapping from ISO country code to human-readable country name.
 * This is used to derive COUNTRY display labels from existing language data.
 * Only needs to cover countries we actually expose; others fall back to language name.
 */
const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  IE: 'Ireland',
  FR: 'France',
  BE: 'Belgium',
  CH: 'Switzerland',
  DE: 'Germany',
  AT: 'Austria',
  IT: 'Italy',
  PT: 'Portugal',
  BR: 'Brazil',
  ES: 'Spain',
  MX: 'Mexico',
  AR: 'Argentina',
  RU: 'Russia',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  NL: 'Netherlands',
  PL: 'Poland',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  BG: 'Bulgaria',
  GR: 'Greece',
  TR: 'Turkey',
  IL: 'Israel',
  IN: 'India',
  ZA: 'South Africa',
};

/**
 * Get countries from languages that have country codes
 * Reuses existing language/flag mapping, just adds country code and dial code
 */
export function getCountries(): CountryData[] {
  return LANGUAGES.filter(
    (lang): lang is LanguageData & { countryCode: string; dialCode: string } =>
      lang.countryCode !== undefined && lang.dialCode !== undefined
  ).map((lang) => ({
    code: lang.countryCode!,
    dialCode: lang.dialCode!,
    flagCode: lang.flagCode || lang.id,
    // Prefer explicit countryName ("France", "United States"), then COUNTRY_LABELS,
    // then fall back to the language display name
    name: lang.countryName || COUNTRY_LABELS[lang.countryCode!] || lang.name,
  }));
}

export const COUNTRIES: readonly CountryData[] =
  getCountries() as readonly CountryData[];
