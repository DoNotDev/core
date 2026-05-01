// packages/core/i18n/src/flags/raw/flagAM.tsx

/**
 * @fileoverview Armenian Flag Component
 * @description React component for displaying the Armenian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function AMSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'AM flag'}
      role="img"
    >
      <g fillRule="evenodd">
        <path fill="#f2a800" d="M0 0h640v480H0z" />
        <path fill="#0033a0" d="M0 0h640v320H0z" />
        <path fill="#d90012" d="M0 0h640v160H0z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(AMSvg);
