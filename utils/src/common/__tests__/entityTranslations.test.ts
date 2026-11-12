import { describe, it, expect } from 'vitest';

import {
  getTranslatedFieldNames,
  i18nFieldName,
  translateRow,
} from '../entityTranslations';

const FIELDS = ['name', 'highlights'];
const row = {
  id: 'p1',
  name: 'Crème',
  nameI18n: { en: 'Cream', de: '' },
  highlights: [{ text: 'Hydrate' }],
  highlightsI18n: { en: [{ text: 'Moisturises' }], pl: [] },
  sku: 'X1',
};

describe('translateRow', () => {
  it('swaps in the requested language', () => {
    const out = translateRow(row, FIELDS, 'en');
    expect(out.name).toBe('Cream');
    expect(out.highlights).toEqual([{ text: 'Moisturises' }]);
    expect(out.sku).toBe('X1');
  });

  it('keeps the stored value when the translation is missing or empty', () => {
    expect(translateRow(row, FIELDS, 'de').name).toBe('Crème');
    expect(translateRow(row, FIELDS, 'pl').highlights).toEqual([{ text: 'Hydrate' }]);
    expect(translateRow(row, FIELDS, 'it').name).toBe('Crème');
  });

  it('returns the same object when nothing changes', () => {
    expect(translateRow(row, FIELDS, 'fr')).toBe(row);
    expect(translateRow({ id: 'p2', name: 'A', nameI18n: null }, FIELDS, 'en').name).toBe('A');
  });

  it('never mutates the stored row', () => {
    translateRow(row, FIELDS, 'en');
    expect(row.name).toBe('Crème');
  });
});

describe('translated field names', () => {
  it('lists i18n fields and names their companion', () => {
    expect(getTranslatedFieldNames({ a: { i18n: true }, b: {}, c: { i18n: false } })).toEqual(['a']);
    expect(i18nFieldName('shortDescription')).toBe('shortDescriptionI18n');
  });
});
