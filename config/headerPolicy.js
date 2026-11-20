/**
 * @fileoverview HTTP response header policy (SSOT)
 * @description The one place where the framework defines HTTP response headers: security
 * headers (CSP built from structured directives), the noindex header of private apps, the
 * cache classes and the PWA file headers. Apps declare only their deltas in
 * `appConfig.headers` (extra CSP sources, per-path cache overrides); `appConfig.seo: false`
 * adds the noindex header.
 *
 * Emitters (all read `resolveHeaderRules`):
 * - Next (server): `defineNextConfig` serves the rules from `headers()` (production builds).
 *   The app's vercel.json must carry no `headers` (`assertNoVercelHeaders`).
 * - Vite and Next static export: the host serves headers, so the rules are written into the
 *   `headers` key of the app's vercel.json at every dev/build start (`syncVercelHeaders`);
 *   on CI a stale file fails the build. The generator is the only writer of that key.
 *
 * Rule order is precedence: when two rules set the same header on a path, the later one wins
 * (Next documents it; app cache overrides are emitted last).
 *
 * @version 0.1.0
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every path (Next and Vercel `source` syntax; also matches `/`). */
const ALL_PATHS = '/(.*)';

/** Canonical CSP directive order. Directives an app may extend. */
export const CSP_DIRECTIVES = Object.freeze([
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'connect-src',
  'media-src',
  'worker-src',
  'manifest-src',
  'frame-src',
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
]);

/**
 * Framework CSP baseline (`upgrade-insecure-requests` is appended to every policy).
 * `script-src` is added per target (see SCRIPT_SRC_BASELINE).
 */
const BASE_CSP = Object.freeze({
  'default-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
});

/**
 * Baseline `script-src` per target. Next emits inline bootstrap/hydration scripts (no
 * nonces), so it needs `'unsafe-inline'`; Vite builds ship only `<script type="module" src>`.
 * A Vite app with a genuine inline script allows it by hash (`appConfig.headers.csp`).
 */
const SCRIPT_SRC_BASELINE = Object.freeze({
  next: ["'self'", "'unsafe-inline'"],
  'next-export': ["'self'", "'unsafe-inline'"],
  vite: ["'self'"],
});

/**
 * CSP sources each backend provider's browser SDK needs, keyed by provider package.
 * Billing needs none: checkout redirects to Stripe (no Stripe.js in the browser).
 */
export const PROVIDER_CSP = Object.freeze({
  '@donotdev/supabase': {
    'connect-src': ['https://*.supabase.co', 'wss://*.supabase.co'],
  },
  '@donotdev/firebase': {
    'script-src': ['https://accounts.google.com', 'https://apis.google.com'],
    'connect-src': [
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://www.googleapis.com',
      'https://*.googleapis.com',
      'https://*.firebaseio.com',
    ],
    'frame-src': ['https://accounts.google.com'],
  },
});

/** Security headers sent on every response, besides the CSP. */
const SECURITY_HEADERS = Object.freeze([
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
]);

/** Sent on every response of a private app (`appConfig.seo: false`). */
const NOINDEX_HEADER = Object.freeze({
  key: 'X-Robots-Tag',
  value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
});

const ONE_YEAR = 31536000;
const ONE_DAY = 86400;
const ONE_HOUR = 3600;

/**
 * Hashed build output (file name changes with content): cached a year, immutable.
 * Next (server) sets this itself on /_next/static and does not let it be overridden.
 */
const IMMUTABLE_BUILD_ASSETS = Object.freeze({
  vite: ['woff', 'woff2', 'ttf', 'eot', 'js', 'css'].map(
    (ext) => `/assets/:path*.${ext}`
  ),
  'next-export': ['/_next/static/:path*'],
  next: [],
});

/** Public (unhashed) images: one day. */
const IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'svg', 'webp', 'ico']);

/** PWA files (`pwa.enabled`): manifest an hour, service worker never cached. */
const PWA_RULES = Object.freeze([
  {
    source: '/manifest.json',
    headers: [
      { key: 'Content-Type', value: 'application/manifest+json' },
      { key: 'Cache-Control', value: `public, max-age=${ONE_HOUR}` },
    ],
  },
  {
    source: '/sw.js',
    headers: [
      { key: 'Content-Type', value: 'application/javascript' },
      { key: 'Cache-Control', value: 'no-cache' },
    ],
  },
]);

/** Keys `appConfig.headers` accepts. */
const HEADERS_CONFIG_KEYS = Object.freeze(['csp', 'cache']);

/**
 * @param {number} maxAge - Seconds
 * @param {boolean} [immutable]
 * @returns {string} Cache-Control value
 */
function publicCache(maxAge, immutable = false) {
  return `public, max-age=${maxAge}${immutable ? ', immutable' : ''}`;
}

/**
 * @param {string} source
 * @param {string} value - Cache-Control value
 * @returns {{ source: string, headers: Array<{ key: string, value: string }> }}
 */
function cacheRule(source, value) {
  return { source, headers: [{ key: 'Cache-Control', value }] };
}

/** Quoted CSP keywords an app may add. */
const CSP_KEYWORDS = Object.freeze([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'unsafe-hashes'",
  "'wasm-unsafe-eval'",
  "'strict-dynamic'",
  "'report-sample'",
]);

/** Quoted hash source: `'sha256-<base64>'` (also sha384, sha512). */
const CSP_HASH = /^'sha(256|384|512)-[A-Za-z0-9+/_-]+={0,2}'$/;

/**
 * Reject a CSP source that could break out of its directive or is a malformed keyword/hash.
 * @param {string} directive
 * @param {unknown} source
 */
function assertCspSource(directive, source) {
  if (typeof source !== 'string' || source === '' || /[\s;,]/.test(source)) {
    throw new Error(
      `[dndev] appConfig.headers.csp['${directive}']: invalid source ${JSON.stringify(source)} (one origin, keyword or hash per entry, no spaces, ';' or ',').`
    );
  }
  if (
    source.includes("'") &&
    !CSP_KEYWORDS.includes(source) &&
    !CSP_HASH.test(source)
  ) {
    throw new Error(
      `[dndev] appConfig.headers.csp['${directive}']: invalid quoted source ${JSON.stringify(source)} (allowed: ${CSP_KEYWORDS.join(' ')} or a hash like 'sha256-<base64>').`
    );
  }
}

/**
 * Validate `appConfig.headers` (JS apps bypass the type).
 * @param {unknown} config
 * @returns {{ csp: Record<string, string[]>, cache: Array<{ source: string, maxAge: number, immutable?: boolean }> }}
 */
function readHeadersConfig(config) {
  if (config === undefined) return { csp: {}, cache: [] };
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('[dndev] appConfig.headers must be an object.');
  }
  for (const key of Object.keys(config)) {
    if (!HEADERS_CONFIG_KEYS.includes(key)) {
      throw new Error(
        `[dndev] appConfig.headers.${key} is not a header option (allowed: ${HEADERS_CONFIG_KEYS.join(', ')}).`
      );
    }
  }
  const csp = config.csp ?? {};
  for (const [directive, sources] of Object.entries(csp)) {
    if (!CSP_DIRECTIVES.includes(directive)) {
      throw new Error(
        `[dndev] appConfig.headers.csp['${directive}'] is not a CSP directive the framework merges (allowed: ${CSP_DIRECTIVES.join(', ')}).`
      );
    }
    if (!Array.isArray(sources)) {
      throw new Error(
        `[dndev] appConfig.headers.csp['${directive}'] must be an array of sources.`
      );
    }
    for (const source of sources) assertCspSource(directive, source);
  }
  const cache = config.cache ?? [];
  if (!Array.isArray(cache)) {
    throw new Error('[dndev] appConfig.headers.cache must be an array.');
  }
  for (const entry of cache) {
    if (typeof entry?.source !== 'string' || !entry.source.startsWith('/')) {
      throw new Error(
        `[dndev] appConfig.headers.cache: source must be a path starting with '/' (got ${JSON.stringify(entry?.source)}).`
      );
    }
    if (!Number.isInteger(entry.maxAge) || entry.maxAge < 0) {
      throw new Error(
        `[dndev] appConfig.headers.cache '${entry.source}': maxAge must be a whole number of seconds (got ${JSON.stringify(entry.maxAge)}).`
      );
    }
  }
  return { csp, cache };
}

/**
 * Build the Content-Security-Policy value: framework baseline + provider sources + app
 * sources, deduplicated, in canonical directive order. A directive that gains sources
 * drops its `'none'` (CSP forbids mixing them).
 *
 * @param {Object} [options]
 * @param {Record<string, readonly string[]>} [options.csp] - App sources per directive (`appConfig.headers.csp`)
 * @param {readonly string[]} [options.providers] - Provider packages the app depends on (keys of PROVIDER_CSP)
 * @param {'next' | 'next-export' | 'vite'} options.target - Who serves the build (sets the `script-src` baseline)
 * @returns {string}
 */
export function buildContentSecurityPolicy({ csp = {}, providers = [], target }) {
  if (!(target in SCRIPT_SRC_BASELINE)) {
    throw new Error(
      `[dndev] Unknown header target '${target}' (expected next, next-export or vite).`
    );
  }
  const directives = CSP_DIRECTIVES.map((directive) => {
    const sources = [
      ...(directive === 'script-src'
        ? SCRIPT_SRC_BASELINE[target]
        : (BASE_CSP[directive] ?? [])),
      ...providers.flatMap((pkg) => PROVIDER_CSP[pkg]?.[directive] ?? []),
      ...(csp[directive] ?? []),
    ];
    const unique = [...new Set(sources)];
    const effective =
      unique.length > 1 ? unique.filter((s) => s !== "'none'") : unique;
    return effective.length > 0 ? `${directive} ${effective.join(' ')}` : null;
  }).filter(Boolean);
  return [...directives, 'upgrade-insecure-requests'].join('; ');
}

/**
 * Resolve the app's header rules (`{ source, headers: [{ key, value }] }[]`, the format of
 * both Next `headers()` and vercel.json `headers`).
 *
 * Order: security headers on every path, hashed build assets (immutable, 1 year), public
 * images (1 day), JSON data (1 hour), PWA files, then the app's cache overrides (last wins).
 * HTML documents get no policy rule (Next sets their Cache-Control from `revalidate`; static
 * hosts serve them revalidated).
 *
 * @param {Object} options
 * @param {Object} options.appConfig - App config (`headers`, `seo`)
 * @param {'next' | 'next-export' | 'vite'} options.target - Who serves the build
 * @param {readonly string[]} [options.providers] - Provider packages the app depends on
 * @param {boolean} [options.pwa] - PWA enabled
 * @returns {Array<{ source: string, headers: Array<{ key: string, value: string }> }>}
 */
export function resolveHeaderRules({
  appConfig,
  target,
  providers = [],
  pwa = false,
}) {
  if (!(target in IMMUTABLE_BUILD_ASSETS)) {
    throw new Error(
      `[dndev] Unknown header target '${target}' (expected next, next-export or vite).`
    );
  }
  const { csp, cache } = readHeadersConfig(appConfig?.headers);

  const security = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({ csp, providers, target }),
    },
    ...(appConfig?.seo === false ? [NOINDEX_HEADER] : []),
    ...SECURITY_HEADERS,
  ].map((h) => ({ ...h }));

  return [
    { source: ALL_PATHS, headers: security },
    ...IMMUTABLE_BUILD_ASSETS[target].map((source) =>
      cacheRule(source, publicCache(ONE_YEAR, true))
    ),
    ...IMAGE_EXTENSIONS.map((ext) =>
      cacheRule(`/:path*.${ext}`, publicCache(ONE_DAY))
    ),
    {
      source: '/:path*.json',
      headers: [
        { key: 'Cache-Control', value: publicCache(ONE_HOUR) },
        { key: 'Content-Type', value: 'application/json; charset=utf-8' },
      ],
    },
    ...(pwa
      ? PWA_RULES.map((r) => ({
          source: r.source,
          headers: r.headers.map((h) => ({ ...h })),
        }))
      : []),
    ...cache.map((entry) =>
      cacheRule(entry.source, publicCache(entry.maxAge, entry.immutable === true))
    ),
  ];
}

/**
 * Provider packages (keys of PROVIDER_CSP) in the app's package.json dependencies.
 * @param {string} appRoot
 * @returns {string[]}
 */
export function detectHeaderProviders(appRoot) {
  const pkgPath = join(appRoot, 'package.json');
  if (!existsSync(pkgPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.keys(PROVIDER_CSP).filter((name) => Boolean(deps[name]));
}

/**
 * @param {string} appRoot
 * @returns {{ path: string, config: Record<string, unknown> } | null}
 */
function readVercelJson(appRoot) {
  const path = join(appRoot, 'vercel.json');
  if (!existsSync(path)) return null;
  try {
    return { path, config: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    throw new Error(`[dndev] ${path} is not valid JSON: ${error.message}`);
  }
}

/**
 * Write the header rules into the `headers` key of the app's vercel.json (other keys kept).
 * No vercel.json: the app is not hosted on Vercel, nothing to do.
 *
 * @param {Object} options
 * @param {string} options.appRoot
 * @param {ReturnType<typeof resolveHeaderRules>} options.rules
 * @param {boolean} options.ci - On CI the file is checked, never written
 * @param {{ info: Function }} [options.logger]
 * @returns {'absent' | 'unchanged' | 'written'}
 * @throws {Error} On CI when the committed `headers` differ from the policy
 */
export function syncVercelHeaders({ appRoot, rules, ci, logger }) {
  const file = readVercelJson(appRoot);
  if (!file) return 'absent';
  if (JSON.stringify(file.config.headers) === JSON.stringify(rules)) {
    return 'unchanged';
  }
  if (ci) {
    throw new Error(
      `[dndev] ${file.path}: "headers" differ from the framework header policy (appConfig.headers, appConfig.seo). The host reads the committed file, so this deploy would serve stale headers. Run the app locally (dev or build) to regenerate vercel.json, then commit it.`
    );
  }
  const content = `${JSON.stringify({ ...file.config, headers: rules }, null, 2)}\n`;
  writeFileSync(file.path, content);
  logger?.info(
    `vercel.json headers regenerated from the header policy (${rules.length} rules)`
  );
  return 'written';
}

/**
 * Next (server) serves the policy from `headers()`: a `headers` key in vercel.json would be
 * a second source for the same responses.
 *
 * @param {string} appRoot
 * @throws {Error} When the app's vercel.json has a `headers` key
 */
export function assertNoVercelHeaders(appRoot) {
  const file = readVercelJson(appRoot);
  if (file && 'headers' in file.config) {
    throw new Error(
      `[dndev] ${file.path} has "headers": Next serves the framework header policy from next.config headers(). Remove the "headers" key; declare app deltas (CSP sources, cache overrides) in appConfig.headers.`
    );
  }
}
