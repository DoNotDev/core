// packages/core/i18n/src/flags/raw/flagSA.tsx

/**
 * @fileoverview Saudi Arabian Flag Component
 * @description React component for displaying the Saudi Arabian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagSA.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function SASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'SA flag'}
      role="img"
    >
      <path fill="#006c35" d="M0 0h640v480H0z" />
      <path
        fill="#fff"
        d="M320 180c-33.1 0-60 26.9-60 60s26.9 60 60 60 60-26.9 60-60-26.9-60-60-60zm0 13.3c25.8 0 46.7 20.9 46.7 46.7S345.8 306.7 320 306.7 273.3 285.8 273.3 240s20.9-46.7 46.7-46.7z"
      />
      <path fill="#fff" d="M280 200h80l-20 40h-40zM320 160l10 20h-20z" />
    </svg>
  );
}

export default createFlagComponent(SASvg);
