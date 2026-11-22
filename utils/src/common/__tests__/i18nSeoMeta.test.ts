import { createInstance } from 'i18next';
import { describe, it, expect, beforeAll } from 'vitest';
import type { TFunction } from 'i18next';

import { readI18nSeoMeta, resolveSeoField } from '../headTags';

let t: TFunction;

beforeAll(async () => {
  const instance = createInstance();
  await instance.init({
    lng: 'en',
    resources: {
      en: {
        home: {
          meta: {
            image: '/og.png',
            type: 'article',
            keywords: ['react', 'framework'],
          },
        },
        empty: { title: 'No meta' },
      },
    },
  });
  t = instance.t;
});

describe('readI18nSeoMeta', () => {
  it('reads string fields and keyword arrays from a namespace', () => {
    expect(readI18nSeoMeta(t, 'home')).toEqual({
      image: '/og.png',
      type: 'article',
      keywords: ['react', 'framework'],
    });
  });

  it('returns undefined for every field when the namespace has no meta', () => {
    expect(readI18nSeoMeta(t, 'empty')).toEqual({});
  });
});

describe('resolveSeoField', () => {
  it('returns the translation', () => {
    expect(resolveSeoField(undefined, 'empty:title', t)).toBe('No meta');
  });

  it('returns undefined when the namespaced key has no translation', () => {
    expect(resolveSeoField(undefined, 'empty:description', t)).toBeUndefined();
  });

  it('uses an explicit value and omits on null', () => {
    expect(resolveSeoField('Explicit', 'empty:title', t)).toBe('Explicit');
    expect(resolveSeoField(null, 'empty:title', t)).toBeUndefined();
  });
});
