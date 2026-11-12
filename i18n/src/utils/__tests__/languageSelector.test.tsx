import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  routing: { languages: ['fr', 'en'], defaultLanguage: 'fr' },
  setLanguage: vi.fn(async () => {}),
}));

vi.mock('@donotdev/components', () => ({ isRTLLanguage: () => false }));
vi.mock('@donotdev/stores', () => {
  const state = {
    isReady: true,
    currentLanguage: 'fr',
    availableLanguages: [],
    isLoading: false,
    setLanguage: env.setLanguage,
  };
  const useLanguageStore = (select: (s: typeof state) => unknown) =>
    select(state);
  useLanguageStore.getState = () => state;
  return { useLanguageStore };
});
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, ready: true }),
}));
vi.mock('../../instance.vite', () => ({ getI18nInstance: vi.fn() }));
vi.mock('../languages', () => ({ getSupportedLanguages: () => [] }));
vi.mock('../initialLanguage', () => ({
  getLanguageRouting: () => env.routing,
}));

import { LanguageNavigationProvider } from '../languageNavigation';
import { useLanguageSelector } from '../languageSelector';

const navigate = vi.fn();
const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageNavigationProvider navigate={navigate}>
    {children}
  </LanguageNavigationProvider>
);

beforeEach(() => {
  navigate.mockReset();
  env.setLanguage.mockClear();
  env.routing = { languages: ['fr', 'en'], defaultLanguage: 'fr' };
  document.cookie = 'dndev-lang=; max-age=0; path=/';
  window.history.replaceState(null, '', '/');
});

describe('useLanguageSelector().changeLanguage', () => {
  it('2+ languages: navigates client-side to the page in the other language', async () => {
    window.history.replaceState(null, '', '/produits/serum?page=2');
    const { result } = renderHook(() => useLanguageSelector(), { wrapper });

    await act(() => result.current.changeLanguage('en'));

    expect(navigate).toHaveBeenCalledWith('/en/produits/serum?page=2', 'en');
    expect(document.cookie).toContain('dndev-lang=en');
    expect(env.setLanguage).not.toHaveBeenCalled();
  });

  it('back to the default language: the unprefixed URL', async () => {
    window.history.replaceState(null, '', '/en/produits');
    const { result } = renderHook(() => useLanguageSelector(), { wrapper });

    await act(() => result.current.changeLanguage('fr'));

    expect(navigate).toHaveBeenCalledWith('/produits', 'fr');
  });

  it('one language: changes in place, no navigation', async () => {
    env.routing = { languages: ['fr'], defaultLanguage: 'fr' };
    const { result } = renderHook(() => useLanguageSelector(), { wrapper });

    await act(() => result.current.changeLanguage('fr'));

    expect(navigate).not.toHaveBeenCalled();
    expect(env.setLanguage).toHaveBeenCalledWith('fr');
  });
});
