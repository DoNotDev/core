// packages/core/i18n/src/flags/raw/flagLY.tsx

/**
 * @fileoverview Libyan Flag Component
 * @description React component for displaying the Libyan flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagLY.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function LYSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'LY flag'}
      role="img"
    >
      <path fill="#239e46" d="M0 0h640v160H0z" />
      <path fill="#000" d="M0 160h640v160H0z" />
      <path fill="#e70013" d="M0 320h640v160H0z" />
      <path fill="#fff" d="M0 0h213.3v480H0z" />
      <path fill="#000" d="M106.7 0h106.6v480H106.7z" />
      <circle fill="#239e46" cx="160" cy="240" r="53.3" />
      <path
        fill="#fff"
        d="M160 200c-22.1 0-40 17.9-40 40s17.9 40 40 40 40-17.9 40-40-17.9-40-40-40zm0 13.3c14.7 0 26.7 11.9 26.7 26.7s-11.9 26.7-26.7 26.7-26.7-11.9-26.7-26.7 11.9-26.7 26.7-26.7z"
      />
    </svg>
  );
}

export default createFlagComponent(LYSvg);
