// packages/core/i18n/src/flags/raw/flagTH.tsx

/**
 * @fileoverview Thai Flag Component
 * @description React component for displaying the Thai flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagTH.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function THSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'TH flag'}
      role="img"
    >
      <g fillRule="evenodd">
        <path fill="#f4f5f8" d="M0 0h640v480H0z" />
        <path fill="#2d2a4a" d="M0 162.5h640v160H0z" />
        <path fill="#a51931" d="M0 0h640v82.5H0zm0 400h640v80H0z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(THSvg);
