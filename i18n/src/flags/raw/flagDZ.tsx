// packages/core/i18n/src/flags/raw/flagDZ.tsx

/**
 * @fileoverview Algerian Flag Component
 * @description React component for displaying the Algerian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagDZ.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function DZSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'DZ flag'}
      role="img"
    >
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#009739" d="M320 0h320v480H320z" />
      <path
        fill="#d21034"
        d="M405.3 240a114.7 114.7 0 1 1-229.4 0 114.7 114.7 0 0 1 229.4 0z"
      />
      <path
        fill="#fff"
        d="M320 180.2a59.8 59.8 0 0 0-59.8 59.8h119.6a59.8 59.8 0 0 0-59.8-59.8z"
      />
      <path
        fill="#d21034"
        d="M367.6 240 320 215.2l-47.6 24.8v19.6l47.6 24.8 47.6-24.8z"
      />
      <path
        fill="#d21034"
        d="m320 135.2 12.2 37.6h39.6l-32 23.2 12.2 37.6-32-23.2-32 23.2 12.2-37.6-32-23.2h39.6z"
      />
    </svg>
  );
}

export default createFlagComponent(DZSvg);
