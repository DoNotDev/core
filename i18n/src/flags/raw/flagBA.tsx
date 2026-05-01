// packages/core/i18n/src/flags/raw/flagBA.tsx

/**
 * @fileoverview Bosnian Flag Component
 * @description React component for displaying the Bosnian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function BASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 16 8"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'BA flag'}
      role="img"
    >
      <rect width="16" height="8" fill="#002395" />
      <path d="m4.24 0h8v8z" fill="#fecb00" />
      <g id="g">
        <path
          d="M2.353283.5248529 2.8-.85 3.246717.524853 2.077197-.324853H3.522803z"
          fill="#fff"
          id="s"
        />
        <use xlinkHref="#s" x="1" y="1" />
        <use xlinkHref="#s" x="2" y="2" />
      </g>
      <use xlinkHref="#g" x="3" y="3" />
      <use xlinkHref="#g" x="6" y="6" />
    </svg>
  );
}

export default createFlagComponent(BASvg);
