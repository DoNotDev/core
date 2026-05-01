# DNDev Configuration System

Unified configuration system for DNDev applications supporting both Vite and Next.js with a consistent runtime architecture.

## Architecture Overview

The config package follows a **unified discovery pattern** across platforms:

- **Vite**: Uses virtual modules to populate `globalThis._DNDEV_CONFIG_`
- **Next.js**: Uses virtual modules to populate `globalThis._DNDEV_CONFIG_` (same pattern)
- **Runtime**: All platforms use ViteAppProviders or NextJsAppProviders for provider functionality
- **No duplicate providers**: Single source of truth for all provider functionality

## Quick Start

### Vite Applications

```javascript
// vite.config.js
import { defineViteConfig } from '@donotdev/config/vite';
import { appConfig } from './src/config/app';

// Features and SEO are now in app.ts (runtime config)
// Only build-time configs (routes, themes, i18n, assets) go here
export default defineViteConfig({
  appConfig,
  // Optional: Override build-time discovery options
  routes: { debug: true },
  themes: { debug: true },
  i18n: { debug: true },
  assets: { debug: true },
});
```

**Important**: `appConfig` is **required**. It's the primary communication channel between your app and the framework. The framework automatically extracts `features` and `seo` configuration from `appConfig` for build-time processing.

### Next.js Applications

```javascript
// next.config.js
import { defineNextConfig } from '@donotdev/config/next';
import { appConfig } from './src/config/app';

// Features and SEO are now in app.ts (runtime config)
// Only build-time configs (routes, themes, i18n, assets) go here
export default defineNextConfig({
  appConfig,
  // Optional: Override build-time discovery options
  routes: { debug: true },
  themes: { debug: true },
  i18n: { debug: true },
  assets: { debug: true },
});
```

**Important**: `appConfig` is **required**. It's the primary communication channel between your app and the framework. The framework automatically extracts `features` and `seo` configuration from `appConfig` for build-time processing.

### Application Setup

Both platforms use the same provider pattern, but with platform-specific entry points:

#### Vite (SPA)

```tsx
import { ViteAppProviders } from '@donotdev/ui/vite';
import { HomePage } from './pages/HomePage';
import { appConfig } from './config/app';

export default function App() {
  return (
    <ViteAppProviders config={appConfig} LandingPage={HomePage}>
      {/* Your app content */}
    </ViteAppProviders>
  );
}
```

#### Next.js (App Router)

```tsx
import { NextJsAppProviders } from '@donotdev/ui/next';

export default function Layout({ children }) {
  return <NextJsAppProviders config={appConfig}>{children}</NextJsAppProviders>;
}
```

## Configuration Options

### Global Options

Control framework-wide behavior:

```javascript
// src/config/app.ts
export const appConfig: AppConfig = {
  app: { name: 'My App' },
  preset: 'landing', // Layout preset for store initialization
  features: {
    debug: false, // Optional: Enable debug tools in development
  },
  seo: {
    enabled: true,
    siteName: 'My App',
    // baseUrl defaults to VITE_APP_URL env var
  },
};

// vite.config.ts
import { defineViteConfig } from '@donotdev/config/vite';
import { appConfig } from './src/config/app';

export default defineViteConfig({
  appConfig, // Required - framework extracts features and SEO from here
  debug: false, // Opt-in: detailed debug logging (individual files, timing)
  verbose: true, // Opt-out: config/search paths (auto-disabled in CI)
  server: {
    port: 3002,
  },
});
```

#### Logging Levels

The framework uses a 5-level logging system:

- **debug** (opt-in): Detailed troubleshooting - individual file operations, timing, internal operations
- **verbose** (opt-out): Configuration/search paths - WHERE we're looking (PathResolver values, resolved paths), NOT individual discovered items
- **info** (always): High-level operations and discoveries - WHAT was found (counts, summaries)
- **warn** (always): Potential problems
- **error** (always): Failures

**Default behavior:**

- `debug: false` - Debug logs hidden by default (opt-in)
- `verbose: true` - Verbose logs shown by default (opt-out), auto-disabled in CI
- `info/warn/error` - Always shown

### Discovery Plugin Options

Each discovery plugin supports fine-grained configuration:

```javascript
export default defineViteConfig({
  // Route Discovery
  routes: {
    debug: false, // Enable verbose route discovery logs
    hmr: true, // Enable HMR for route changes (disable to reduce spam)
    cacheTimeout: 60000, // Cache duration in ms (default: 60s, 120s in dev)
    fileLogging: false, // Redirect logs to .dndev-logs/ directory
    logDir: '.dndev-logs', // Custom log directory
  },

  // Theme Discovery
  themes: {
    debug: false, // Enable verbose theme discovery logs
    cacheTimeout: 60000,
    fileLogging: false,
  },

  // i18n Discovery
  i18n: {
    debug: false, // Enable verbose i18n discovery logs
    fallbackLanguage: 'en', // Default language
    cacheTimeout: 60000,
    fileLogging: false,
  },

  // Asset Discovery
  assets: {
    debug: false,
    cacheTimeout: 60000,
  },

  // Feature Validation
  features: {
    debug: false,
  },
});
```

### Server Options

Configure Vite dev server:

```javascript
export default defineViteConfig({
  server: {
    port: 3002,
    host: true,
    open: true,

    // HMR configuration
    hmr: {
      overlay: true, // Show error overlay in browser
      protocol: 'ws',
      timeout: 5000,
    },

    // File watching (native watching is default)
    watch: {
      usePolling: false, // ⚠️ Only enable for Docker/NFS - causes high CPU
      interval: 2000, // Poll interval if usePolling is enabled (2s recommended)
    },
  },
});
```

### Common Configuration Patterns

**Minimal Logging (Production-like):**

```javascript
export default defineViteConfig({
  debug: false, // Default - only errors/warnings
  features: ['auth', 'billing'],
});
```

**Full Debug Mode (Troubleshooting):**

```javascript
export default defineViteConfig({
  debug: true, // Enable ALL framework logs
  features: ['auth', 'billing'],
});
```

**Quiet Dev with File Logs:**

```javascript
export default defineViteConfig({
  routes: {
    fileLogging: true, // Logs go to .dndev-logs/ directory
    hmr: false, // No spam on file changes
  },
  themes: {
    fileLogging: true,
  },
});
```

**Performance Mode (Disable Route HMR):**

```javascript
export default defineViteConfig({
  routes: {
    hmr: false, // Disable route HMR to prevent discovery spam
  },
});
```

### Environment Variables

- `DNDEV_DEBUG_WORKSPACE=true` - Show workspace resolution debug logs
- `NODE_ENV` - Controls dev/production mode
- `VITE_APP_URL` - Base URL for SEO (robots.txt, sitemap.xml) - **set in `.env.production` for production builds**

## Configuration Convention

DNDev uses a **dual-source configuration strategy** to separate concerns:

### 1. App Metadata (`src/config/app.ts`)

Define app-level constants and React configuration in TypeScript. URLs should be defined in `.env` files (per-environment):

```typescript
// src/config/app.ts
import type { AppConfig } from '@donotdev/types';

// App metadata - REQUIRED for SEO generation
export const APP_NAME = 'My App';
export const APP_SHORT_NAME = 'MyApp';
export const APP_DESCRIPTION = 'My app description';

// Full app configuration with React components
export const appConfig: AppConfig = {
  app: {
    name: APP_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
  },
  layout: {
    preset: 'landing',
  },
  features: {
    debug: true,
  },
};
```

**Why TypeScript?**

- Type-safe exports for React components
- Auto-discovery via regex parsing (no imports needed at build time)
- Single source of truth for app metadata

### 2. Environment Variables (`.env`)

Define environment-specific values:

```bash
# .env

# Base URL - REQUIRED for SEO generation (robots.txt, sitemap.xml)
VITE_APP_URL=https://yourdomain.com

# API Keys and Secrets
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Why .env?**

- Environment-specific values (dev/staging/prod)
- Secrets that shouldn't be in source code
- Available at build time and runtime

### What Goes Where?

| Type               | Location           | Example                            | Why                                 |
| ------------------ | ------------------ | ---------------------------------- | ----------------------------------- |
| App name, metadata | `app.ts`           | `APP_NAME`, `APP_SHORT_NAME`       | Type-safe, used in React components |
| Base URL           | `.env`             | `VITE_APP_URL`                     | Changes per environment             |
| API keys, secrets  | `.env`             | `VITE_FIREBASE_*`, `VITE_STRIPE_*` | Security, per-environment           |
| Layout preset      | `app.ts`           | `preset`                            | App-level constant                  |
| Feature flags      | `app.ts` or `.env` | `features.debug`                   | Depends on use case                 |

### How It Works

1. **Build time**: The config package loads `.env` files using Vite's `loadEnv()` and makes them available to Node.js plugins via `process.env`
2. **Build time**: App constants are discovered from `app.ts` via regex parsing (no imports, no JSX execution)
3. **Build time**: SEO plugin generates `robots.txt` and `sitemap.xml` using discovered baseUrl and siteName
4. **Runtime**: React app imports `app.ts` and accesses config via `AppConfigProvider`

### SEO Generation

The framework automatically generates SEO files if:

- ✅ `VITE_APP_URL` is defined in `.env` (or explicit `seo.baseUrl` in config)
- ✅ `APP_NAME` is exported from `src/config/app.ts` (or explicit `seo.siteName` in config)

**Example output:**

```
dist/
├── robots.txt      # Auto-generated with baseUrl
└── sitemap.xml     # Auto-generated with discovered routes
```

If these are missing, you'll see a warning:

```
⚠️  SEO Plugin disabled - missing required configuration:
     - baseUrl (VITE_APP_URL in .env)

   To fix:
     1. Add VITE_APP_URL=https://yourdomain.com to your .env file
```

## Discovery System

The config package discovers and populates `globalThis._DNDEV_CONFIG_` with:

- **Routes**: Page components and routing information
- **Themes**: CSS variables and theme definitions
- **I18n**: Translation files and language configuration
- **Assets**: Public assets and optimization data
- **App Constants**: APP_NAME, APP_SHORT_NAME, APP_DESCRIPTION from `app.ts`

### Runtime Access

Access discovery data at runtime:

```typescript
// Get i18n configuration
import { getI18nConfig } from '@donotdev/i18n';
const i18nConfig = getI18nConfig();

// Get app config
import { useAppConfig } from '@donotdev/hooks';
const config = useAppConfig();
```

## Provider Architecture

All applications use the centralized provider system:

```tsx
<ViteAppProviders>
  {/* ... */}
</ViteAppProviders>
// or
<NextJsAppProviders>
  {/* ... */}
</NextJsAppProviders>
```

**No duplicate providers are generated** - the config package focuses on discovery and data population, not provider creation.

## Migration Guide

### From Old Next.js Setup

1. **Remove generated providers**:

   ```bash
   rm src/components/I18nProvider.tsx
   rm src/components/ThemeProvider.tsx
   rm src/hooks/useTranslation.ts
   ```

2. **Use ViteAppProviders or NextJsAppProviders**:

   ```tsx
   import { NextJsAppProviders } from '@donotdev/ui/next';

   export default function Layout({ children }) {
     return (
       <NextJsAppProviders layout="landing">{children}</NextJsAppProviders>
     );
   }
   ```

   or for Vite:

   ```tsx
   import { ViteAppProviders } from '@donotdev/ui/vite';
   import { HomePage } from './pages/HomePage';

   export default function App() {
     return (
       <ViteAppProviders layout="landing" LandingPage={HomePage}>
         {/* Your app content */}
       </ViteAppProviders>
     );
   }
   ```

3. **Access data via runtime APIs**:
   ```typescript
   import { getI18nConfig } from '@donotdev/i18n';
   import { getRoutes } from '@donotdev/stores';
   ```

## Troubleshooting

### HMR Not Working (Vite)

If Hot Module Replacement isn't working:

1. **Check browser console** for WebSocket connection errors
2. **Check if it's actually a logging issue** - Try `debug: false` and `routes: { hmr: false }` first
3. **Enable polling** if native file watching fails (Docker/NFS only):

   ```typescript
   // vite.config.ts
   export default defineViteConfig({
     features: ['auth', 'billing'],
     server: {
       port: 3002,
       watch: {
         usePolling: true,
         interval: 2000, // Poll every 2 seconds (⚠️ causes high CPU if too frequent)
       },
     },
   });
   ```

   **⚠️ Warning:** Polling is OFF by default for a reason - it can cause high CPU usage. Only enable if native file watching doesn't work (e.g., Docker volumes, NFS mounts).

4. **Verify React Fast Refresh** is enabled (automatic in dev mode)
5. **Check file permissions** and inotify limits on Linux:

   ```bash
   # Check current limit
   cat /proc/sys/fs/inotify/max_user_watches

   # Increase if needed (temporary)
   sudo sysctl fs.inotify.max_user_watches=524288
   ```

### robots.txt Not Generated

Ensure both required values are present:

1. **Check `.env` has VITE_APP_URL**:

   ```bash
   VITE_APP_URL=https://yourdomain.com
   ```

2. **Check `src/config/app.ts` exports APP_NAME**:

   ```typescript
   export const APP_NAME = 'My App';
   ```

3. **Run build and check logs** for SEO plugin warnings:
   ```bash
   bun run build
   # Look for: "✅ Site Name: ..." and "✅ Base URL: ..."
   ```

### Deployment Issues

If `.env` variables aren't set during deployment:

1. **Ensure build runs before deploy**:

   ```json
   {
     "deploy:frontend": "bun run build && firebase deploy --only hosting"
   }
   ```

2. **Check `.env` exists** in the app directory (not just `.env.example`)
3. **Verify mode** matches your `.env` file:
   - `.env` = loaded in all modes
   - `.env.production` = only loaded in production mode
   - `.env.test` = only loaded in test mode

### Next.js Client Component Errors

If you see `useEffect` errors in Next.js, ensure your loading components are client-only:

```tsx
// In your hooks package
'use client';

export const MyLoadingComponent = ({ children }) => {
  // Your loading logic
};
```

### Missing Discovery Data

Check that your config is properly set up and discovery is enabled:

```javascript
export default defineNextConfig({
  routes: { debug: true }, // Enable debug to see discovery logs
  themes: { debug: true },
  i18n: { debug: true },
});
```

### Provider Conflicts

No longer relevant—use only ViteAppProviders or NextJsAppProviders as entry points.

## Architecture Benefits

- **Unified runtime**: Same APIs across Vite and Next.js
- **No duplication**: Single provider system
- **Framework agnostic**: Works with any React setup
- **Performance**: Virtual modules for efficient data access
- **Maintainability**: Centralized provider management
