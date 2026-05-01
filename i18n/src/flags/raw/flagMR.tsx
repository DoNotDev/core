// packages/core/i18n/src/flags/raw/flagMR.tsx

/**
 * @fileoverview Mauritanian Flag Component
 * @description React component for displaying the Mauritanian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagMR.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function MRSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'MR flag'}
      role="img"
    >
      <path fill="#00a95c" d="M0 0h640v480H0z" />
      <path fill="#ffcd00" d="M0 0h640v80H0zm0 400h640v80H0z" />
      <path fill="#d21034" d="M0 80h640v320H0z" />
      <circle fill="#ffcd00" cx="320" cy="240" r="80" />
      <path
        fill="#00a95c"
        d="M320 200c-22.1 0-40 17.9-40 40s17.9 40 40 40 40-17.9 40-40-17.9-40-40-40zm0 13.3c14.7 0 26.7 11.9 26.7 26.7s-11.9 26.7-26.7 26.7-26.7-11.9-26.7-26.7 11.9-26.7 26.7-26.7z"
      />
      <path
        fill="#ffcd00"
        d="M320 180l-8.7 26.8h-28.2l22.8 16.6-8.7 26.8 22.8-16.6 22.8 16.6-8.7-26.8 22.8-16.6h-28.2z"
      />
    </svg>
  );
}

export default createFlagComponent(MRSvg);
