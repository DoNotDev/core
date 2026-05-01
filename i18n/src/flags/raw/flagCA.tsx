// packages/core/i18n/src/flags/raw/flagCA.tsx

/**
 * @fileoverview Canadian Flag Component
 * @description React component for displaying the Canadian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagCA.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function CASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'CA flag'}
      role="img"
    >
      <path fill="#fcdd09" d="M0 0h640v480H0z" />
      <path
        stroke="#da121a"
        strokeWidth="60"
        d="M0 90h810m0 120H0m0 120h810m0 120H0"
        transform="scale(.79012 .88889)"
      />
    </svg>
  );
}

export default createFlagComponent(CASvg);
