// packages/core/i18n/src/flags/raw/flagCS.tsx

/**
 * @fileoverview Czech Flag Component
 * @description React component for displaying the Czech flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagCS.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function CSSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'CS flag'}
      role="img"
    >
      <path fill="#fff" d="M0 0h640v240H0z" />
      <path fill="#d7141a" d="M0 240h640v240H0z" />
      <path fill="#11457e" d="M360 240 0 0v480z" />
    </svg>
  );
}

export default createFlagComponent(CSSvg);
