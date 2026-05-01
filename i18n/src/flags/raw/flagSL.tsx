// packages/core/i18n/src/flags/raw/flagSL.tsx

/**
 * @fileoverview Sierra Leone Flag Component
 * @description React component for displaying the Sierra Leone flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function SLSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'SL flag'}
      role="img"
    >
      <g fillRule="evenodd">
        <path fill="#0072c6" d="M0 0h640v480H0z" />
        <path fill="#fff" d="M0 0h640v320H0z" />
        <path fill="#1eb53a" d="M0 0h640v160H0z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(SLSvg);
