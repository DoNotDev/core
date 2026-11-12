import { describe, expect, it } from 'vitest';

import { validateSignedInRedirect } from '../RouteDiscovery.js';
import { extractMeta } from '../../utils/MetaExtractor.js';

const route = (signedInRedirect: unknown) => ({
  path: '/',
  file: 'src/pages/HomePage.tsx',
  meta: { signedInRedirect },
});

describe('PageMeta signedInRedirect', () => {
  it('reaches the route meta through extractMeta', () => {
    const meta = extractMeta(
      "export const NAMESPACE = 'home';\nexport const meta: PageMeta = {\n  namespace: NAMESPACE,\n  icon: <Home />,\n  auth: false,\n  signedInRedirect: '/catalogue',\n};"
    );
    expect(meta).toMatchObject({ namespace: 'home', signedInRedirect: '/catalogue' });
  });

  it('accepts an app path and pages without the field', () => {
    expect(() => validateSignedInRedirect(route('/catalogue'))).not.toThrow();
    expect(() =>
      validateSignedInRedirect({ path: '/', file: 'x', meta: {} })
    ).not.toThrow();
  });

  it('fails the build on an external or relative target, or a self loop', () => {
    for (const bad of ['https://evil.example', '//evil.example', 'catalogue', 42]) {
      expect(() => validateSignedInRedirect(route(bad))).toThrow(
        /must be an app path/
      );
    }
    expect(() => validateSignedInRedirect(route('/?x=1'))).toThrow(/loop/);
  });
});
