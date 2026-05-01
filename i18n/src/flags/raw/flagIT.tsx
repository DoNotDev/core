// packages/core/i18n/src/flags/raw/flagIT.tsx

/**
 * @fileoverview Italian Flag Component
 * @description React component for displaying the Italian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagIT.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ITSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'IT flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#fff" d="M0 0h640v480H0z" />
        <path fill="#009246" d="M0 0h213.3v480H0z" />
        <path fill="#ce2b37" d="M426.7 0H640v480H426.7z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(ITSvg);
