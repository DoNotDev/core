// packages/core/i18n/src/flags/raw/flagHY.tsx

/**
 * @fileoverview Armenian (Alternative) Flag Component
 * @description React component for displaying the Armenian (alternative) flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagHY.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function HYSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'HY flag'}
      role="img"
    >
      <path fill="#d90012" d="M0 0h640v160H0z" />
      <path fill="#0033a0" d="M0 160h640v160H0z" />
      <path fill="#f2a800" d="M0 320h640v160H0z" />
    </svg>
  );
}

export default createFlagComponent(HYSvg);
