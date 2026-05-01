// packages/core/i18n/src/flags/raw/flagBZH.tsx

/**
 * @fileoverview Brittany (Breton) Flag Component
 * @description React component for displaying the Brittany (Gwenn-ha-du) flag.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function BZHSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 1350 900"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'Brittany flag'}
      role="img"
    >
      <rect width="1350" height="900" fill="#fff" />
      <rect x="600" width="1350" height="100" fill="#000" />
      <rect x="600" y="200" width="1350" height="100" fill="#000" />
      <rect y="400" width="1350" height="100" fill="#000" />
      <rect y="600" width="1350" height="100" fill="#000" />
      <rect y="800" width="1350" height="100" fill="#000" />
      <use xlinkHref="#ermine" x="-225" y="-122.5" />
      <use xlinkHref="#ermine" x="-75" y="-122.5" />
      <use xlinkHref="#ermine" x="75" y="-122.5" />
      <use xlinkHref="#ermine" x="225" y="-122.5" />
      <use xlinkHref="#ermine" x="-150" />
      <g id="ermine" fill="#000">
        <use xlinkHref="#s" transform="rotate(-90 300,167.5)" />
        <path id="s" d="M 300,167.5 l -9,-13.5 l 9,-22.5 l 9,22.5 z" />
        <use xlinkHref="#s" transform="rotate(90 300,167.5)" />
        <path d="M 300,167.5 l 40.5,99 l -31.5,-13.5 l -9,18 l -9,-18 l -31.5,13.5 z" />
      </g>
      <use xlinkHref="#ermine" x="150" />
      <use xlinkHref="#ermine" x="-225" y="122.5" />
      <use xlinkHref="#ermine" x="-75" y="122.5" />
      <use xlinkHref="#ermine" x="75" y="122.5" />
      <use xlinkHref="#ermine" x="225" y="122.5" />
    </svg>
  );
}

export default createFlagComponent(BZHSvg);
