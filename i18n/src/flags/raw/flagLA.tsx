// packages/core/i18n/src/flags/raw/flagLA.tsx

/**
 * @fileoverview Lao Flag Component
 * @description React component for displaying the Lao flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagLO.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function LOSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'LO flag'}
      role="img"
    >
      <defs>
        <clipPath id="la-a">
          <path fillOpacity=".7" d="M0 0h640v480H0z" />
        </clipPath>
      </defs>
      <g fillRule="evenodd" clipPath="url(#la-a)">
        <path fill="#ce1126" d="M-40 0h720v480H-40z" />
        <path fill="#002868" d="M-40 119.3h720v241.4H-40z" />
        <path
          fill="#fff"
          d="M423.4 240a103.4 103.4 0 1 1-206.8 0 103.4 103.4 0 1 1 206.8 0"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(LOSvg);
