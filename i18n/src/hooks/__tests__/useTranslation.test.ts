import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useTranslation } from '../useTranslation';

const BODY = ['first', 'second'];
const translate = vi.fn((key: string) => (key === 'body' ? BODY : key));

vi.mock('react-i18next', () => ({
  useTranslation: () => [translate, { language: 'fr' }, true],
}));
vi.mock('@donotdev/hooks', () => ({ useIsClient: () => true }));
vi.mock('../../instance.vite', () => ({ getI18nInstance: () => ({}) }));

describe('useTranslation', () => {
  it('returns the array when returnObjects is requested', () => {
    const { result } = renderHook(() => useTranslation('cgv'));
    const t = result.current.t as unknown as (
      key: string,
      options?: Record<string, unknown>
    ) => unknown;

    expect(t('body', { returnObjects: true })).toEqual(BODY);
  });

  it('returns the key for an object result without returnObjects', () => {
    const { result } = renderHook(() => useTranslation('cgv'));
    const t = result.current.t as unknown as (key: string) => unknown;

    expect(t('body')).toBe('body');
  });

  it('returns the key when a returnObjects lookup misses', () => {
    const { result } = renderHook(() => useTranslation('cgv'));
    const t = result.current.t as unknown as (
      key: string,
      options?: Record<string, unknown>
    ) => unknown;

    expect(t('missing', { returnObjects: true })).toBe('missing');
  });
});
