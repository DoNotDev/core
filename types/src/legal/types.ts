// packages/core/types/src/legal/types.ts

/**
 * @fileoverview Legal Configuration Types
 * @description Type definitions for legal pages configuration (Terms, Privacy, Legal Notice)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Company/Publisher Information
 *
 * Information about the company or individual publishing the website
 */
export interface LegalCompanyInfo {
  /**
   * Full legal name of the company or individual
   * @example "AMBROISE PARK Consulting"
   * @example "John Doe"
   */
  name: string;

  /**
   * Short name or abbreviation
   * @example "APC"
   * @example "ACME Inc."
   */
  shortName?: string;

  /**
   * Legal status/form of the company
   * @example "SARL" (France - Limited Liability Company)
   * @example "SAS" (France - Simplified Joint-Stock Company)
   * @example "LLC" (USA - Limited Liability Company)
   * @example "GmbH" (Germany)
   * @example "Ltd" (UK)
   */
  legalStatus?: string;

  /**
   * Company registration number
   * @description Required in many countries for legal compliance
   * @example "123 456 789 00010" (France - SIRET number)
   * @example "12345678" (UK - Company Number)
   * @example "123-45-6789" (USA - EIN)
   */
  registrationNumber?: string;

  /**
   * VAT/Tax identification number
   * @description Required for EU businesses and many other jurisdictions
   * @example "FR12345678901" (France)
   * @example "DE123456789" (Germany)
   * @example "GB123456789" (UK)
   */
  vatNumber?: string;

  /**
   * Share capital (for companies)
   * @description Required to be disclosed in some jurisdictions (e.g., France)
   * @example "10,000 EUR"
   * @example "50,000 USD"
   */
  shareCapital?: string;
}

/**
 * Contact Information
 *
 * Various contact points for legal, support, and privacy inquiries
 */
export interface LegalContactInfo {
  /**
   * Registered office address
   * @description Physical address where the company is legally registered
   * @example "123 rue de la Paix, 75001 Paris, France"
   * @example "1 Main Street, Suite 100, New York, NY 10001, USA"
   */
  address: string;

  /**
   * General legal contact email
   * @description For legal inquiries and notices
   * @example "legal@company.com"
   */
  email: string;

  /**
   * Contact phone number
   * @description Optional but recommended for legal compliance
   * @example "+33 1 23 45 67 89"
   * @example "+1 (555) 123-4567"
   */
  phone?: string;

  /**
   * Support email for customer inquiries
   * @example "support@company.com"
   */
  supportEmail: string;

  /**
   * Privacy-specific email
   * @description For privacy policy and data protection inquiries
   * @example "privacy@company.com"
   */
  privacyEmail: string;

  /**
   * Data Protection Officer (DPO) email
   * @description Required for GDPR compliance if you process significant personal data
   * @example "dpo@company.com"
   */
  dpoEmail: string;
}

/**
 * Publication Director Information
 *
 * Information about the person responsible for the website's content
 * Required by law in France ("Directeur de la publication")
 */
export interface LegalDirectorInfo {
  /**
   * Full name of the publication director
   * @description The person legally responsible for the website's content
   * @example "John Doe"
   * @example "Jane Smith"
   */
  name: string;

  /**
   * Role/title of the publication director
   * @example "CEO"
   * @example "Directeur Général"
   * @example "Managing Director"
   */
  role?: string;
}

/**
 * Hosting Provider Information
 *
 * Information about where and how the website is hosted
 * Required by law in many jurisdictions including France
 */
export interface LegalHostingInfo {
  /**
   * Name of the hosting provider
   * @example "Firebase Hosting by Google"
   * @example "AWS (Amazon Web Services)"
   * @example "OVH"
   */
  provider: string;

  /**
   * Hosting provider's address
   * @description Physical address of the hosting company
   * @example "Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA"
   */
  address?: string;

  /**
   * Hosting provider contact information
   * @description URL or email to contact the hosting provider
   * @example "https://firebase.google.com/support"
   * @example "support@hostingprovider.com"
   */
  contact?: string;
}

/**
 * Legal Jurisdiction Information
 *
 * Information about the legal jurisdiction and dispute resolution
 */
export interface LegalJurisdictionInfo {
  /**
   * Country or jurisdiction where the company operates
   * @example "France"
   * @example "United States"
   * @example "United Kingdom"
   */
  country: string;

  /**
   * Arbitration organization for dispute resolution
   * @example "Centre de Médiation et d'Arbitrage de Paris"
   * @example "American Arbitration Association"
   * @example "International Chamber of Commerce"
   */
  arbitrationOrg?: string;

  /**
   * Location where arbitration would take place
   * @example "Paris, France"
   * @example "New York, NY"
   */
  arbitrationLocation?: string;
}

/**
 * Website Information
 */
export interface LegalWebsiteInfo {
  /**
   * Main website URL
   * @example "https://company.com"
   * @example "https://www.example.com"
   */
  url: string;
}

/**
 * Optional Sections Configuration for Legal Pages
 */
export interface LegalSectionsConfig {
  /**
   * Terms of Service optional sections
   */
  terms?: {
    /** Include children-specific provisions (COPPA, etc.) */
    children?: boolean;
    /** Include international users provisions */
    international?: boolean;
    /** Include California-specific provisions (CCPA, etc.) */
    california?: boolean;
    /** Include EU-specific provisions */
    eu?: boolean;
  };

  /**
   * Privacy Policy optional sections
   */
  privacy?: {
    /** Include children's privacy provisions (COPPA, etc.) */
    children?: boolean;
    /** Include international data transfer provisions */
    international?: boolean;
    /** Include California privacy rights (CCPA, etc.) */
    california?: boolean;
    /** Include EU privacy provisions (GDPR) */
    eu?: boolean;
  };

  /**
   * Legal Notice optional sections
   */
  legalNotice?: {
    /** Include intellectual property notice */
    intellectualProperty?: boolean;
    /** Include personal data reference/link to privacy policy */
    personalData?: boolean;
    /** Include cookies reference/link to privacy policy */
    cookies?: boolean;
  };
}

/**
 * Complete Legal Configuration
 *
 * @description
 * Centralized configuration for all legal pages (Terms, Privacy, Legal Notice).
 * Configure this once in your app's config/legal.ts file.
 *
 * @example
 * ```typescript
 * import type { LegalConfig } from '@donotdev/types';
 *
 * export const legalConfig: LegalConfig = {
 *   company: {
 *     name: 'ACME Corporation',
 *     legalStatus: 'LLC',
 *     registrationNumber: '123456789',
 *     vatNumber: 'US123456789',
 *   },
 *   contact: {
 *     address: '123 Main St, City, State 12345, Country',
 *     email: 'legal@acme.com',
 *     supportEmail: 'support@acme.com',
 *     privacyEmail: 'privacy@acme.com',
 *     dpoEmail: 'dpo@acme.com',
 *   },
 *   director: {
 *     name: 'John Doe',
 *     role: 'CEO',
 *   },
 *   hosting: {
 *     provider: 'Firebase Hosting by Google',
 *     contact: 'https://firebase.google.com/support',
 *   },
 *   jurisdiction: {
 *     country: 'United States',
 *   },
 *   website: {
 *     url: 'https://acme.com',
 *   },
 * };
 * ```
 */
export interface LegalConfig {
  /** Company/Publisher information */
  company: LegalCompanyInfo;

  /** Contact information */
  contact: LegalContactInfo;

  /** Publication director information */
  director: LegalDirectorInfo;

  /** Hosting provider information */
  hosting: LegalHostingInfo;

  /** Legal jurisdiction information */
  jurisdiction: LegalJurisdictionInfo;

  /** Website information */
  website: LegalWebsiteInfo;

  /** Sections configuration for legal pages */
  sections: LegalSectionsConfig;

  /** Last updated dates (ISO strings) for each legal page */
  lastUpdated?: {
    /** Terms of Service last updated date (ISO string) */
    terms?: string;
    /** Privacy Policy last updated date (ISO string) */
    privacy?: string;
    /** Legal Notice last updated date (ISO string) */
    legalNotice?: string;
  };
}
