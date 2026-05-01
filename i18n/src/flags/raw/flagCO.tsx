// packages/core/i18n/src/flags/raw/flagCO.tsx

/**
 * @fileoverview Colombian Flag Component
 * @description React component for displaying the Colombian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function COSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 900 600"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'CO flag'}
      role="img"
    >
      <path fill="#ffcd00" d="M0 0h900v600H0z" />
      <path fill="#003087" d="M0 300h900v300H0z" />
      <path fill="#c8102e" d="M0 450h900v150H0z" />
    </svg>
  );
}

export default createFlagComponent(COSvg);
