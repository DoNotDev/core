// packages/core/config/next-env.d.ts

/**
 * @fileoverview Next.js Environment Type Definitions
 * @description Augments NodeJS.ProcessEnv with custom NEXT_PUBLIC_* environment variables.
 * This file provides type safety for Next.js environment variables.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Augment ProcessEnv with custom NEXT_PUBLIC_* environment variables
 * These are exposed to the browser by Next.js
 */
declare namespace NodeJS {
  interface ProcessEnv {
    // Node environment
    readonly NODE_ENV: 'development' | 'production' | 'test';

    // Firebase Configuration
    readonly NEXT_PUBLIC_FIREBASE_API_KEY: string;
    readonly NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
    readonly NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
    readonly NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly NEXT_PUBLIC_FIREBASE_APP_ID: string;
    readonly NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;

    // Firebase Emulator Configuration
    readonly NEXT_PUBLIC_USE_FIREBASE_EMULATOR: string;
    readonly NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: string;
    readonly NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: string;

    // App Configuration
    readonly NEXT_PUBLIC_APP_VERSION: string;
    readonly NEXT_PUBLIC_APP_URL: string;
    readonly NEXT_PUBLIC_APP_AUTHOR: string;

    // Authentication Configuration
    readonly NEXT_PUBLIC_AUTH_PARTNERS: string;

    // Additional app-specific vars (optional)
    readonly NEXT_PUBLIC_APP_ENV?: string;
    readonly NEXT_PUBLIC_MOCK_PAYMENTS?: string;
    readonly NEXT_PUBLIC_STRIPE_TEST_MODE?: string;
    readonly NEXT_PUBLIC_STRIPE_REPLAY_PRICE_ID?: string;
    readonly NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    readonly NEXT_PUBLIC_GITHUB_CLIENT_ID?: string;

    // Framework internal (set by Next.js config)
    readonly _DNDEV_CONFIG_?: string;
  }
}

// ============================================================================
// NEXT.JS-SPECIFIC MODULE DECLARATIONS
// ============================================================================

// No virtual modules in Next.js - routes, themes, i18n, etc. are handled
// differently via server-side data fetching and client components

export {};
