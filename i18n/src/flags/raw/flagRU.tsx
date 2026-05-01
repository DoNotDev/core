// packages/core/i18n/src/flags/raw/flagRU.tsx

/**
 * @fileoverview Russian Flag Component
 * @description React component for displaying the Russian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagRU.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function RUSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'RU flag'}
      role="img"
    >
      <path fill="#fff" d="M0 0h640v160H0z" />
      <path fill="#0039a6" d="M0 160h640v160H0z" />
      <path fill="#d52b1e" d="M0 320h640v160H0z" />
    </svg>
  );
}

export default createFlagComponent(RUSvg);
