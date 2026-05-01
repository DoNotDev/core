// packages/core/i18n/src/flags/raw/flagET.tsx

/**
 * @fileoverview Ethiopia Flag Component
 * @description React component for displaying the Ethiopia flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ETSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 1200 600"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'ET flag'}
      role="img"
    >
      <path fill="#da121a" d="M0 0H1200V600H0z" />
      <path fill="#fcdd09" d="M0 0H1200V400H0z" />
      <path fill="#078930" d="M0 0H1200V200H0z" />
      <g transform="matrix(1.6666667,0,0,1.6666667,600,300)">
        <circle r="120" fill="#0f47af" />
        <g id="a">
          <path
            d="m 0,-96 -4.205849,12.944272 17.347494,53.390097 H -9.987258 l -2.599358,8 h 74.162668 l 11.011056,-8 H 21.553343 Z"
            fill="#fcdd09"
          />
          <path
            d="M 0,44 V 96"
            transform="rotate(-144)"
            stroke="#fcdd09"
            strokeWidth="4"
          />
        </g>
        <use xlinkHref="#a" transform="rotate(72)" width="100%" height="100%" />
        <use
          xlinkHref="#a"
          transform="rotate(144)"
          width="100%"
          height="100%"
        />
        <use
          xlinkHref="#a"
          transform="rotate(-144)"
          width="100%"
          height="100%"
        />
        <use
          xlinkHref="#a"
          transform="rotate(-72)"
          width="100%"
          height="100%"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(ETSvg);
