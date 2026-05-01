// packages/core/i18n/src/flags/raw/flagLK.tsx

/**
 * @fileoverview Sri Lankan Flag Component
 * @description React component for displaying the Sri Lankan flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function LKSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'LK flag'}
      role="img"
    >
      <path fill="#ffbe29" d="M0 0h640v480H0z" />
      <path fill="#8d153a" d="M194.7 26.5h418.9v427H194.7z" />
      <path fill="#eb7400" d="M26.5 26.5h62.6v427H26.5z" />
      <path fill="#00534e" d="M109 26.5h62.5v427H109z" />
      <path
        fill="#ffbe29"
        d="m461.5 86-30.8 54.7 51.5-23.9zm-155.1 41.5 54.8 19.3-39.2 44.5zm0 183.3 15.6-59.8 44.4 39.3zm195.8 45 39.8-44-55.3-17.8z"
      />
      <g transform="scale(7.53)">
        <path
          fill="#ffbe29"
          d="M56.4 34.6c-1.3-.3-2.6-.5-4.1-.2 1.8 1.4 3.1 3.5 3.1 5.6 0 1.2-.4 2.1-1.2 3.1-4.7-3.7-6.5-1.1-7.2.9-.6 1.8.8 2.6-.8 3.5-3.3 1.9-5.1.8-6.1-.2-.5-1-.5-2.2-.6-3.7-.1-1.8 0-3.6.1-5.3-1.6.4-3.1 1.2-4.3 2.1-.2.2-.6.7-.4.9.4.5 1.6 0 1.9-.3 2.1-1.7 4.5-2.1 7.2-2 1.4 0 2.2.1 3.5.3 1.2.2 2.4.6 3.5 1 .9.3 2.3 2.1 3.7 1.5.8-.3 1.5-.7 2.1-1.3-.2 1.1-.3 2.2-.6 3.2-.8 3.3-3.1 4.3-5.5 3.9l-.3 1c3.5.6 6.1-2 7.1-7 .5-2.2.5-4.2-.2-6.2-.2-.5-.4-.9-.8-1.1zm-8 4.2c-.3 1-.7 2-1 2.9.8.9 1.4 1 2.3.8.3-.7.5-1.5.6-2.5-.5-.4-1.2-.8-1.9-1.2z"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(LKSvg);
