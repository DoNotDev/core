// packages/core/i18n/src/flags/raw/flagNO.tsx

/**
 * @fileoverview Norwegian Flag Component
 * @description React component for displaying the Norwegian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagNO.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function NOSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'NO flag'}
      role="img"
    >
      <path fill="#ed2939" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M180 0h120v480H180z" />
      <path fill="#fff" d="M0 180h640v120H0z" />
      <path fill="#002664" d="M210 0h60v480h-60z" />
      <path fill="#002664" d="M0 210h640v60H0z" />
    </svg>
  );
}

export default createFlagComponent(NOSvg);
