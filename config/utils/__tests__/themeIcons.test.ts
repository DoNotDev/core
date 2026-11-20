// packages/core/config/utils/__tests__/themeIcons.test.ts

import { describe, expect, it, vi } from 'vitest';

import {
  getThemeIconNames,
  renderThemeIconImports,
  renderThemeIconMap,
} from '../themeIcons.js';

const theme = (name: string, icon?: string) => ({ name, meta: { icon } });

describe('theme icon registry', () => {
  it('keeps unique lucide export names, sorted, CSS quotes stripped', () => {
    const logger = { warn: vi.fn() };
    const names = getThemeIconNames(
      [
        theme('light', 'Sun'),
        theme('dark', "'Moon'"),
        theme('gold', '"Gem"'),
        theme('sun2', 'Sun'),
        theme('none'),
      ],
      logger
    );
    expect(names).toEqual(['Gem', 'Moon', 'Sun']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reports and drops names that are not lucide-react icons', () => {
    const logger = { warn: vi.fn() };
    expect(
      getThemeIconNames([theme('x', 'NotAnIcon'), theme('y', 'not valid')], logger)
    ).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('renders aliased named imports and the name to component map', () => {
    expect(renderThemeIconImports(['Gem', 'Sun'])).toBe(
      "import { Gem as ThemeIcon_Gem, Sun as ThemeIcon_Sun } from 'lucide-react';\n"
    );
    expect(renderThemeIconMap(['Gem', 'Sun'])).toBe(
      '{ "Gem": ThemeIcon_Gem, "Sun": ThemeIcon_Sun }'
    );
    expect(renderThemeIconImports([])).toBe('');
  });
});
