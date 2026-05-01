// packages/core/i18n/src/flags/raw/flagBN.tsx

/**
 * @fileoverview Brunei Flag Component
 * @description React component for displaying the Brunei flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function BNSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'BN flag'}
      role="img"
    >
      <defs>
        <path
          id="bn-a"
          fill="#da291c"
          d="m109.1 193.3-33-14.7 16-35.8 33 14.7zm65.6-25-33.3-14.2-15.1 35.3 33.3 14.2z"
        />
      </defs>
      <path fill="#f7e017" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M43.7 0H157l483 234.9V339z" />
      <path d="M0 141.1V245L535.4 480h104.5z" />
      <g fill="#da291c" transform="matrix(1.65625 0 0 1.65625 210.5 137.9)">
        <use xlinkHref="#bn-a" width="100%" height="100%" />
        <use
          xlinkHref="#bn-a"
          width="100%"
          height="100%"
          transform="matrix(-1 0 0 1 133 0)"
        />
        <path d="M66.1 127.3c-23-22-26.6-56.7-4.4-80 23.4-24.6 57.3-26.7 82-2.5-12.7-5.1-33.4-1.7-41 12.3-7.5 13.7.8 28.5 7.9 33.5-13.4-6-29.4 6-27.5 18a47.3 47.3 0 0 0 17.5 13c-14.2-4.2-22.3 2.1-34.5 5.7" />
        <path d="M66 123c-7-4.1-13-17.7-13-17.7 2.3-1.6 6-1.5 8 0s1.8 4 1.2 5.5c2 4.3 3.8 12.2 3.8 12.2" />
        <path d="M63.6 109.6s.4-4.8-1.5-6.6c2.2-.6 6 .2 7 2.6zM69 32h-5v55.3h5z" />
        <path
          fill="#f7e017"
          d="M32.6 121s11.2-12.7 34.6 0c0 0-7.3-3.7-17-3-9.5.7-17.6 3-17.6 3"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(BNSvg);
