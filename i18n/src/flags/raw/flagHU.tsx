// packages/core/i18n/src/flags/raw/flagHU.tsx

/**
 * @fileoverview Hungarian Flag Component
 * @description React component for displaying the Hungarian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagHU.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function HUSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'HU flag'}
      role="img"
    >
      <g fillRule="evenodd">
        <path fill="#fff" d="M640 480H0V0h640z" />
        <path fill="#388d00" d="M640 480H0V320h640z" />
        <path fill="#d43516" d="M640 160.1H0V.1h640z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(HUSvg);
