/**
 * @fileoverview Header policy tests
 * @description Framework header policy + app deltas → exact header rules per target, CSP
 * string per app, vercel.json generation (Vite host config), Next headers() merge.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertNoVercelHeaders,
  buildContentSecurityPolicy,
  detectHeaderProviders,
  resolveHeaderRules,
  syncVercelHeaders,
} from '../headerPolicy.js';
import { createHeadersConfig } from '../next/configBuilder.js';

const SUPABASE = ['@donotdev/supabase'];
const REGISTRY = 'https://recherche-entreprises.api.gouv.fr';

/** Admin-style back office: private (seo: false), Supabase, Vite on Vercel. */
const ADMIN_APP = { seo: false } as const;
/** Shop-style public site: registry search from the browser, year-long /images cache. */
const SHOP_APP = {
  seo: { aiCrawlers: 'allow-all' },
  headers: {
    csp: { 'connect-src': [REGISTRY] },
    cache: [{ source: '/images/:path*', maxAge: 31536000 }],
  },
} as const;

const SECURITY = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
];
const cache = (source: string, value: string) => ({
  source,
  headers: [{ key: 'Cache-Control', value }],
});
const IMAGES = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'ico'].map((ext) =>
  cache(`/:path*.${ext}`, 'public, max-age=86400')
);
const JSON_RULE = {
  source: '/:path*.json',
  headers: [
    { key: 'Cache-Control', value: 'public, max-age=3600' },
    { key: 'Content-Type', value: 'application/json; charset=utf-8' },
  ],
};
const VITE_ASSETS = ['woff', 'woff2', 'ttf', 'eot', 'js', 'css'].map((ext) =>
  cache(`/assets/:path*.${ext}`, 'public, max-age=31536000, immutable')
);

const SUPABASE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
const SHOP_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://recherche-entreprises.api.gouv.fr; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

describe('buildContentSecurityPolicy', () => {
  it('baseline + Supabase provider (admin CSP)', () => {
    expect(
      buildContentSecurityPolicy({ providers: SUPABASE, target: 'vite' })
    ).toBe(SUPABASE_CSP);
  });

  it('app connect-src source appended after the provider (shop CSP)', () => {
    expect(
      buildContentSecurityPolicy({
        providers: SUPABASE,
        csp: SHOP_APP.headers.csp,
        target: 'next',
      })
    ).toBe(SHOP_CSP);
  });

  it("Vite script-src is 'self' only; Next and Next export add 'unsafe-inline'", () => {
    const script = (target: 'vite' | 'next' | 'next-export') =>
      buildContentSecurityPolicy({ target })
        .split('; ')
        .find((d) => d.startsWith('script-src'));
    expect(script('vite')).toBe("script-src 'self'");
    expect(script('next')).toBe("script-src 'self' 'unsafe-inline'");
    expect(script('next-export')).toBe("script-src 'self' 'unsafe-inline'");
  });

  it('accepts hash and keyword extras on script-src (Vite inline script)', () => {
    const hash = "'sha256-abc123+/_-xyz='";
    expect(
      buildContentSecurityPolicy({
        target: 'vite',
        providers: ['@donotdev/firebase'],
        csp: { 'script-src': [hash] },
      })
    ).toContain(
      `script-src 'self' https://accounts.google.com https://apis.google.com ${hash};`
    );
    expect(
      buildContentSecurityPolicy({
        target: 'vite',
        csp: { 'script-src': ["'unsafe-inline'"] },
      })
    ).toContain("script-src 'self' 'unsafe-inline';");
  });

  it("drops 'none' when a directive gains sources, dedupes, keeps canonical order", () => {
    const csp = buildContentSecurityPolicy({
      providers: ['@donotdev/firebase'],
      target: 'next',
      csp: {
        'frame-src': ['https://accounts.google.com'],
        'worker-src': ["'self'", 'blob:'],
      },
    });
    expect(csp).toContain('frame-src https://accounts.google.com;');
    expect(csp).not.toContain("frame-src 'none'");
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com;"
    );
    expect(csp.indexOf('worker-src')).toBeGreaterThan(
      csp.indexOf('connect-src')
    );
    expect(csp.indexOf('worker-src')).toBeLessThan(csp.indexOf('frame-src'));
    expect(csp.endsWith('; upgrade-insecure-requests')).toBe(true);
  });
});

describe('resolveHeaderRules', () => {
  it('admin (Vite, seo: false) = the current admin vercel.json headers', () => {
    expect(
      resolveHeaderRules({
        appConfig: ADMIN_APP,
        target: 'vite',
        providers: SUPABASE,
      })
    ).toEqual([
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: SUPABASE_CSP },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
          },
          ...SECURITY,
        ],
      },
      ...VITE_ASSETS,
      ...IMAGES,
      JSON_RULE,
    ]);
  });

  it('shop (Next server): no build-asset rule (Next owns /_next/static), app override last', () => {
    expect(
      resolveHeaderRules({
        appConfig: SHOP_APP,
        target: 'next',
        providers: SUPABASE,
      })
    ).toEqual([
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: SHOP_CSP }, ...SECURITY],
      },
      ...IMAGES,
      JSON_RULE,
      cache('/images/:path*', 'public, max-age=31536000'),
    ]);
  });

  it('Next static export caches /_next/static itself (host serves it)', () => {
    const rules = resolveHeaderRules({ appConfig: {}, target: 'next-export' });
    expect(rules[1]).toEqual(
      cache('/_next/static/:path*', 'public, max-age=31536000, immutable')
    );
  });

  it('PWA adds manifest + service worker rules before the app overrides', () => {
    const rules = resolveHeaderRules({
      appConfig: SHOP_APP,
      target: 'next',
      pwa: true,
    });
    expect(rules.map((r) => r.source).slice(-3)).toEqual([
      '/manifest.json',
      '/sw.js',
      '/images/:path*',
    ]);
  });

  it('immutable override', () => {
    const rules = resolveHeaderRules({
      appConfig: { headers: { cache: [{ source: '/v/:path*', maxAge: 60, immutable: true }] } },
      target: 'vite',
    });
    expect(rules.at(-1)).toEqual(
      cache('/v/:path*', 'public, max-age=60, immutable')
    );
  });

  it.each([
    [{ headers: { nope: 1 } }, 'appConfig.headers.nope'],
    [{ headers: { csp: { 'script-src-elem': ['x'] } } }, "csp['script-src-elem']"],
    [{ headers: { csp: { 'connect-src': ['a b'] } } }, 'invalid source'],
    [{ headers: { csp: { 'connect-src': ["x; script-src *"] } } }, 'invalid source'],
    [{ headers: { csp: { 'script-src': ["'sha256-'"] } } }, 'invalid quoted source'],
    [{ headers: { csp: { 'script-src': ["'sha1-abc='"] } } }, 'invalid quoted source'],
    [{ headers: { csp: { 'script-src': ["'sha256-ab!c'"] } } }, 'invalid quoted source'],
    [{ headers: { csp: { 'script-src': ["'nonsense'"] } } }, 'invalid quoted source'],
    [{ headers: { cache: [{ source: 'images', maxAge: 1 }] } }, "starting with '/'"],
    [{ headers: { cache: [{ source: '/i', maxAge: 1.5 }] } }, 'whole number'],
  ])('fails loud on invalid appConfig.headers %#', (appConfig, message) => {
    expect(() => resolveHeaderRules({ appConfig, target: 'vite' })).toThrow(
      message
    );
  });

  it('fails loud on an unknown target', () => {
    expect(() =>
      resolveHeaderRules({ appConfig: {}, target: 'firebase' as never })
    ).toThrow("Unknown header target 'firebase'");
  });
});

describe('host config (vercel.json)', () => {
  let dir: string;
  const vercelJson = () => join(dir, 'vercel.json');
  const rules = resolveHeaderRules({
    appConfig: ADMIN_APP,
    target: 'vite',
    providers: SUPABASE,
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dndev-headers-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('no vercel.json: nothing written', () => {
    expect(syncVercelHeaders({ appRoot: dir, rules, ci: false })).toBe('absent');
  });

  it('writes the headers key, keeps the other keys in place', () => {
    writeFileSync(
      vercelJson(),
      JSON.stringify({
        buildCommand: 'bun run build',
        headers: [{ source: '/old', headers: [] }],
        rewrites: [{ source: '/(.*)', destination: '/index.html' }],
      })
    );
    expect(syncVercelHeaders({ appRoot: dir, rules, ci: false })).toBe('written');
    const raw = readFileSync(vercelJson(), 'utf8');
    expect(raw.endsWith('}\n')).toBe(true);
    const json = JSON.parse(raw);
    expect(Object.keys(json)).toEqual(['buildCommand', 'headers', 'rewrites']);
    expect(json.headers).toEqual(rules);
    expect(syncVercelHeaders({ appRoot: dir, rules, ci: true })).toBe('unchanged');
  });

  it('CI with a stale file fails loud and does not write', () => {
    const stale = JSON.stringify({ outputDirectory: 'dist' });
    writeFileSync(vercelJson(), stale);
    expect(() => syncVercelHeaders({ appRoot: dir, rules, ci: true })).toThrow(
      'differ from the framework header policy'
    );
    expect(readFileSync(vercelJson(), 'utf8')).toBe(stale);
  });

  it('Next (server): vercel.json headers are a second source → fail loud', () => {
    writeFileSync(vercelJson(), JSON.stringify({ installCommand: 'bun install' }));
    expect(() => assertNoVercelHeaders(dir)).not.toThrow();
    writeFileSync(vercelJson(), JSON.stringify({ headers: [] }));
    expect(() => assertNoVercelHeaders(dir)).toThrow('Remove the "headers" key');
  });

  it('detects provider packages from the app package.json', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        dependencies: { '@donotdev/supabase': '^0.3.0', '@donotdev/billing': '^0.3.0' },
      })
    );
    expect(detectHeaderProviders(dir)).toEqual(['@donotdev/supabase']);
  });
});

describe('Next headers() merge', () => {
  const policyRules = [cache('/:path*.png', 'public, max-age=86400')];

  it('policy rules first, then the app next.config headers (last wins)', async () => {
    const app = [cache('/images/:path*', 'public, max-age=31536000')];
    const headers = createHeadersConfig({
      policyRules,
      originalHeaders: async () => app,
    });
    expect(await headers()).toEqual([...policyRules, ...app]);
  });

  it('no app headers: policy only', async () => {
    expect(await createHeadersConfig({ policyRules })()).toEqual(policyRules);
  });

  it('fails loud on a non-function or non-array app headers', async () => {
    expect(() =>
      createHeadersConfig({ policyRules, originalHeaders: [] as never })
    ).toThrow('must be a function');
    await expect(
      createHeadersConfig({
        policyRules,
        originalHeaders: async () => ({}) as never,
      })()
    ).rejects.toThrow('must return an array');
  });
});
