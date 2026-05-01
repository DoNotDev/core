// packages/core/i18n/src/flags/raw/flagIR.tsx

/**
 * @fileoverview Iranian Flag Component
 * @description React component for displaying the Iranian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function IRSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'IR flag'}
      role="img"
    >
      <path fill="#239f40" d="M0 0h640v160H0z" />
      <path fill="#fff" d="M0 160h640v160H0z" />
      <path fill="#da0000" d="M0 320h640v160H0z" />
      <path
        fill="#da0000"
        d="M272.3 286.3c14.6-2 29.8 8.1 39.8 11.4 20-22.3 35.8-54 36.6-88.7-27.4 13.9-37.4 34.6-47.7 51.5 5.5-16.1 7.2-26.6-6-48.4-5.3 11-12.7 20.3-22.7 29.8-9-19.3-17.6-13.3-22.7-29.8 1.4 5.3 1 11.2-1.3 17-2.6 6.8-7.2 12.8-15.4 19.4 12.6 7.6 24.3 22.8 39.4 37.8zm39.6-114c-11.6 15.1-23.7 22-39.6 23.3-15.1-1.4-28-10.1-39.6-23.3 12.5-3.8 28.5 7.6 39.6 12 11.8-4.4 27.6-14.7 39.6-12z"
      />
      <path
        fill="#fff"
        d="M312 192.3c-2.4 8.7-4.8 18.2-4.9 18.2 0 0-2.5-9.4-4.9-18.2 1.4-.4 3.7-1.5 4.9-1.9 1.2.4 3.5 1.5 4.9 1.9z"
      />
      <g fill="#fff">
        <path d="M51.9 158.4h22.7V147H55.7v-2.8h18.9V142H51.9v16.4zm34.1 0H101v-2.2H89.8v-3.4H98v-2.2h-8.2V147H101v-2.2H86v13.6zm22.7-2.8V142h-3.8v13.6H114l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8z" />
        <path d="M198.8 152.1v2.3l-9.5 4-4.5-2v-2.3l3.2 1.5 5.8-2.5v-9h-1.2v8l-3.3 1.3-3.2-1.3V142h3.8v7.8l1.3.5 3.3-1.3V142h3.8l.5 10.1z" />
      </g>
      <g fill="#fff" transform="matrix(-1 0 0 1 640 0)">
        <path d="M51.9 158.4h22.7V147H55.7v-2.8h18.9V142H51.9v16.4zm34.1 0H101v-2.2H89.8v-3.4H98v-2.2h-8.2V147H101v-2.2H86v13.6zm22.7-2.8V142h-3.8v13.6H114l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8z" />
        <path d="M198.8 152.1v2.3l-9.5 4-4.5-2v-2.3l3.2 1.5 5.8-2.5v-9h-1.2v8l-3.3 1.3-3.2-1.3V142h3.8v7.8l1.3.5 3.3-1.3V142h3.8l.5 10.1z" />
      </g>
      <g fill="#fff" transform="matrix(1 0 0 -1 0 480)">
        <path d="M51.9 158.4h22.7V147H55.7v-2.8h18.9V142H51.9v16.4zm34.1 0H101v-2.2H89.8v-3.4H98v-2.2h-8.2V147H101v-2.2H86v13.6zm22.7-2.8V142h-3.8v13.6H114l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8z" />
        <path d="M198.8 152.1v2.3l-9.5 4-4.5-2v-2.3l3.2 1.5 5.8-2.5v-9h-1.2v8l-3.3 1.3-3.2-1.3V142h3.8v7.8l1.3.5 3.3-1.3V142h3.8l.5 10.1z" />
      </g>
      <g fill="#fff" transform="rotate(180 320 240)">
        <path d="M51.9 158.4h22.7V147H55.7v-2.8h18.9V142H51.9v16.4zm34.1 0H101v-2.2H89.8v-3.4H98v-2.2h-8.2V147H101v-2.2H86v13.6zm22.7-2.8V142h-3.8v13.6H114l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8zm22.7 0V142h-3.8v13.6h5.1l5-2.2v-2.3l-5.6 2.3h-1.2v-9h-1.3v11.2h4.5l-6.4 2.8z" />
        <path d="M198.8 152.1v2.3l-9.5 4-4.5-2v-2.3l3.2 1.5 5.8-2.5v-9h-1.2v8l-3.3 1.3-3.2-1.3V142h3.8v7.8l1.3.5 3.3-1.3V142h3.8l.5 10.1z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(IRSvg);
