// packages/core/i18n/src/flags/raw/flagCH.tsx

/**
 * @fileoverview Swiss Flag Component
 * @description React component for displaying the Swiss flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagCH.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function CHSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'CH flag'}
      role="img"
    >
      <path fill="#da121a" d="M0 0h640v480H0z" />
      <g fill="#fff">
        <path d="M170 195h300v90H170z" />
        <path d="M275 90h90v300h-90z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(CHSvg);
