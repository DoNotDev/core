// packages/core/utils/src/client/__tests__/captcha.test.ts

/**
 * @fileoverview Turnstile token source
 * @description Site key off: no script, no token. Site key on: the script loads once
 * (explicit render), the most recent form widget hands out single-use tokens and resets
 * after each, a call waits for a token not ready yet, a call without a form widget gets
 * a one-off widget, failures reject with `captcha_failed`. `window.turnstile` is faked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = { siteKey: undefined as string | undefined };

vi.mock('../appConfig', () => ({
  getPlatformEnvVar: (name: string) =>
    name === 'TURNSTILE_SITE_KEY' ? env.siteKey : undefined,
}));

type Options = {
  sitekey: string;
  theme: string;
  language: string;
  callback: (token: string) => void;
  'error-callback': (code: string) => boolean;
};

interface FakeWidget {
  container: HTMLElement;
  options: Options;
}

function fakeTurnstile() {
  const widgets = new Map<string, FakeWidget>();
  let next = 0;
  const api = {
    render: vi.fn((container: HTMLElement, options: Options) => {
      const id = `w${++next}`;
      widgets.set(id, { container, options });
      return id;
    }),
    reset: vi.fn(),
    remove: vi.fn((id: string) => widgets.delete(id)),
  };
  return { api, widgets, widget: (id: string) => widgets.get(id)! };
}

type CaptchaModule = typeof import('../captcha');

/** Fresh module state (script load, mounted widgets) per test. */
async function load(): Promise<CaptchaModule> {
  vi.resetModules();
  return import('../captcha');
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Scripts the module appends, kept out of the document (the test drives load / error). */
let scripts: HTMLScriptElement[] = [];
const win = window as unknown as { turnstile?: unknown; __dndevTurnstileOnload?: () => void };

beforeEach(() => {
  env.siteKey = undefined;
  delete win.turnstile;
  document.body.innerHTML = '';
  scripts = [];
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    scripts.push(node as HTMLScriptElement);
    return node;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('no site key (CAPTCHA off)', () => {
  it('no token and no script', async () => {
    const captcha = await load();
    await expect(captcha.getCaptchaToken()).resolves.toBeUndefined();
    expect(captcha.getCaptchaSiteKey()).toBeUndefined();
    expect(scripts).toHaveLength(0);
  });

  it('mounting a widget fails loud', async () => {
    const captcha = await load();
    expect(() =>
      captcha.mountCaptchaWidget(document.createElement('div'), { language: 'en' })
    ).toThrow(/TURNSTILE_SITE_KEY/);
  });
});

describe('site key set', () => {
  beforeEach(() => {
    env.siteKey = '1x00000000000000000000AA';
  });

  it('loads the explicit-render script once, on the first widget', async () => {
    const captcha = await load();
    const { api } = fakeTurnstile();
    captcha.mountCaptchaWidget(document.createElement('div'), { language: 'fr' });
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.getAttribute('src')).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__dndevTurnstileOnload'
    );
    win.turnstile = api;
    win.__dndevTurnstileOnload?.();
    await flush();
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(api.render.mock.calls[0][1]).toMatchObject({
      sitekey: '1x00000000000000000000AA',
      theme: 'auto',
      language: 'fr',
      size: 'flexible',
      appearance: 'interaction-only',
    });
    captcha.mountCaptchaWidget(document.createElement('div'), { language: 'fr' });
    await flush();
    expect(scripts).toHaveLength(1);
  });

  it('a ready token is handed out once, then the widget resets for the next', async () => {
    const captcha = await load();
    const fake = fakeTurnstile();
    win.turnstile = fake.api;
    captcha.mountCaptchaWidget(document.createElement('div'), { language: 'en' });
    await flush();
    fake.widget('w1').options.callback('token-1');
    await expect(captcha.getCaptchaToken()).resolves.toBe('token-1');
    expect(fake.api.reset).toHaveBeenCalledWith('w1');
    // No token until the widget answers again: the call waits for it.
    const second = captcha.getCaptchaToken();
    fake.widget('w1').options.callback('token-2');
    await expect(second).resolves.toBe('token-2');
    expect(fake.api.reset).toHaveBeenCalledTimes(2);
  });

  it('the most recently mounted widget gives the token; its removal moves a waiting call on', async () => {
    const captcha = await load();
    const fake = fakeTurnstile();
    win.turnstile = fake.api;
    captcha.mountCaptchaWidget(document.createElement('div'), { language: 'en' });
    const top = captcha.mountCaptchaWidget(document.createElement('div'), {
      language: 'en',
    });
    await flush();
    const pending = captcha.getCaptchaToken();
    top.remove();
    expect(fake.api.remove).toHaveBeenCalledWith('w2');
    await flush();
    fake.widget('w1').options.callback('from-first');
    await expect(pending).resolves.toBe('from-first');
  });

  it('no form widget: a one-off widget at the end of <body>, removed once it answered', async () => {
    const captcha = await load();
    const fake = fakeTurnstile();
    win.turnstile = fake.api;
    const pending = captcha.getCaptchaToken();
    await flush();
    const container = document.body.querySelector('[data-dndev-captcha]');
    expect(container).not.toBeNull();
    fake.widget('w1').options.callback('detached');
    await expect(pending).resolves.toBe('detached');
    expect(fake.api.remove).toHaveBeenCalledWith('w1');
    expect(document.body.querySelector('[data-dndev-captcha]')).toBeNull();
  });

  it('a widget error rejects the waiting call with captcha_failed', async () => {
    const captcha = await load();
    const fake = fakeTurnstile();
    win.turnstile = fake.api;
    captcha.mountCaptchaWidget(document.createElement('div'), { language: 'en' });
    await flush();
    const pending = captcha.getCaptchaToken();
    expect(fake.widget('w1').options['error-callback']('300010')).toBe(true);
    await expect(pending).rejects.toMatchObject({ code: 'captcha_failed' });
  });

  it('a blocked script rejects with captcha_failed; the next call loads it again', async () => {
    const captcha = await load();
    const pending = captcha.getCaptchaToken();
    expect(scripts).toHaveLength(1);
    scripts[0]!.onerror?.(new Event('error'));
    await expect(pending).rejects.toMatchObject({ code: 'captcha_failed' });
    await flush();
    void captcha.getCaptchaToken().catch(() => undefined);
    expect(scripts).toHaveLength(2);
  });

  it('no answer in time rejects with captcha_failed', async () => {
    vi.useFakeTimers();
    const captcha = await load();
    const fake = fakeTurnstile();
    win.turnstile = fake.api;
    captcha.mountCaptchaWidget(document.createElement('div'), { language: 'en' });
    await vi.advanceTimersByTimeAsync(0);
    const pending = captcha.getCaptchaToken();
    const outcome = expect(pending).rejects.toMatchObject({ code: 'captcha_failed' });
    await vi.advanceTimersByTimeAsync(captcha.CAPTCHA_TIMEOUT_MS);
    await outcome;
  });
});
