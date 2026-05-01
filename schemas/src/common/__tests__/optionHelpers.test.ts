import { describe, it, expect } from 'vitest';

import { rangeOptions } from '../optionHelpers';

describe('rangeOptions', () => {
  it('generates ascending range with default step', () => {
    const result = rangeOptions(1, 3);

    expect(result).toEqual([
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
    ]);
  });

  it('generates range with custom step', () => {
    const result = rangeOptions(0, 100, 50);

    expect(result).toEqual([
      { value: '0', label: '0' },
      { value: '50', label: '50' },
      { value: '100', label: '100' },
    ]);
  });

  it('generates descending range', () => {
    const result = rangeOptions(1, 3, 1, true);

    expect(result).toEqual([
      { value: '3', label: '3' },
      { value: '2', label: '2' },
      { value: '1', label: '1' },
    ]);
  });

  it('handles single value range', () => {
    const result = rangeOptions(5, 5);

    expect(result).toEqual([{ value: '5', label: '5' }]);
  });

  it('handles step larger than range', () => {
    const result = rangeOptions(1, 3, 10);

    expect(result).toEqual([{ value: '1', label: '1' }]);
  });

  it('returns empty for inverted range (start > end, ascending)', () => {
    const result = rangeOptions(5, 1);

    expect(result).toEqual([]);
  });

  it('values and labels are strings', () => {
    const result = rangeOptions(10, 12);

    for (const opt of result) {
      expect(typeof opt.value).toBe('string');
      expect(typeof opt.label).toBe('string');
    }
  });
});
