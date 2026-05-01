// packages/core/i18n/src/flags/raw/flagLV.tsx

/**
 * @fileoverview Latvian Flag Component
 * @description React component for displaying the Latvian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagLV.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function LVSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'LV flag'}
      role="img"
    >
      <g fillRule="evenodd">
        <path fill="#fff" d="M0 0h640v480H0z" />
        <path fill="#981e32" d="M0 0h640v192H0zm0 288h640v192H0z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(LVSvg);
