// packages/core/i18n/src/flags/raw/flagPL.tsx

/**
 * @fileoverview Polish Flag Component
 * @description React component for displaying the Polish flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagPL.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function PLSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'PL flag'}
      role="img"
    >
      <g fillRule="evenodd">
        <path fill="#fff" d="M640 480H0V0h640z" />
        <path fill="#dc143c" d="M640 480H0V240h640z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(PLSvg);
