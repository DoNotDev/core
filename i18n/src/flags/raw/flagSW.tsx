// packages/core/i18n/src/flags/raw/flagSW.tsx

/**
 * @fileoverview Swahili Flag Component
 * @description React component for displaying the Swahili flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagSW.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function SWSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'SW flag'}
      role="img"
    >
      <defs>
        <clipPath id="tz-a">
          <path fillOpacity=".7" d="M10 0h160v120H10z" />
        </clipPath>
      </defs>
      <g
        fillRule="evenodd"
        strokeWidth="1pt"
        clipPath="url(#tz-a)"
        transform="matrix(4 0 0 4 -40 0)"
      >
        <path fill="#09f" d="M0 0h180v120H0z" />
        <path fill="#090" d="M0 0h180L0 120z" />
        <path fill="#000001" d="M0 120h40l140-95V0h-40L0 95z" />
        <path
          fill="#ff0"
          d="M0 91.5 137.2 0h13.5L0 100.5zM29.3 120 180 19.5v9L42.8 120z"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(SWSvg);
