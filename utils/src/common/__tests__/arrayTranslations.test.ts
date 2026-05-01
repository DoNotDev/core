import { describe, it, expect, vi } from 'vitest';

import {
  translateArray,
  translateObjectArray,
  translateArrayRange,
  translateArrayWithIndices,
} from '../arrayTranslations';

// Mock t function: returns the value if key exists in translations, otherwise returns the key
function createMockT(translations: Record<string, string>) {
  return ((key: string) => translations[key] ?? key) as any;
}

describe('translateArray', () => {
  it('returns translated items', () => {
    const t = createMockT({
      'items.0': 'First',
      'items.1': 'Second',
      'items.2': 'Third',
    });

    const result = translateArray(t, 'items', 5);

    expect(result).toEqual(['First', 'Second', 'Third']);
  });

  it('filters out missing translations (key === value)', () => {
    const t = createMockT({
      'items.0': 'Present',
    });

    const result = translateArray(t, 'items', 3);

    expect(result).toEqual(['Present']);
  });

  it('filters out empty strings by default', () => {
    const t = createMockT({
      'items.0': 'Value',
      'items.1': '',
      'items.2': '  ',
    });

    const result = translateArray(t, 'items', 3);

    expect(result).toEqual(['Value']);
  });

  it('keeps empty strings when excludeEmpty is false', () => {
    const t = createMockT({
      'items.0': 'Value',
      'items.1': '',
    });

    const result = translateArray(t, 'items', 2, { excludeEmpty: false });

    expect(result).toEqual(['Value', '']);
  });

  it('filters by minLength', () => {
    const t = createMockT({
      'items.0': 'ab',
      'items.1': 'abcde',
    });

    const result = translateArray(t, 'items', 2, { minLength: 3 });

    expect(result).toEqual(['abcde']);
  });

  it('supports custom filter', () => {
    const t = createMockT({
      'items.0': 'keep',
      'items.1': 'skip',
      'items.2': 'keep-too',
    });

    const result = translateArray(t, 'items', 3, {
      customFilter: (item) => item.startsWith('keep'),
    });

    expect(result).toEqual(['keep', 'keep-too']);
  });
});

describe('translateObjectArray', () => {
  it('returns translated objects', () => {
    const t = createMockT({
      'cases.0.title': 'Title 1',
      'cases.0.desc': 'Desc 1',
      'cases.1.title': 'Title 2',
      'cases.1.desc': 'Desc 2',
    });

    const result = translateObjectArray(t, 'cases', 3, ['title', 'desc']);

    expect(result).toEqual([
      { title: 'Title 1', desc: 'Desc 1' },
      { title: 'Title 2', desc: 'Desc 2' },
    ]);
  });

  it('filters out missing objects (first key not found)', () => {
    const t = createMockT({
      'cases.0.title': 'Title 1',
      'cases.0.desc': 'Desc 1',
    });

    const result = translateObjectArray(t, 'cases', 3, ['title', 'desc']);

    expect(result).toHaveLength(1);
  });
});

describe('translateArrayRange', () => {
  it('translates items in range', () => {
    const t = createMockT({
      'items.2': 'Two',
      'items.3': 'Three',
      'items.4': 'Four',
    });

    const result = translateArrayRange(t, 'items', 2, 5);

    expect(result).toEqual(['Two', 'Three', 'Four']);
  });

  it('filters out missing translations in range', () => {
    const t = createMockT({
      'items.2': 'Two',
    });

    const result = translateArrayRange(t, 'items', 2, 5);

    expect(result).toEqual(['Two']);
  });
});

describe('translateArrayWithIndices', () => {
  it('returns items with original indices', () => {
    const t = createMockT({
      'items.0': 'First',
      'items.2': 'Third',
    });

    const result = translateArrayWithIndices(t, 'items', 4);

    expect(result).toEqual([
      { item: 'First', originalIndex: 0 },
      { item: 'Third', originalIndex: 2 },
    ]);
  });

  it('preserves original index after filtering', () => {
    const t = createMockT({
      'items.0': 'a',
      'items.1': 'abcdef',
    });

    const result = translateArrayWithIndices(t, 'items', 3, { minLength: 3 });

    expect(result).toEqual([{ item: 'abcdef', originalIndex: 1 }]);
  });
});
