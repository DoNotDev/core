'use client';
// packages/core/utils/src/client/captcha.ts

/**
 * @fileoverview Turnstile CAPTCHA tokens for auth providers
 * @description With CAPTCHA protection on (Supabase Auth, provider Turnstile), the auth
 * server refuses sign-up, password sign-in, email OTP / magic link, resend and
 * password-reset requests that carry no valid token. The framework owns the token: the
 * app sets the public env var `TURNSTILE_SITE_KEY` (`VITE_TURNSTILE_SITE_KEY` /
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY`); no site key = no script, no widget, no token.
 *
 * - **Widgets.** The framework auth forms mount a Turnstile widget just above their
 *   submit button ({@link mountCaptchaWidget}, from `@donotdev/auth`). It renders when
 *   the form mounts (theme `auto`, the app's language, `interaction-only`: a Managed
 *   widget shows itself only when Cloudflare asks the visitor to interact; an Invisible
 *   widget never shows), so a token is usually ready by the time the user submits.
 *   Cloudflare refreshes an expired token itself.
 * - **Tokens.** A provider calls {@link getCaptchaToken} right before each gated call. The
 *   most recently mounted widget hands over its token (single-use, 300 s) and resets to
 *   produce the next one; no token yet = the call waits for it (the visitor may have to
 *   tick the checkbox). A call made while no widget is mounted (a toast action, a direct
 *   `useAuth` call) gets a one-off widget rendered at the bottom of `<body>`, removed once
 *   it answered.
 * - **Script.** `api.js?render=explicit` loads from Cloudflare (never proxied or cached)
 *   on the first widget, never at page load. CSP: the framework header policy adds
 *   `https://challenges.cloudflare.com` to `script-src` and `frame-src` only when the
 *   build's env sets the site key (`captchaSiteKeySet`, core config `headerPolicy.js`).
 * - **Failure.** Script blocked, widget error, unsupported browser or no token within
 *   {@link CAPTCHA_TIMEOUT_MS}: the call rejects with an error coded
 *   {@link CAPTCHA_FAILED_CODE}, GoTrue's code for a refused token, so one rule turns
 *   both into the same inline message.
 *
 * Browser only (Vite and Next web apps).
 *
 * @version 0.1.0
 * @since 0.3.4
 * @author AMBROISE PARK Consulting
 */

import { getPlatformEnvVar } from './appConfig';

/** Public env var of the Turnstile site key (platform prefix added by `getPlatformEnvVar`). */
export const TURNSTILE_SITE_KEY_ENV = 'TURNSTILE_SITE_KEY';

/** Cloudflare's script, loaded from this exact URL. */
export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js';

/** Code of a CAPTCHA failure: GoTrue's code for a refused token. */
export const CAPTCHA_FAILED_CODE = 'captcha_failed';

/** Longest wait for a token before the call fails (covers a visitor ticking the box). */
export const CAPTCHA_TIMEOUT_MS = 60_000;

/** Global function the script calls once loaded (`onload` query parameter). */
const ONLOAD_CALLBACK = '__dndevTurnstileOnload';

/** Render options used here (Turnstile client-side rendering API). */
interface TurnstileRenderOptions {
  sitekey: string;
  theme: 'auto';
  language: string;
  size: 'flexible';
  appearance: 'interaction-only';
  'refresh-expired': 'auto';
  'response-field': false;
  callback: (token: string) => void;
  'expired-callback': () => void;
  /** Returns `true`: the error is handled here (Turnstile does not log it as unhandled) */
  'error-callback': (code: string) => boolean;
  'timeout-callback': () => void;
  'unsupported-callback': () => void;
}

/** The part of `window.turnstile` used here. */
interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
  [ONLOAD_CALLBACK]?: () => void;
};

/** A mounted Turnstile widget that hands out its tokens. */
export interface CaptchaWidget {
  /** The next single-use token (waits for the widget when none is ready) */
  take: () => Promise<string>;
  /** Remove the widget (pending `take` calls move to the next widget) */
  remove: () => void;
}

/** Options of {@link mountCaptchaWidget}. */
export interface CaptchaWidgetOptions {
  /** Widget language: the app's language (ISO 639-1 or language-region; `auto` = browser) */
  language: string;
}

/**
 * An error coded `captcha_failed`.
 *
 * @param reason - What failed (kept in the message, for logs)
 * @returns The error
 */
export function captchaError(reason: string): Error {
  return Object.assign(new Error(`captcha verification failed: ${reason}`), {
    code: CAPTCHA_FAILED_CODE,
  });
}

/** Rejection of a `take` whose widget was removed: the call moves to the next widget. */
class WidgetRemoved extends Error {}

/**
 * The app's Turnstile site key, or `undefined` (CAPTCHA off).
 *
 * @returns The site key
 */
export function getCaptchaSiteKey(): string | undefined {
  const siteKey = getPlatformEnvVar(TURNSTILE_SITE_KEY_ENV);
  return siteKey === '' ? undefined : siteKey;
}

let scriptLoad: Promise<TurnstileApi> | null = null;

/** The Turnstile API, loading the script on first use (a failed load is retried next time). */
function loadTurnstile(): Promise<TurnstileApi> {
  const win = window as TurnstileWindow;
  if (win.turnstile) return Promise.resolve(win.turnstile);
  if (scriptLoad) return scriptLoad;
  const load = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${TURNSTILE_SCRIPT_URL}?render=explicit&onload=${ONLOAD_CALLBACK}`;
    win[ONLOAD_CALLBACK] = () => {
      delete win[ONLOAD_CALLBACK];
      if (win.turnstile) resolve(win.turnstile);
      else reject(captchaError('script loaded without the Turnstile API'));
    };
    script.onerror = () => {
      delete win[ONLOAD_CALLBACK];
      script.remove();
      reject(captchaError('script failed to load'));
    };
    document.head.appendChild(script);
  });
  scriptLoad = load;
  // A failed load is forgotten: the next widget loads the script again.
  load.catch(() => {
    if (scriptLoad === load) scriptLoad = null;
  });
  return load;
}

/** Mounted form widgets, most recent last. */
const widgets: CaptchaWidget[] = [];

interface Waiter {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

/** Widget without registration: shared by form widgets and one-off widgets. */
function createWidget(
  siteKey: string,
  container: HTMLElement,
  options: CaptchaWidgetOptions,
  onRemove: () => void
): CaptchaWidget {
  let api: TurnstileApi | null = null;
  let widgetId: string | undefined;
  let token: string | null = null;
  let removed = false;
  let failure: Error | null = null;
  const waiters: Waiter[] = [];

  const rejectAll = (error: Error) => {
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  };
  // A token was handed out: the widget runs a new challenge for the next call.
  const renew = () => {
    if (api && widgetId !== undefined && !removed) api.reset(widgetId);
  };

  const render = () => {
    failure = null;
    loadTurnstile().then(
      (turnstile) => {
        if (removed) return;
        api = turnstile;
        try {
          widgetId = turnstile.render(container, {
            sitekey: siteKey,
            theme: 'auto',
            language: options.language,
            size: 'flexible',
            appearance: 'interaction-only',
            'refresh-expired': 'auto',
            'response-field': false,
            callback: (next) => {
              const waiter = waiters.shift();
              if (!waiter) {
                token = next;
                return;
              }
              waiter.resolve(next);
              renew();
            },
            'expired-callback': () => {
              token = null;
            },
            'error-callback': (code) => {
              token = null;
              rejectAll(captchaError(`widget error ${code}`));
              return true;
            },
            'timeout-callback': () => {
              token = null;
              rejectAll(captchaError('challenge timed out'));
            },
            'unsupported-callback': () => {
              failure = captchaError('browser not supported');
              rejectAll(failure);
            },
          });
        } catch (error) {
          failure = captchaError(
            error instanceof Error ? error.message : String(error)
          );
          rejectAll(failure);
        }
      },
      (error: Error) => {
        // Script blocked or unreachable: the next take() loads it again.
        failure = error;
        rejectAll(error);
      }
    );
  };

  render();

  return {
    take: () => {
      if (removed) return Promise.reject(new WidgetRemoved());
      if (token !== null) {
        const ready = token;
        token = null;
        renew();
        return Promise.resolve(ready);
      }
      if (failure && widgetId === undefined) render();
      else if (failure) return Promise.reject(failure);
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(captchaError('no token in time'));
        }, CAPTCHA_TIMEOUT_MS);
        const waiter: Waiter = {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };
        waiters.push(waiter);
      });
    },
    remove: () => {
      if (removed) return;
      removed = true;
      onRemove();
      if (api && widgetId !== undefined) api.remove(widgetId);
      rejectAll(new WidgetRemoved());
    },
  };
}

/**
 * Mount a Turnstile widget in `container` (framework auth forms, just above the submit
 * button). While mounted, it is the widget {@link getCaptchaToken} takes tokens from
 * (the most recently mounted one wins). Call `remove` on unmount.
 *
 * @param container - Element the widget renders into (no other children)
 * @param options - Widget language
 * @returns The widget
 * @throws Error when the app sets no `TURNSTILE_SITE_KEY`
 */
export function mountCaptchaWidget(
  container: HTMLElement,
  options: CaptchaWidgetOptions
): CaptchaWidget {
  const siteKey = getCaptchaSiteKey();
  if (!siteKey) {
    throw new Error(
      `[dndev] mountCaptchaWidget: set ${TURNSTILE_SITE_KEY_ENV} (VITE_ / NEXT_PUBLIC_) first.`
    );
  }
  const widget = createWidget(siteKey, container, options, () => {
    const index = widgets.indexOf(widget);
    if (index >= 0) widgets.splice(index, 1);
  });
  widgets.push(widget);
  return widget;
}

/** A token from a one-off widget at the bottom of `<body>` (no form widget mounted). */
async function takeDetached(siteKey: string): Promise<string> {
  const container = document.createElement('div');
  container.setAttribute('data-dndev-captcha', '');
  Object.assign(container.style, {
    position: 'fixed',
    insetBlockEnd: '1rem',
    insetInline: '1rem',
    zIndex: '2147483647',
    pointerEvents: 'auto',
  });
  document.body.appendChild(container);
  const widget = createWidget(
    siteKey,
    container,
    { language: document.documentElement.lang || 'auto' },
    () => container.remove()
  );
  try {
    return await widget.take();
  } finally {
    widget.remove();
  }
}

/**
 * A fresh single-use Turnstile token for one auth call, or `undefined` when the app sets
 * no `TURNSTILE_SITE_KEY` (CAPTCHA off). Auth providers call it right before each call
 * the auth server gates.
 *
 * @returns The token, or `undefined` without a site key
 * @throws Error coded `captcha_failed` when no token could be obtained
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  const siteKey = getCaptchaSiteKey();
  if (!siteKey) return undefined;
  if (typeof document === 'undefined') {
    throw captchaError('no browser document');
  }
  for (;;) {
    const widget = widgets.at(-1);
    if (!widget) return takeDetached(siteKey);
    try {
      return await widget.take();
    } catch (error) {
      // The form unmounted while the call waited: take from the next widget.
      if (!(error instanceof WidgetRemoved)) throw error;
    }
  }
}
