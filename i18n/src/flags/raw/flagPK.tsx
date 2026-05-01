// packages/core/i18n/src/flags/raw/flagPK.tsx

/**
 * @fileoverview Pakistani Flag Component
 * @description React component for displaying the Pakistani flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function PKSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'PK flag'}
      role="img"
    >
      <path fill="#01411c" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M0 0h160v480H0z" />
      <g transform="translate(352 248.9) scale(11.23596)">
        <path
          fill="#fff"
          d="M8.8 12.3c2.7-3.2 4.1-7.1 3.7-11.3-3.7 9.8-15.1 14.5-24.9 10.8-7.8-2.9-12.8-10.4-12.7-18.7-2.6 2.7-4.1 6.3-4.1 10.3 0 8.2 6.7 14.9 14.9 14.9 8.8 0 16.7-2 23.1-6"
        />
        <path
          fill="#fff"
          d="M4.6-9.1 0-7.3l1.1-4.7-4.2-2.3 4.7-1L.2-19.6l3.3 3.6 4.7-1.4-2.8 3.9 3.2 3.6z"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(PKSvg);
