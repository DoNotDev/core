// packages/core/i18n/src/flags/raw/flagZH.tsx

/**
 * @fileoverview Chinese Flag Component
 * @description React component for displaying the Chinese flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagZH.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ZHSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'ZH flag'}
      role="img"
    >
      <defs>
        <path id="cn-a" fill="#ff0" d="M-.6.8 0-1 .6.8-1-.3h2z" />
      </defs>
      <path fill="#ee1c25" d="M0 0h640v480H0z" />
      <use
        xlinkHref="#cn-a"
        width="30"
        height="20"
        transform="matrix(71.9991 0 0 72 120 120)"
      />
      <use
        xlinkHref="#cn-a"
        width="30"
        height="20"
        transform="matrix(-12.33562 -20.5871 20.58684 -12.33577 240.3 48)"
      />
      <use
        xlinkHref="#cn-a"
        width="30"
        height="20"
        transform="matrix(-3.38573 -23.75998 23.75968 -3.38578 288 95.8)"
      />
      <use
        xlinkHref="#cn-a"
        width="30"
        height="20"
        transform="matrix(6.5991 -23.0749 23.0746 6.59919 288 168)"
      />
      <use
        xlinkHref="#cn-a"
        width="30"
        height="20"
        transform="matrix(14.9991 -18.73557 18.73533 14.99929 240 216)"
      />
    </svg>
  );
}

export default createFlagComponent(ZHSvg);
