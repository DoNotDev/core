# @donotdev/core

## Unreleased

### Breaking Changes

- Removed the namespace re-exports of `@donotdev/core`: `Types`, `Utils`, `Stores`, `Schemas`, `Hooks`, `I18n`. Import the named symbols instead (`import { createDoNotDevStore } from '@donotdev/core'`, not `Stores.createDoNotDevStore`). The namespace objects kept every module of a package in consumer bundles.
- The browser entry (`@donotdev/core`) no longer re-exports the server-only utils at runtime: `addMonths`, `addYears`, `calculateSubscriptionEndDate`, `parseISODate`, `parseServerCookie`, `validateEnvVar`, `validateMetadata`, `validateUrl` and the `ServerUtils` namespace. Its types never declared them; import them from `@donotdev/core/server`.

### Patch Changes

- Flags load on demand: the browser build is code-split, each `Flag` country component is its own chunk (`chunks/`) that Vite and Next keep as an async chunk. The 112 flag components (about 570 KB) were inlined into the eager `index.js`; `index.js` drops from 697 KB to 128 KB minified (194 KB to 38 KB gzip). No app change.
- Types, schemas and common utils ship once in `shared.js`, imported by `index.js` and `server.js`; `server.js` holds only the server-only utils. `@donotdev/core/server` exports the same names as before.

- Next entity pages are prerendered at build: the generated `generateStaticParams` of each single-param page the sitemap lists (`/produits/:slug`) returns one params object per published record (`listStaticParams` from `@donotdev/core/next`, public anonymous reader, `HIDDEN_STATUSES` filter), the sitemap's records through one shared lister (`publicPages.js`) and one route → collection decision (`publicCollection`). It returned `[]`, so every first visit of a product rendered on demand (2–5 s). `revalidate` and the default `dynamicParams` stay: records published later render on their first request, all refresh per `appConfig.revalidate`. Other dynamic pages keep `[]`. Opt out with `appConfig.prerenderRecords: false`. The build reads the database (missing env or a failed read fails it); a provider without a server reader (Firebase) fails the build on such a page until it opts out.
- Sitemap and llms.txt exclude error routes (`/404`, `/not-found`, `/500`, `/error`) at the source (`isIndexableRoute`); a scaffolded `NotFoundPage` (`/404`) no longer fails the build with `llms.txt: page "/404" has no title`. The Vite / dndev `NotFoundPage` templates also set `seo: { noindex: true }`.
- `routes.manifest.hasBlogFeed` (Next and Vite route config): `true` when `src/content/blog/*_en.md` exists, i.e. when `rss.xml` is generated. `@donotdev/ui` `AutoMetaTags` links `/rss.xml` only then (it linked it unconditionally and 404ed on apps without a feed).
- `isCookieNoticeRequired(requiredCookies)`: `false` when the app sets only strictly necessary cookies (no `functional` / `analytics` / `marketing` in `features.requiredCookies`, no feature with optional cookies). `@donotdev/ui`: `ConsentBanner` (Next and Vite) then renders nothing and never loads the banner chunk, and the `#cookie-settings` link (`Link`, footer legal links) is not rendered. Any non-necessary category keeps the previous behaviour. `PrivacyPolicyTemplate` (13 `privacy_*` locales) states that only strictly necessary cookies are used and lists them (preferences, sign-in session, payment) in that case.
- `@donotdev/ui` `FeatureCard`: the hard-coded English `aria-label` ("Learn more about ...") on the link wrapper is gone, so the accessible name is the visible text.
- One HTTP response header policy (`config/headerPolicy.js`): security headers, CSP built from directives plus the backend provider's sources, `X-Robots-Tag: noindex` for `seo: false`, cache classes. `script-src` baseline per target: `'self'` on Vite (builds have no inline scripts), `'self' 'unsafe-inline'` on Next (inline bootstrap scripts); `appConfig.headers.csp` accepts hash sources (`'sha256-<base64>'`) for a Vite inline script, and malformed quoted sources fail the build. Apps declare deltas in `appConfig.headers` (`csp` sources, per-path `cache` overrides). Next serves it from `headers()` in production builds and fails the build when the app's `vercel.json` has `headers`; Vite (and Next `output: 'export'`) writes it into the `headers` key of the app's `vercel.json` at dev/build start, and fails on CI when the committed file is stale. Scaffolded `vercel.json` files carry no header rules; `csp.example.json` is gone.
- `defineNextConfig` passes the app's own Next options through (the documented contract): they were silently dropped because the Next config function's `phase` argument shadowed them. `webpack`, `rewrites`, `redirects` and `headers` are composed with the framework's (app `headers` after the policy).
- App URL (`AppConfigProvider`) resolves from the `APP_URL` env var on server and client alike (dev without it: `http://localhost:3000`). Dev used `window.location.origin` in the browser and `localhost:3000` on the server, so SSR on another port hydrated with a JSON-LD/canonical mismatch.
- Lucide icons are no longer all bundled. `@donotdev/ui` imported the whole `lucide-react` namespace to resolve icon name strings (`Icon`, `ThemeToggle`, `SettingsMenu`, `AuthMenu`), which put all ~1,600 icons in every bundle (`Link` renders `Icon`, so every page). Now: named imports only; theme icons (`--theme-icon`) come from a build-time registry, `_DNDEV_CONFIG_.themes.icons`, written by the theme discovery into `virtual:themes` (Vite) and `src/config/dndev-config-theme.js` (Next) as named imports, so the theme toggle renders them statically and server-side. Any other icon name string (`<Icon icon="Rocket">`, `Link icon`, auth menu items) loads through `lucide-react/dynamic`, one async chunk per icon, with a same-size placeholder until it arrives (none in server HTML). Icon components (`icon={Sun}`) are unchanged. Theme icon names that are not lucide-react exports are reported at build; unknown names still show `Palette` (`Settings` in the auth menu).
- `@donotdev/ui` `Link` on Next.js renders `next/link` for internal paths, so routes are prefetched (next/link default; `prefetch={false}` disables it) and navigation is client-side through Next. `prefetch` was accepted but never applied (a plain `<a>` + `router.push`). Same public API and a real `<a href>` in the current language; overlays still close on navigation; on Next an `onClick` calling `preventDefault()` now cancels the navigation (next/link). Vite keeps react-router navigation. The platform link is the new `@donotdev/ui/routing/link` subpath (`vite-app` condition → Vite, default → Next, like `routing/hooks`). Cards (`href`) and Tables link through it.

## 0.1.48

### Patch Changes

- `CreateCheckoutSessionRequestSchema` keeps the 0.1.x fields (`priceId`, `unitAmount`, `productName`, `currency`, `mode`, `userId`, `productId`, `userEmail`) instead of stripping them.
- New `BeforeCheckoutOptions`: `BeforeCheckoutHook`'s second argument is the normalized request plus the 0.1.x checkout options (`mode`, `priceId`, ...); hooks typed with `CheckoutOptions` keep compiling. `BeforeCheckoutResult.overrides` applies again to 0.1.x dynamic pricing.
- StripeOrder shipping: `allowedCountries` must be uppercase ISO 3166-1 alpha-2 codes, `shippingRateIds` holds at most 5 (`MAX_SHIPPING_RATE_IDS`), matching Stripe's Checkout Session limits.
- Next discovery runs once per build again: the `.dndev-build` marker is now overwritten (it was written once, ever, so every next.config evaluation re-ran discovery).
- Next discovery no longer deletes `src/config/dndev-config-*.js` and the public manifests before regenerating them. Files are overwritten in place and only artifacts the run did not rewrite are removed afterwards, so a dev server compiling while another Next process runs discovery stops failing with `Module not found: '../config/dndev-config-*.js'`.
- `PathResolver.write` / `writeSync` end JSON files with a trailing newline.
- Next route generation removes the generated `*PageClient.tsx` of a deleted page along with its `page.tsx`: the orphan wrapper imported the missing page and broke the type check.

## 0.1.43

### Patch Changes

- 98d641c: Add puppeteer to dependencies-matrix for all Vite templates and fix loadPuppeteer to use sync require.resolve before dynamic import, preventing process hang when puppeteer is missing.
- a4c57d7: bugfixes and performance upgrades
- Updated dependencies [064cfbb]
- Updated dependencies [a4c57d7]
- Updated dependencies [2b8210a]
  - @donotdev/schemas@0.1.43
  - @donotdev/components@0.1.44
  - @donotdev/hooks@0.1.43
  - @donotdev/i18n@0.1.43
  - @donotdev/utils@0.1.43
  - @donotdev/stores@0.1.43
