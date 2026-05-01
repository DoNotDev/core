// packages/core/i18n/src/flags/raw/flagBE.tsx

/**
 * @fileoverview Belgian Flag Component
 * @description React component for displaying the Belgian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function BESvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 900 780"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'BE flag'}
      role="img"
    >
      <path fill="#ef3340" d="M0 0h900v780H0z" />
      <path fill="#fdda25" d="M0 0h600v780H0z" />
      <path d="M0 0h300v780H0z" />
    </svg>
  );
}

export default createFlagComponent(BESvg);
