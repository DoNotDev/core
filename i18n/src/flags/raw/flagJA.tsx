// packages/core/i18n/src/flags/raw/flagJA.tsx

/**
 * @fileoverview Japanese Flag Component
 * @description React component for displaying the Japanese flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagJA.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function JASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'JA flag'}
      role="img"
    >
      <defs>
        <clipPath id="jp-a">
          <path fillOpacity=".7" d="M-88 32h640v480H-88z" />
        </clipPath>
      </defs>
      <g
        fillRule="evenodd"
        strokeWidth="1pt"
        clipPath="url(#jp-a)"
        transform="translate(88 -32)"
      >
        <path fill="#fff" d="M-128 32h720v480h-720z" />
        <circle
          cx="523.1"
          cy="344.1"
          r="194.9"
          fill="#bc002d"
          transform="translate(-168.4 8.6)scale(.76554)"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(JASvg);
