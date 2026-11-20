# App Configuration

Configure `src/config/app.ts` and `vite.config.ts`. Framework handles the rest.

---

## 1. App Configuration

```typescript
// src/config/app.ts
import type { AppConfig } from '@donotdev/core';

export const appConfig: AppConfig = {
  app: {
    name: 'My App',
    shortName: 'App',              // Required for PWA
    description: 'My app description', // Required for PWA
    url: 'https://myapp.com',
  },

  preset: 'landing', // landing | admin | moolti | docs | blog | game | plain

  features: {
    debug: false, // Enable debug tools
    requiredCookies: ['necessary'], // Cookie consent categories; only 'necessary' = no cookie banner, no #cookie-settings link
  },

  auth: {
    authRoute: null,          // null = in-place fallback (default), or string to redirect
    roleRoute: '/404',
    tierRoute: '/404',
    // loginPath: '/login',   // Optional: undefined = header providers
    profilePath: '/profile',
  },
  // auth: false disables auth routes; pages must then declare no `auth` (see ui PAGES guideline)

  i18n: {
    defaultLanguage: 'en',
    fallbackLanguage: 'en',
  },

  theme: {
    defaultTheme: 'light',
  },

  // Next only
  // revalidate: 3600,        // Cache lifetime of cached pages, sitemap, llms.txt (seconds, or false = until next deploy)
  // prerenderRecords: true,  // Entity pages (/produits/:slug) built at build, one per published record
};
```

**Next caching.** Every public page is cached (ISR, `revalidate`). Entity pages (single-param route whose page sits in `src/pages/<entity>/`, not `auth`, not `seo.noindex`: the sitemap's dynamic routes) are prerendered at build, one per published record (`status` not in `HIDDEN_STATUSES`, public anonymous reader, same records as the sitemap, at most 1000 per route). Records published later render on their first request, then are cached. The build reads the database as a signed-out visitor: Supabase with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` (RLS decides), Firebase with `NEXT_PUBLIC_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (Firestore Security Rules decide; they must allow the whole query `status not-in HIDDEN_STATUSES`, rules are not filters). Missing variables or a failed read fail it (as for the sitemap). An app on any other provider fails the build on such a page: set `prerenderRecords: false` (every URL renders on its first request). Any other value than a boolean fails the build.

---

## 2. Vite Configuration

```typescript
// vite.config.ts
import { defineViteConfig } from '@donotdev/core/vite';
import { appConfig } from './src/config/app';

export default defineViteConfig({
  appConfig,  // Required
});
```

**Done.** Routes, themes, and translations are automatically detected from your `src/` directory.

---

## 3. Optional Vite Options

```typescript
export default defineViteConfig({
  appConfig,

  // Debug
  debug: true,
  verbose: true,

  // Debug options
  routes: { debug: true },
  themes: { debug: true },
  i18n: { debug: true },

  // i18n — language set is discovered from *_<lang>.json filenames.
  // `only` restricts what the app uses without touching the files:
  // languages outside the list are dropped from supportedLanguages,
  // the mapping and the inlined content (nothing bundled, no chunks,
  // and a single language hides the LanguageSelector). Same option on
  // defineNextConfig. Remove it to get the other languages back.
  i18n: {
    fallbackLanguage: 'ko',
    only: ['ko'],
  },

  // Server
  server: {
    port: 3000,
    https: true,
  },

  // Build
  build: {
    sourcemap: false,
  },

  // SEO
  seo: {
    disabled: false,
    generateRobotsTxt: true,
    generateSitemap: true,
  },

  // PWA (see PWA.md for full guide)
  pwa: {
    enabled: false,      // Enable PWA in production
    devEnabled: false,  // Enable PWA in development (optional)
  },
});
```

---

## 4. HTTP Response Headers

One framework policy (`@donotdev/core` `config/headerPolicy.js`) defines every response header. Never hand-write header rules in `vercel.json` or next.config.

**Framework sends (every app):**
- Security headers on every path: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (no geolocation, microphone or camera).
- CSP baseline (`'self'`, inline styles, `https:` images, `data:` fonts, `frame-src 'none'`, `object-src 'none'`; `script-src` is `'self'` on Vite and `'self' 'unsafe-inline'` on Next, which emits inline bootstrap scripts) + the backend's sources from the app's `package.json`: `@donotdev/supabase` → `https://*.supabase.co wss://*.supabase.co`; `@donotdev/firebase` → Google auth and Firebase origins.
- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` when `seo: false` (private app).
- Cache classes: hashed build assets 1 year `immutable` (Vite `/assets/*`; Next sets `/_next/static` itself), public images (`jpg jpeg png svg webp ico`) 1 day, `*.json` 1 hour. HTML gets no rule (Next: `revalidate`; static hosts revalidate it). PWA on: `/manifest.json` 1 hour, `/sw.js` `no-cache`.

**App deltas** go in `appConfig.headers` (same option on Vite and Next):

```typescript
export const appConfig: AppConfig = {
  headers: {
    // Extra CSP sources, merged per directive (a directive that gains sources drops its 'none')
    csp: { 'connect-src': ['https://recherche-entreprises.api.gouv.fr'] },
    // Cache-Control per path: `public, max-age=<maxAge>[, immutable]`, emitted last (wins)
    cache: [{ source: '/images/:path*', maxAge: 31536000 }],
  },
};
```

Unknown keys, unknown directives, sources containing spaces, `;` or `,`, and malformed quoted sources fail the build. A source is an origin, a keyword (`'self'`, `'none'`, `'unsafe-inline'`, `'unsafe-eval'`, `'unsafe-hashes'`, `'wasm-unsafe-eval'`, `'strict-dynamic'`, `'report-sample'`) or a hash (`'sha256-<base64>'`, also `sha384`/`sha512`). A Vite app with a genuine inline script allows it by hash, never with `'unsafe-inline'`: `csp: { 'script-src': ["'sha256-<base64>'"] }`. On Next, do not add a hash to `script-src`: a hash makes browsers ignore `'unsafe-inline'` and breaks Next's inline scripts.

**Who serves them:**
- **Next (server):** `defineNextConfig` serves the policy from `headers()` in production builds (not in `next dev`: the CSP would block dev tooling). An app's own next.config `headers` are merged after the policy. A `headers` key in the app's `vercel.json` fails the build (second source).
- **Vite / Next `output: 'export'`:** the host serves headers, so the policy is written into the `headers` key of the app's `vercel.json` at every dev and build start (other keys untouched). Commit the file. On CI (`CI` / `VERCEL`) a stale `headers` key fails the build instead of being rewritten. No `vercel.json`: nothing written.

---

## 5. Environment Variables

**Vite loads `.env` from the app directory only.** Not the repo root.

Run `dndev coach` to see what to configure, then `dndev setup` to validate and automate.

```bash
# apps/<your-app>/.env - client-side variables (exposed to browser)
VITE_APP_URL=http://localhost:5173
VITE_FIREBASE_API_KEY=...          # Written by dndev setup
VITE_FIREBASE_PROJECT_ID=...       # Written by dndev setup
VITE_AUTH_PARTNERS=github,google
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# functions/.env - server-side secrets (never exposed to browser)
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_WEBHOOK_SECRET=whsec_...
```

Push server secrets to Firebase: `dndev sync-secrets`

---

**Zero config. Override when needed.**
