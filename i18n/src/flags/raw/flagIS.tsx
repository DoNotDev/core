// packages/core/i18n/src/flags/raw/flagIS.tsx

/**
 * @fileoverview Icelandic Flag Component
 * @description React component for displaying the Icelandic flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagIS.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ISSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'IS flag'}
      role="img"
    >
      <defs>
        <clipPath id="is-a">
          <path fillOpacity=".7" d="M0 0h640v480H0z" />
        </clipPath>
      </defs>
      <g fillRule="evenodd" strokeWidth="0" clipPath="url(#is-a)">
        <path fill="#003897" d="M0 0h666.7v480H0z" />
        <path
          fill="#fff"
          d="M0 186.7h186.7V0h106.6v186.7h373.4v106.6H293.3V480H186.7V293.3H0z"
        />
        <path
          fill="#d72828"
          d="M0 213.3h213.3V0h53.4v213.3h400v53.4h-400V480h-53.4V266.7H0z"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(ISSvg);
