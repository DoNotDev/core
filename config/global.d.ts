// packages/core/config/global.d.ts

/**
 * @fileoverview Global Type Definitions
 * @description Global TypeScript declarations for the DoNotDev framework. Includes React type extensions, framework configuration types, and virtual module declarations.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import 'react';
import {
  type ReactElement,
  type CSSProperties,
  type ComponentType,
  type SVGProps,
} from 'react';

declare module 'react' {
  interface AriaAttributes {
    'aria-selected'?: boolean | 'true' | 'false' | undefined;
  }

  // React 19 support
  interface ReactElement<
    P = any,
    T extends string | JSXElementConstructor<any> =
      | string
      | JSXElementConstructor<any>,
  > {
    type: T;
    props: P;
    key: Key | null;
  }
}

// React 19 support
declare namespace JSX {
  interface Element extends ReactElement<any, any> {}

  // Custom Web Components
  interface IntrinsicElements {
    'dnd-typewriter': {
      texts: string;
      speed: string;
      pause: string;
      maxch: string;
      style?: CSSProperties;
      'aria-live'?: string;
      role?: string;
    };
    'mutate-text': {
      texts: string;
      speed: string;
      pause: string;
      maxch: string;
      style?: CSSProperties;
      'aria-live'?: string;
      role?: string;
    };
  }
}

// ============================================================================
// DnDev FRAMEWORK GLOBAL CONFIGURATION
// ============================================================================

// Import types from @donotdev/types for runtime use
import type { DndevFrameworkConfig } from '@donotdev/types';

declare global {
  // eslint-disable-next-line no-var
  var __DNDEV_I18N_INSTANCE__: import('i18next').i18n | undefined;

  interface Window {
    /**
     * Single source of truth for all DNDev framework configuration
     * Set by platform detection and populated by discovery plugins
     */
    _DNDEV_CONFIG_?: DndevFrameworkConfig;

    /**
     * Global store registry for singleton Zustand stores
     * Ensures single instance across code-split chunks
     */
    _DNDEV_STORES_?: Record<string, any>;

    // External libraries
    Papa?: {
      parse: (input: string | File, config?: any) => any;
      unparse: (data: any[], config?: any) => string;
    };

    Sentry?: {
      captureException: (error: unknown) => void;
      withScope: (callback: (scope: any) => void) => void;
      getClient: () => { close: () => Promise<boolean> } | undefined;
    };

    /**
     * Google APIs (Maps, One Tap, etc.)
     */
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => any;
          PlacesService: new (element: HTMLElement) => any;
          PlacesServiceStatus: {
            OK: string;
          };
        };
        [key: string]: any;
      };
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          cancel?: () => void;
          disableAutoSelect?: () => void;
        };
      };
      [key: string]: any;
    };

    /** FedCM Identity Credential API */
    IdentityCredential?: any;
  }

  namespace NodeJS {
    interface ProcessEnv {
      _DNDEV_CONFIG_?: string;
    }
  }

  namespace globalThis {
    var _DNDEV_CONFIG_: DndevFrameworkConfig | undefined;
    var _DNDEV_STORES_: Record<string, any> | undefined;
    var __DNDEV_I18N_INSTANCE__: import('i18next').i18n | undefined;

    // Third-party framework globals
    var __vite_plugin_react_preamble_installed__: boolean | undefined;
    var __vite_hmr_port: number | undefined;
    var __NEXT_DATA__: any | undefined;
    var __REACT_QUERY_CLIENT__: any | undefined;
    var __REACT_QUERY_PROVIDER__: any | undefined;
    var __DNDEV_DEBUG: boolean | undefined;
    var __FIREBASE_DEMO_MODE__: boolean | undefined;
    var getAvailableThemes: (() => string[]) | undefined;
  }
}

// Virtual module declarations moved to platform-specific files:
// - vite-env.d.ts for Vite apps
// - next-env.d.ts for Next.js apps

// ============================================================================
// ASSET TYPE DECLARATIONS
// ============================================================================

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  import type React from 'react';
  export const ReactComponent: ComponentType<SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

// Platform-specific ?raw import moved to vite-env.d.ts

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.sass' {
  const content: { [className: string]: string };
  export default content;
}

// ============================================================================
// EXTERNAL MODULE DECLARATIONS
// ============================================================================

export {};
