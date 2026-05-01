// packages/core/i18n/src/flags/raw/flagUS.tsx

/**
 * @fileoverview United States Flag Component
 * @description React component for displaying the United States flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagUS.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function USSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 7410 3900"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'US flag'}
      role="img"
    >
      <path d="M0,0h7410v3900H0" fill="#b31942" />
      <path
        d="M0,450H7410m0,600H0m0,600H7410m0,600H0m0,600H7410m0,600H0"
        stroke="#FFF"
        strokeWidth="300"
      />
      <path d="M0,0h2964v2100H0" fill="#0a3161" />
      <g fill="#FFF">
        <g id="s18">
          <g id="s9">
            <g id="s5">
              <g id="s4">
                <path
                  id="s"
                  d="M247,90 317.534230,307.082039 132.873218,172.917961H361.126782L176.465770,307.082039z"
                />
                <use xlinkHref="#s" y="420" />
                <use xlinkHref="#s" y="840" />
                <use xlinkHref="#s" y="1260" />
              </g>
              <use xlinkHref="#s" y="1680" />
            </g>
            <use xlinkHref="#s4" x="247" y="210" />
          </g>
          <use xlinkHref="#s9" x="494" />
        </g>
        <use xlinkHref="#s18" x="988" />
        <use xlinkHref="#s9" x="1976" />
        <use xlinkHref="#s5" x="2470" />
      </g>
    </svg>
  );
}

// US flag official ratio is 1.9:1 (not 4:3 like most flags)
export default createFlagComponent(USSvg, '1.9/1');
