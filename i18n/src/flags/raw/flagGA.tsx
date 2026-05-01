// packages/core/i18n/src/flags/raw/flagGA.tsx

/**
 * @fileoverview Gabonese/Gaelic Flag Component
 * @description React component for displaying the Gabonese/Gaelic flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagGA.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function GASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'GA flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#fff" d="M0 0h640v480H0z" />
        <path fill="#009A49" d="M0 0h213.3v480H0z" />
        <path fill="#FF7900" d="M426.7 0H640v480H426.7z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(GASvg);
