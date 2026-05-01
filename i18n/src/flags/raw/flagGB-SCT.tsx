// packages/core/i18n/src/flags/raw/flagGB-SCT.tsx

/**

 * @fileoverview Scotland Flag Component

 * @description React component for displaying the Scotland flag with customizable size and styling options.

 *

 * @version 0.1.0

 * @since 0.0.1

 * @author AMBROISE PARK Consulting

 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function GBSCTSvg({
  width,
  height,
  className = '',
  style,
  title,
}: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'Scotland flag'}
      role="img"
    >
      <path fill="#0065bd" d="M0 0h640v480H0z" />

      <path
        stroke="#fff"
        strokeWidth=".6"
        d="m0 0 5 3M0 3l5-3"
        transform="scale(128 160)"
      />
    </svg>
  );
}

export default createFlagComponent(GBSCTSvg);
