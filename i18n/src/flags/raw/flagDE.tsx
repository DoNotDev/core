// packages/core/i18n/src/flags/raw/flagDE.tsx

/**
 * @fileoverview German Flag Component
 * @description React component for displaying the German flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagDE.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function DESvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'DE flag'}
      role="img"
    >
      <path fill="#fc0" d="M0 320h640v160H0z" />
      <path fill="#000001" d="M0 0h640v160H0z" />
      <path fill="red" d="M0 160h640v160H0z" />
    </svg>
  );
}

export default createFlagComponent(DESvg);
