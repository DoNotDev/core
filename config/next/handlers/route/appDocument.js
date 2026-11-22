/**
 * @fileoverview Next route handler: App document, root and render-tree layouts, 404 pages
 * @description The app's HTML document (`src/app/AppDocument.tsx`) checks and the framework-owned root files: the root layout (`<html lang>`), the render-tree layouts (`(site)` cached, `dndev-session` per request) and the 404 pages. Methods of {@link NextRouteHandler} (mixed into its prototype by
 * `../RouteHandler.js`); `this` is the route handler.
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { nextFileName } from '../../nextFiles.js';
import { GENERATED_PATHS, NEXT_RENDER } from '../../../constants.js';

export const appDocumentMethods = {
  /**
   * Request-reading parts of the app's document (src/app/AppDocument.tsx): the
   * providers (`<ClientLayout>`), `next/headers`, an exported `dynamic`.
   *
   * @param {string} content - AppDocument source
   * @returns {string[]} What it does, empty for an HTML shell
   * @since 0.2.3
   */
  requestDocumentParts(content) {
    return [
      [/<ClientLayout\b/, 'renders <ClientLayout>'],
      [/from\s+['"]next\/headers['"]/, 'imports next/headers'],
      [/export\s+const\s+dynamic\b/, 'exports `dynamic`'],
    ]
      .filter(([pattern]) => pattern.test(content))
      .map(([, label]) => label);
  },

  /**
   * Fail the build unless the app's HTML document is `src/app/AppDocument.tsx` and the
   * framework owns the root layout and the 404 pages.
   *
   * - An app-owned root layout (`src/app/layout.next.tsx`, `src/app/[lang]/layout.next.tsx`)
   *   or root 404 (`not-found.next.tsx`, `global-not-found.next.tsx`): the generated
   *   root layout renders AppDocument with the page's language (`<html lang>`), which
   *   a root layout above the `[lang]` segment cannot know.
   * - AppDocument missing, or reading the request / rendering the providers: it is the
   *   HTML shell of every cached page; the generated tree layouts render ClientLayout
   *   (cached pages for guests, per request for an auth cookie).
   *
   * @returns {Promise<void>}
   * @throws {Error} With the files to move or delete and the shape AppDocument takes
   * @since 0.2.3
   */
  async assertAppDocument() {
    const documentPath = GENERATED_PATHS.next.appDocument;
    const documentShape =
      `${documentPath} exports \`metadata\` (site-level: metadataBase) and ` +
      '`AppDocument({ lang, children })`, which renders <html lang={lang}>, the <head> ' +
      'links (<FontPreloadLinks />; the framework renders the favicon tags), imports the ' +
      'global CSS and puts {children} in <body> (see the @donotdev/cli app-next template)';
    const appOwned = [];
    for (const rel of this.frameworkRootFiles()) {
      const fullPath = this.pathResolver.resolveAppPath(rel);
      if (
        this.pathResolver.pathExists(fullPath) &&
        !(await this.hasGenerationMarker(fullPath))
      ) {
        appOwned.push(rel);
      }
    }
    if (appOwned.length > 0) {
      throw new Error(
        `[dndev] ${appOwned.join(', ')}: the framework generates the root layout and the ` +
          "404 pages, so every page's HTML carries its language (<html lang>). Move the " +
          `HTML shell into ${documentPath}: ${documentShape}. Then delete ${appOwned.join(', ')}.`
      );
    }

    const fullPath = this.pathResolver.resolveAppPath(documentPath);
    if (!this.pathResolver.pathExists(fullPath)) {
      throw new Error(`[dndev] ${documentPath} is missing: ${documentShape}.`);
    }
    const parts = this.requestDocumentParts(
      await this.pathResolver.read(fullPath, { format: 'text' })
    );
    if (parts.length === 0) return;
    throw new Error(
      `[dndev] ${documentPath} ${parts.join(', ')}. It must be the HTML shell: ` +
        'render {children} in <body>, drop the ClientLayout / headers() wrapper and ' +
        '`export const dynamic`. The generated layouts render ClientLayout: cached pages ' +
        'for guests, per-request pages for visitors with an auth cookie.'
    );
  },

  /**
   * Root files the framework generates (root layouts, 404 pages), in both language
   * modes: an app-owned one is refused (assertAppDocument), a generated one of the
   * other mode is removed by cleanGeneratedPageFiles.
   *
   * @returns {string[]} Paths relative to the app root
   * @since 0.2.3
   */
  frameworkRootFiles() {
    const layout = nextFileName('layout', 'tsx');
    const notFound = nextFileName('not-found', 'tsx');
    return [
      GENERATED_PATHS.next.appLayout,
      `src/app/[lang]/${layout}`,
      `src/app/${notFound}`,
      `src/app/[lang]/${notFound}`,
      `src/app/${nextFileName('global-not-found', 'tsx')}`,
    ];
  },

  /**
   * Layout of a render tree: `src/app/(site)/layout.next.tsx` or
   * `src/app/dndev-session/layout.next.tsx` (under `src/app/[lang]` with 2+ languages).
   * The per-request one is removed when the app has no cookie session.
   *
   * @param {'site'|'session'} tree
   * @returns {Promise<void>}
   * @since 0.2.3
   */
  async generateTreeLayout(tree) {
    const layoutPath = `src/app${this.treeDir(tree)}/${nextFileName('layout', 'tsx')}`;
    const fullPath = this.pathResolver.resolveAppPath(layoutPath);
    if (
      this.pathResolver.pathExists(fullPath) &&
      !(await this.hasGenerationMarker(fullPath))
    ) {
      this.logger.debug(`Skipping ${layoutPath} - user-created file detected`);
      return;
    }
    this.writeGeneratedFile(
      layoutPath,
      tree === 'session'
        ? this.generateSessionLayoutContent()
        : this.generateSiteLayoutContent(),
      `${tree} layout`
    );
  },

  /**
   * Content of `src/app/(site)/layout.next.tsx` (`src/app/[lang]/(site)` with 2+
   * languages): the app's ClientLayout without request
   * data. Signed-out snapshot (`serverCookies=""`: a cookie-session provider reads it
   * as signed out, the others as unknown), language from the URL only. No Suspense
   * boundary around the page: React outlines a large completed boundary out of the
   * layout and reveals it 300 ms after the first paint (empty main, footer moved).
   * A page reading the query string (useSearchParams / useLocation().search) wraps that
   * read in its own Suspense; Next fails the build otherwise.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateSiteLayoutContent() {
    return `// Generated by @donotdev/config - DO NOT EDIT
// Cached pages: rendered without request data (no cookies, no headers), served from the
// cache and ${this.revalidateLabel()} (appConfig.revalidate). One entry per URL (page and language).

import type { ReactNode } from 'react';

import { ClientLayout } from '${this.appImport(this.treeDir('site'), 'ClientLayout')}';

export const revalidate = ${this.revalidate()};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <ClientLayout serverCookies="" acceptLanguage={null}>
      {children}
    </ClientLayout>
  );
}
`;
  },

  /**
   * Content of `src/app/dndev-session/layout.next.tsx` (`src/app/[lang]/dndev-session`
   * with 2+ languages): the app's ClientLayout with the
   * request's Cookie and Accept-Language headers (signed-in state on the first paint,
   * the visitor's data). Reading the headers renders these pages per request.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateSessionLayoutContent() {
    return `// Generated by @donotdev/config - DO NOT EDIT
// Per-request pages for visitors with an auth cookie (the proxy rewrites them here; a
// direct hit is a 404): the providers read the request cookies, so the server render
// shows the visitor's signed-in state and data. Never cached.

import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { ClientLayout } from '${this.appImport(this.treeDir('session'), 'ClientLayout')}';

export default async function SessionLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  return (
    <ClientLayout
      serverCookies={requestHeaders.get('cookie') ?? ''}
      acceptLanguage={requestHeaders.get('accept-language')}
    >
      {children}
    </ClientLayout>
  );
}
`;
  },

  /**
   * The root layout: `src/app/layout.next.tsx` with one language,
   * `src/app/[lang]/layout.next.tsx` with 2+ (the generated one of the other mode is
   * removed by cleanGeneratedPageFiles). It renders the app's AppDocument with the
   * page's language, so every page's HTML carries its `<html lang>`, cached pages
   * included. Both render trees are its children: moving between them (sign-in,
   * sign-out) and between languages is a client-side navigation.
   *
   * @returns {void}
   * @since 0.2.3
   */
  generateRootLayout() {
    this.writeGeneratedFile(
      `src/app${this.rootDir()}/${nextFileName('layout', 'tsx')}`,
      this.generateRootLayoutContent(),
      'root layout'
    );
  },

  /**
   * Content of the root layout. 2+ languages: lists the languages
   * (generateStaticParams, every language URL is prerendered) and 404s any other
   * first segment. One language: the default language.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateRootLayoutContent() {
    const documentImport = this.appImport(this.rootDir(), 'AppDocument');
    if (!this.isMultilingual()) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// Root layout: the app's AppDocument (src/app/AppDocument.tsx) in the app's language.

import type { ReactNode } from 'react';

import { AppDocument } from '${documentImport}';

export { metadata } from '${documentImport}';

export default function RootLayout({ children }: { children: ReactNode }) {
  return <AppDocument lang=${JSON.stringify(this.options.defaultLanguage)}>{children}</AppDocument>;
}
`;
    }
    return `// Generated by @donotdev/config - DO NOT EDIT
// Root layout: the app's AppDocument (src/app/AppDocument.tsx) in the URL's language.
// One URL per language: the default language (${this.options.defaultLanguage}) at the root, served here by
// the proxy's rewrite; the others under their prefix. Any other first segment is a 404.

import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppDocument } from '${documentImport}';

export { metadata } from '${documentImport}';

const LANGUAGES: readonly string[] = ${JSON.stringify(this.options.languages)};

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LANGUAGES.includes(lang)) notFound();
  return <AppDocument lang={lang}>{children}</AppDocument>;
}
`;
  },

  /**
   * The 404 pages, rendered with the app's providers (ClientLayout) and the
   * framework's NotFoundPage, without request data, inside NotFoundDocument (the
   * static one is served for every unknown URL: no URL-derived output):
   *
   * - `not-found.next.tsx` next to the root layout: a page calling notFound().
   * - `src/app/global-not-found.next.tsx` (Next `experimental.globalNotFound`, set by
   *   the framework's Next config, which then serves every unknown URL from it): its
   *   own document, in the app's language with one language (static), in the URL's
   *   language with 2+ (the proxy's NEXT_RENDER.languageHeader, rendered per request),
   *   since no root layout sits above `[lang]`.
   *
   * @returns {void}
   * @since 0.2.3
   */
  generateNotFoundPages() {
    this.writeGeneratedFile(
      `src/app${this.rootDir()}/${nextFileName('not-found', 'tsx')}`,
      this.generateNotFoundContent(),
      '404 page'
    );
    this.writeGeneratedFile(
      `src/app/${nextFileName('global-not-found', 'tsx')}`,
      this.generateGlobalNotFoundContent(),
      'global 404 page'
    );
  },

  /**
   * Content of `not-found.next.tsx` (next to the root layout).
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateNotFoundContent() {
    return `// Generated by @donotdev/config - DO NOT EDIT
// 404 page: the app's providers without request data (static, like every cached page).
// Shared fallback content must not expose the pathname captured during prerendering:
// NotFoundDocument drops URL-derived output (canonical, JSON-LD, breadcrumbs).
// The Suspense boundary keeps a query-string read (useSearchParams) to the 404 content.

import { Suspense } from 'react';

import { NotFoundDocument, NotFoundPage } from '@donotdev/ui';

import { ClientLayout } from '${this.appImport(this.rootDir(), 'ClientLayout')}';

export default function NotFound() {
  return (
    <NotFoundDocument>
      <ClientLayout serverCookies="" acceptLanguage={null}>
        <Suspense fallback={null}>
          <NotFoundPage showRequestedPath={false} />
        </Suspense>
      </ClientLayout>
    </NotFoundDocument>
  );
}
`;
  },

  /**
   * Content of `src/app/global-not-found.next.tsx`.
   *
   * @returns {string}
   * @since 0.2.3
   */
  generateGlobalNotFoundContent() {
    const content = `
    <AppDocument lang={lang}>
      <NotFoundDocument>
        <ClientLayout serverCookies="" acceptLanguage={null}>
          <Suspense fallback={null}>
            <NotFoundPage showRequestedPath={false} />
          </Suspense>
        </ClientLayout>
      </NotFoundDocument>
    </AppDocument>`;
    if (!this.isMultilingual()) {
      return `// Generated by @donotdev/config - DO NOT EDIT
// 404 of an unknown URL: the app's AppDocument in the app's language (static).

import { Suspense } from 'react';

import { NotFoundDocument, NotFoundPage } from '@donotdev/ui';

import { AppDocument } from './AppDocument';
import { ClientLayout } from './ClientLayout';

export { metadata } from './AppDocument';

const lang = ${JSON.stringify(this.options.defaultLanguage)};

export default function GlobalNotFound() {
  return (${content}
  );
}
`;
    }
    return `// Generated by @donotdev/config - DO NOT EDIT
// 404 of an unknown URL (no root layout above [lang]): the app's AppDocument in the URL's
// language, which the proxy sets on the request (${NEXT_RENDER.languageHeader}); a request the proxy
// does not see (API route, file) gets the default language (${this.options.defaultLanguage}).

import { headers } from 'next/headers';
import { Suspense } from 'react';

import { NotFoundDocument, NotFoundPage } from '@donotdev/ui';

import { AppDocument } from './AppDocument';
import { ClientLayout } from './ClientLayout';

export { metadata } from './AppDocument';

const LANGUAGES: readonly string[] = ${JSON.stringify(this.options.languages)};

export default async function GlobalNotFound() {
  const requested = (await headers()).get(${JSON.stringify(NEXT_RENDER.languageHeader)});
  const lang =
    requested && LANGUAGES.includes(requested) ? requested : ${JSON.stringify(this.options.defaultLanguage)};
  return (${content}
  );
}
`;
  },
};
