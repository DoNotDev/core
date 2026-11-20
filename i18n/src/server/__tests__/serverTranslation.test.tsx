// packages/core/i18n/src/server/__tests__/serverTranslation.test.tsx

import { render, screen } from '@testing-library/react';
import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Shape of the generated dndev-config-i18n.js (inline content, Next). */
const I18N_CONFIG = {
  mapping: {},
  languages: ['en', 'fr'],
  eager: ['dndev'],
  fallback: 'en',
  content: {
    dndev: {
      en: { actions: { save: 'Save' } },
      fr: { actions: { save: 'Enregistrer' } },
    },
    demo: {
      en: {
        title: 'Catalogue',
        greeting: 'Hello {{name}}',
        onlyEnglish: 'English only',
        nested: { deep: 'Deep en' },
      },
      fr: {
        title: 'Catalogue FR',
        greeting: 'Bonjour {{name}}',
        nested: { deep: 'Profond' },
      },
    },
  },
  storage: {
    type: 'localStorage',
    prefix: 'dndev_i18n_',
    ttl: 0,
    encryption: false,
    maxSize: 0,
  },
  performance: { cacheSize: 100, errorCacheTTL: 30000 },
  manifest: {
    totalFiles: 4,
    totalNamespaces: 2,
    totalLanguages: 2,
    eagerNamespaces: 1,
    generatedAt: '',
  },
  debug: false,
};

type T = (key: string, a?: unknown, b?: unknown) => string;

/** The calls compared between the client hook and the server translation. */
const calls = (t: T, tDefault: T) => [
  t('title'),
  t('nested.deep'),
  t('greeting', { name: 'Ada' }),
  t('onlyEnglish'),
  t('missing.key'),
  t('missing.key', 'Fallback text'),
  t('missing.key', 'Hi {{name}}', { name: 'Bo' }),
  t('missing.key', { defaultValue: 'From options' }),
  tDefault('actions.save'),
];

const previousConfig = globalThis._DNDEV_CONFIG_;

beforeAll(() => {
  globalThis._DNDEV_CONFIG_ = {
    ...(previousConfig ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- why: test fixture of the generated config shape
    i18n: I18N_CONFIG as any,
  } as typeof globalThis._DNDEV_CONFIG_;
});

afterAll(() => {
  globalThis._DNDEV_CONFIG_ = previousConfig;
});

describe('server useTranslation (@donotdev/core/rsc)', () => {
  it('returns the same strings as the client hook (server render pass)', async () => {
    const client = await import('../../hooks/useTranslation');
    const server = await import('../serverTranslation');

    for (const language of ['en', 'fr']) {
      function Probe() {
        const { t } = client.useTranslation('demo');
        const { t: tDefault } = client.useTranslation();
        return createElement('pre', null, JSON.stringify(calls(t as T, tDefault as T)));
      }
      const html = renderToString(
        createElement(client.RequestLanguageProvider, { language }, createElement(Probe))
      );
      const clientStrings = JSON.parse(
        html.replace(/^<pre>/, '').replace(/<\/pre>$/, '').replace(/&quot;/g, '"')
      );

      const s = server.useTranslation('demo', { language });
      const sDefault = server.useTranslation(undefined, { language });
      expect(calls(s.t as T, sDefault.t as T)).toEqual(clientStrings);
      expect(s.language).toBe(language);
      expect(s.ready).toBe(true);
      expect(s.i18n).toBeNull();
    }
  });

  it('returns the same strings as the mounted client hook', async () => {
    const client = await import('../../hooks/useTranslation');
    const { getI18nInstance } = await import('../../instance.vite');
    const server = await import('../serverTranslation');

    await act(async () => {
      await getI18nInstance().changeLanguage('fr');
    });
    function Probe() {
      const { t } = client.useTranslation('demo');
      const { t: tDefault } = client.useTranslation();
      return createElement('pre', { 'data-testid': 'out' }, JSON.stringify(calls(t as T, tDefault as T)));
    }
    render(createElement(Probe));
    const clientStrings = JSON.parse(screen.getByTestId('out').textContent ?? '');

    const s = server.useTranslation('demo', { language: 'fr' });
    const sDefault = server.useTranslation(undefined, { language: 'fr' });
    expect(calls(s.t as T, sDefault.t as T)).toEqual(clientStrings);
    expect(clientStrings[0]).toBe('Catalogue FR');
  });

  it('uses its own instance: the shared client instance keeps its language', async () => {
    const { getI18nInstance } = await import('../../instance.vite');
    const server = await import('../serverTranslation');
    const shared = getI18nInstance();
    const before = shared.language;

    expect(server.useTranslation('demo', { language: 'en' }).t('title')).toBe('Catalogue');
    expect(shared.language).toBe(before);
    expect(globalThis.__DNDEV_I18N_INSTANCE__ ?? shared).toBe(shared);
  });

  it('fails loud without a language, with an unknown language, or without config', async () => {
    const server = await import('../serverTranslation');

    // Outside a server request React.cache has no scope: the setter does not persist
    server.setRequestLanguage('fr');
    expect(() => server.useTranslation('demo')).toThrow(/no language/);
    expect(() => server.useTranslation('demo', { language: 'de' })).toThrow(
      /"de" is not a configured language/
    );
    expect(() => server.setRequestLanguage('de')).toThrow(/not a configured language/);

    const config = globalThis._DNDEV_CONFIG_;
    globalThis._DNDEV_CONFIG_ = undefined;
    try {
      expect(() => server.useTranslation('demo', { language: 'en' })).toThrow(
        /no i18n config is loaded/
      );
    } finally {
      globalThis._DNDEV_CONFIG_ = config;
    }
  });
});
