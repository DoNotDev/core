// packages/core/i18n/src/flags/raw/flagMA.tsx

/**
 * @fileoverview Moroccan Flag Component
 * @description React component for displaying the Moroccan flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagMA.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function MASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'MA flag'}
      role="img"
    >
      <path fill="#c1272d" d="M0 0h640v480H0z" />
      <path
        fill="none"
        stroke="#006233"
        strokeWidth="43.8"
        d="M320 179.4 370.4 240 320 300.6 269.6 240z"
      />
      <path
        fill="#006233"
        d="m311.7 240 29.6 20.5-11.3-34.7 29.6-20.5h-36.6l-11.3-34.7-11.3 34.7h-36.6l29.6 20.5-11.3 34.7z"
      />
    </svg>
  );
}

export default createFlagComponent(MASvg);
