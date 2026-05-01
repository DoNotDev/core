// packages/core/i18n/src/flags/raw/flagBD.tsx

/**
 * @fileoverview Bangladesh Flag Component
 * @description React component for displaying the Bangladesh flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function BDSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'BD flag'}
      role="img"
    >
      <path fill="#006a4e" d="M0 0h640v480H0z" />
      <circle cx="280" cy="240" r="160" fill="#f42a41" />
    </svg>
  );
}

export default createFlagComponent(BDSvg);
