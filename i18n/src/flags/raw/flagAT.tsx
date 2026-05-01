// packages/core/i18n/src/flags/raw/flagAT.tsx

/**
 * @fileoverview Austrian Flag Component
 * @description React component for displaying the Austrian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagAT.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ATSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'AT flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#fff" d="M0 0h640v480H0z" />
        <path fill="#ed2939" d="M0 160h640v160H0z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(ATSvg);
