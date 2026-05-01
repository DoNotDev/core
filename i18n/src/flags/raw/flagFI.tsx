// packages/core/i18n/src/flags/raw/flagFI.tsx

/**
 * @fileoverview Finnish Flag Component
 * @description React component for displaying the Finnish flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagFI.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function FISvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'FI flag'}
      role="img"
    >
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#002f6c" d="M0 174.5h640v131H0z" />
      <path fill="#002f6c" d="M175.5 0h130.9v480h-131z" />
    </svg>
  );
}

export default createFlagComponent(FISvg);
