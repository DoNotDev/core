'use client';
// packages/core/i18n/src/utils/languageNavigation.ts

/**
 * @fileoverview How a language switch opens the other language's URL
 * @description With 2+ languages every language has its own URL (default language at
 * the root, others under their prefix). The language switchers live in core, which
 * cannot reach the app's router: the platform providers (@donotdev/ui
 * NextJsAppProviders / ViteAppProviders) provide a client-side navigation here.
 * Without a provider (a tree outside the framework providers) the switch is a document
 * navigation.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Opens `url` (the current page in `language`) without reloading the document.
 *
 * @param url - Path + query + hash of the page in the target language
 * @param language - Target language code
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export type LanguageNavigate = (url: string, language: string) => void;

/** Outside the framework providers: a document navigation. */
const documentNavigate: LanguageNavigate = (url) => {
  window.location.assign(url);
};

const LanguageNavigationContext =
  createContext<LanguageNavigate>(documentNavigate);

/**
 * Provides the router navigation the language switchers use (rendered by the
 * platform providers in @donotdev/ui; apps never render it).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function LanguageNavigationProvider({
  navigate,
  children,
}: {
  navigate: LanguageNavigate;
  children: ReactNode;
}) {
  return createElement(
    LanguageNavigationContext.Provider,
    { value: navigate },
    children
  );
}

/**
 * The navigation a language switch uses (router navigation under the framework
 * providers).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function useLanguageNavigate(): LanguageNavigate {
  return useContext(LanguageNavigationContext);
}
