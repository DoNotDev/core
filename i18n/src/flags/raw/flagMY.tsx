// packages/core/i18n/src/flags/raw/flagMY.tsx

/**
 * @fileoverview Malaysia Flag Component
 * @description React component for displaying the Malaysia flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function MYSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'MY flag'}
      role="img"
    >
      <path fill="#cc0001" d="M0 0h640v480H0z" />
      <path
        fill="#fff"
        d="M0 34.3h640V68.6H0zm0 68.6h640v34.3H0zm0 68.5h640v34.3H0zm0 68.6h640v34.3H0zm0 68.6h640v34.2H0z"
      />
      <path fill="#010066" d="M0 0h320v274.3H0z" />
      <path
        fill="#fc0"
        d="M175.7 61.6c44.6 0 81.6 32.7 88.3 75.3-2.5-1.1-5.3-1.6-8.2-1.6-33.4 0-60.6 27.2-60.6 60.7s27.2 60.7 60.6 60.7c3.1 0 6-.6 8.8-1.8-7.3 39.8-42.3 69.8-84.1 69.8-47.4 0-85.9-38.5-85.9-85.9s38.5-85.9 85.9-85.9l-4.8-13.3zm29.3 118.9 9.3 6 .3-11 8.5 7.1 2.8-10.7 6.3 9.1 5.3-9.7 3.3 10.5 7.2-8.3-.2 11.1 8.5-7.1-3.6 10.4 9.1-6.4-6.3 9.1L256 187l-8.4 7.2 10.5 3.3-9.7 5.4 9.2 6.3-10.8 2.7 7 8.5-11-.3 6 9.3-13.7-4.8 1.8-13.7z"
      />
    </svg>
  );
}

export default createFlagComponent(MYSvg);
