// packages/core/i18n/src/flags/raw/flagNE.tsx

/**
 * @fileoverview Niger Flag Component
 * @description React component for displaying the Niger flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function NESvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'NE flag'}
      role="img"
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#e05206" d="M0 0h640v160H0z" />
        <path fill="#fff" d="M0 160h640v160H0z" />
        <path fill="#0db02b" d="M0 320h640v160H0z" />
        <circle cx="320" cy="240" r="68" fill="#e05206" />
      </g>
    </svg>
  );
}

export default createFlagComponent(NESvg);
