// packages/core/i18n/src/flags/raw/flagHE.tsx

/**
 * @fileoverview Hebrew Flag Component
 * @description React component for displaying the Hebrew flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagHE.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function HESvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'HE flag'}
      role="img"
    >
      <defs>
        <clipPath id="il-a">
          <path fillOpacity=".7" d="M-87.6 0H595v512H-87.6z" />
        </clipPath>
      </defs>
      <g
        fillRule="evenodd"
        clipPath="url(#il-a)"
        transform="translate(82.1)scale(.94)"
      >
        <path fill="#fff" d="M619.4 512H-112V0h731.4z" />
        <path
          fill="#0038b8"
          d="M619.4 115.2H-112V48h731.4zm0 350.5H-112v-67.2h731.4zm-483-275 110.1 191.6L359 191.6z"
        />
        <path fill="#fff" d="m225.8 317.8 20.9 35.5 21.4-35.3z" />
        <path fill="#0038b8" d="M136 320.6 246.2 129l112.4 190.8z" />
        <path
          fill="#fff"
          d="m225.8 191.6 20.9-35.5 21.4 35.4zM182 271.1l-21.7 36 41-.1-19.3-36zm-21.3-66.5 41.2.3-19.8 36.3zm151.2 67 20.9 35.5-41.7-.5zm20.5-67-41.2.3 19.8 36.3zm-114.3 0L189.7 256l28.8 50.3 52.8 1.2 32-51.5-29.6-52z"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(HESvg);
