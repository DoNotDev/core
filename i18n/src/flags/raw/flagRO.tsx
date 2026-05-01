// packages/core/i18n/src/flags/raw/flagRO.tsx

/**
 * @fileoverview Romanian Flag Component
 * @description React component for displaying the Romanian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagRO.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ROSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'RO flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#00319c" d="M0 0h213.3v480H0z" />
        <path fill="#ffde00" d="M213.3 0h213.4v480H213.3z" />
        <path fill="#de2110" d="M426.7 0H640v480H426.7z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(ROSvg);
