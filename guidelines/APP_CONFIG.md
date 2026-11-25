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

  // prerenderRecords: true,  // Entity pages (/produits/:slug) built at build, one per published record (Next and Vite)

  // fonts: { ... },           // Your own woff2 files, per family named in themes.css (see "App fonts")

  // Next only
  // revalidate: 3600,        // Cache lifetime of cached pages, sitemap, llms.txt (seconds, or false = until next deploy)
};
```

**Next caching.** Every public page is cached (ISR, `revalidate`). Entity pages (single-param route whose page declares its entity in PageMeta, `entity: productEntity`, not `auth`, not `seo.noindex`: the sitemap's dynamic routes) are prerendered at build, one per published record (`status` not in `HIDDEN_STATUSES`, public anonymous reader, same records as the sitemap, at most 1000 per route). Records published later render on their first request, then are cached. The build reads the database as a signed-out visitor: Supabase with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` (RLS decides), Firebase with `NEXT_PUBLIC_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (Firestore Security Rules decide; they must allow the whole query `status not-in HIDDEN_STATUSES`, rules are not filters). Missing variables or a failed read fail it (as for the sitemap). Each entity page also reads its own record with that reader for its server metadata (`generateMetadata`, JSON-LD) and answers 404 when no public record matches (see ui `SEO.md`); Firestore then needs the composite index of `<param> == value` + `status not-in` (the read fails with the link to create it). `prerenderRecords: false` skips the build-time prerender only (every URL renders on its first request). An app on any other provider fails the build on such a page: mark it `seo: { noindex: true }`, or export `generateMetadata` from a server page module and set `prerenderRecords: false`. Any other value than a boolean fails the build.

**Vite record pages.** With `prerender: 'auto'` (the default) the Vite build writes one static HTML per published record of the same entity pages and per language (`dist/produits/serum.html`; same records, same identity as the Next entity page: title, description, canonical, Open Graph, Twitter, hreflang, Product and BreadcrumbList JSON-LD; see ui `SEO.md`). It reads the database once as a signed-out visitor, for these pages and for `dist/sitemap.xml` / `dist/llms.txt` (which list the records too): Supabase with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLIC_KEY`, Firebase with `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_PROJECT_ID`; record pages also need `VITE_APP_URL` (absolute, no trailing slash; public on a deploy build: `dndev deploy`, Vercel or CI. A local build takes a localhost one, with one warning line, and writes no record page without one; ui `SEO.md`, Sitemap & llms.txt, URLs). Missing variables, a failed read, another provider or no `entities` package fail the build. Records published later get the SPA shell (`dist/_shell.html`) until the next build. `prerenderRecords: false` writes no record page (the sitemap still lists the records, so the build still reads them).


**App fonts (`fonts`).** Only for families no package provides (a custom subset, a licensed brand font): every other family the theme names ships by name from `@fontsource-variable/<slug>` / `@fontsource/<slug>` (see core `THEMES.md`, Fonts). Read at build, Next and Vite alike: the files ship content-hashed under `/fonts/`, preloaded and declared inline like any other family. Name the family in `src/themes.css` as the key reads (`--font-sans: Pretendard, 'Pretendard Fallback', 'Pretendard Rare', sans-serif;`).

```typescript
fonts: {
  Pretendard: {
    category: 'sans-serif', // fallback face: Arial ('serif': Times New Roman)
    faces: [{ file: 'src/assets/fonts/pretendard.woff2', weight: '300 700' }], // core file: preloaded
  },
  'Pretendard Rare': {
    category: 'sans-serif',
    faces: [
      // unicodeRange: downloaded only for those characters, never preloaded
      { file: 'src/assets/fonts/pretendard-rare-1.woff2', weight: '300 700', unicodeRange: 'U+AC00-B0FF' },
    ],
  },
},
```

Face fields: `file` (woff2, relative to the app root), `weight` (`400` or a variable range `'300 600'`), `style` (`'normal'` default, `'italic'`), `unicodeRange`, `subset` (a face with a `unicodeRange` preloaded on pages whose language needs that subset, e.g. `'latin-ext'` for `pl`). The build fails on a missing or non-woff2 file, or a family with no normal face (the fallback face is measured on its core file, which must hold a-z).
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
- CSP baseline (`'self'`, inline styles, `https:` images, `data:` fonts, `frame-src 'none'`, `object-src 'none'`; `script-src` is `'self'` on Vite and `'self' 'unsafe-inline'` on Next, which emits inline bootstrap scripts) + the backend's sources from the app's `package.json`: `@donotdev/supabase` → `connect-src https://*.supabase.co wss://*.supabase.co`; `@donotdev/firebase` → Google auth and Firebase origins. CAPTCHA on (the app sets `VITE_TURNSTILE_SITE_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, non-empty) adds `https://challenges.cloudflare.com` to `script-src` and `frame-src` (Turnstile); no key = no Turnstile source, `frame-src 'none'`. The key is read from the build's env (Vite `loadEnv`, Next `process.env`), so a Vite / static-export app's committed vercel.json follows it: regenerate it after setting or removing the key, and give the host's build the same key, or the CI header check fails.
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

# .dndev.secrets (project root, gitignored) - server-side secrets (never exposed to browser)
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_WEBHOOK_SECRET=whsec_...
```

Push server secrets to Firebase: `dndev sync-secrets` (also done by `dndev deploy` for the secrets the functions bind; see [ENV_SETUP.md](./ENV_SETUP.md))

---

## 6. Next: running a foreign Next app (Payload CMS)

A foreign Next app (Payload CMS: `/admin`, `/api`) can live inside a dndev Next app. Working reference: carvolix `apps/cms` (`next.config.ts`, `src/app/(payload)/`). Three rules:

1. **Route files carry the `.next.` marker.** The framework sets Next `pageExtensions` to `next.tsx|ts|jsx|js` (`config/next/nextFiles.js`: `NEXT_PAGE_EXTENSIONS`), so only `layout.next.tsx`, `page.next.tsx`, `route.next.ts`... are routes. An unmarked `layout.tsx` / `page.tsx` is ignored by Next. Rename the foreign app's route files.
2. **A route group with its own root layout (`(payload)`) needs 2+ languages.** With 2+ languages the framework root layout lives in `src/app/[lang]/layout.next.tsx` (`RouteHandler.rootDir()`), so `src/app/(payload)/layout.next.tsx` is a second root layout beside it. The proxy matcher excludes `api` (`/api` is never a page); `/admin` is not a page of the app, and carvolix relies on the proxy passing it through (not confirmed from the proxy code, only from carvolix running). With one language the framework generates `src/app/layout.next.tsx` as the only root layout, rendering `AppDocument`; `(payload)/layout.next.tsx` then nests inside it (two `<html>`), and the app cannot replace the generated root layout: `assertAppDocument()` fails the build when `src/app/layout.next.tsx` (or `[lang]/layout.next.tsx`, `not-found.next.tsx`, `global-not-found.next.tsx`) is app-owned. So a foreign root layout cannot coexist with one language. The nesting outcome (nested `<html>` at runtime) is Next behaviour, not verified here.
3. **`defineNextConfig` returns an async function** (Next calls it with the phase). A Next plugin such as `withPayload` takes the resolved object, so wrap the resolved config:

   ```ts
   const dndevConfig = defineNextConfig({ appConfig, i18n: { fallbackLanguage: 'fr', only: ['fr', 'en'] } });

   export default async function nextConfig(...args: unknown[]) {
     return withPayload(await dndevConfig(...args), { devBundleServerPackages: false });
   }
   ```

---

**Zero config. Override when needed.**
