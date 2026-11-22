// packages/core/hooks/src/providers/__tests__/AppConfigProvider.test.tsx

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEFAULT_OG_IMAGE } from '@donotdev/types';

import { DEFAULT_OG_IMAGE as BUILD_DEFAULT_OG_IMAGE } from '../../../../config/constants.js';
import { AppConfigProvider, useSeoConfig } from '../AppConfigProvider';

function DefaultImage() {
  const seo = useSeoConfig();
  return <>{seo ? seo.defaultImage : 'disabled'}</>;
}

const defaultImage = (config?: Parameters<typeof AppConfigProvider>[0]['config']) =>
  renderToStaticMarkup(
    <AppConfigProvider config={config}>
      <DefaultImage />
    </AppConfigProvider>
  );

describe('AppConfigProvider: seo.defaultImage', () => {
  it('REGRESSION: defaults to the generated link-preview PNG, never /logo.svg', () => {
    expect(defaultImage()).toBe('/og-image.png');
  });

  it('is the path the build writes and uses (config DEFAULT_OG_IMAGE)', () => {
    expect(DEFAULT_OG_IMAGE).toBe(BUILD_DEFAULT_OG_IMAGE);
  });

  it('keeps the app value', () => {
    expect(defaultImage({ seo: { defaultImage: '/og-image.jpg' } })).toBe('/og-image.jpg');
  });
});
