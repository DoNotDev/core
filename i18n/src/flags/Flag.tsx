// packages/core/i18n/src/flags/Flag.tsx

/**
 * @fileoverview Flag component for displaying country flags
 * @description Renders a flag as a static `<img>` of its SVG file, `/flags/<code>.svg`
 * (`flagSrc`), with its 4:3 box reserved by `width` / `height`: server HTML holds the
 * image itself, no lazy chunk, no placeholder, no layout shift.
 *
 * The build copies the flags of the app's languages to `public/flags/` (asset discovery,
 * Vite and Next, dev and build), plus every country flag when an entity of the app's
 * `entities` package has a `tel` field (the phone field lists them all). Any other flag
 * (a picker of every language, a `tel` field defined outside the `entities` package)
 * needs its file in the app: put the SVG in `public/flags/<code>.svg`
 * (`@donotdev/core/i18n/flags/<code>.svg`); the build never overwrites or deletes a file
 * there.
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { CSSProperties } from 'react';

import { flagSrc } from './flagAsset';

/**
 * Props for flag components
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FlagBaseProps {
  className?: string;
  /** Merged over the default size (`var(--icon-md)` wide, 4:3) */
  style?: CSSProperties;
  /** Accessible name (`alt`); default `<CODE> flag` */
  title?: string;
}

/** Intrinsic size of the reserved box (4:3), before CSS sizing. */
const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 15;

/** Default size: 20px (`--icon-md`) wide, 4:3. */
const FLAG_STYLE: CSSProperties = {
  width: 'var(--icon-md, 20px)',
  height: 'auto',
  aspectRatio: '4/3',
};

/**
 * Flag of a code (`fr`, `gb`, `gb-sct`; any case): `<img src="/flags/<code>.svg">`,
 * 4:3, `var(--icon-md)` wide by default (`style` overrides).
 *
 * @param props.code - Flag code (`LanguageData.flagCode || id`)
 * @param props.className - Class of the `<img>`
 * @param props.style - Merged over the default size
 * @param props.title - Accessible name (`alt`); default `<CODE> flag`
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function Flag({
  code,
  className,
  style,
  title,
}: { code: string } & FlagBaseProps) {
  return (
    <img
      src={flagSrc(code)}
      width={FLAG_WIDTH}
      height={FLAG_HEIGHT}
      alt={title || `${code.toUpperCase()} flag`}
      className={className}
      style={style ? { ...FLAG_STYLE, ...style } : FLAG_STYLE}
    />
  );
}
