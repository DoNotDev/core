// packages/core/i18n/src/flags/raw/flagUA.tsx

/**
 * @fileoverview Ukrainian Flag Component
 * @description React component for displaying the Ukrainian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagUK.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function UKSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'UK flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="gold" d="M0 0h640v480H0z" />
        <path fill="#0057b8" d="M0 0h640v240H0z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(UKSvg);
