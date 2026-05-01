// packages/core/i18n/src/flags/raw/flagMX.tsx

/**
 * @fileoverview Mexican Flag Component
 * @description React component for displaying the Mexican flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagMX.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function MXSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'MX flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#006847" d="M0 0h213.3v480H0z" />
        <path fill="#fff" d="M213.3 0h213.4v480H213.3z" />
        <path fill="#ce1126" d="M426.7 0H640v480H426.7z" />
        <path
          fill="#006847"
          d="M291.7 240a89.3 89.3 0 1 1-178.6 0 89.3 89.3 0 0 1 178.6 0z"
        />
        <path
          fill="#fff"
          d="M256 240a53.3 53.3 0 1 1-106.6 0 53.3 53.3 0 0 1 106.6 0z"
        />
        <path
          fill="#ce1126"
          d="M240 213.3h13.3l6.7-20-6.7-20H240l-13.3 20zm-26.7 13.4h13.4l6.6-20-6.6-20h-13.4l-13.3 20zm53.4 0h13.3l6.7-20-6.7-20h-13.3l-13.4 20z"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(MXSvg);
