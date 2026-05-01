// packages/core/i18n/src/flags/raw/flagIN.tsx

/**
 * @fileoverview Indian Flag Component
 * @description React component for displaying the Indian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function INSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'IN flag'}
      role="img"
    >
      <path fill="#f93" d="M0 0h640v160H0z" />
      <path fill="#fff" d="M0 160h640v160H0z" />
      <path fill="#138808" d="M0 320h640v160H0z" />
      <g transform="translate(320 240) scale(148)">
        <circle r=".4" fill="#000088" />
        <path
          fill="#000088"
          d="m0 .4.1-.4zm.3.3.3-.3zm.3 0L.3.4zM0 .4l.2.4zM0 .4l.4.1zM0 .4l.4-.1zm.4-.2L0 .4zm.3-.3L.4.4zm-.1-.3-.2.3zm-.2-.2.1.2zm-.3-.1.1.2zm-.3 0 .1.2zM-.4 0l.2.1zM-.4 0l.2-.1zM-.4 0l.2-.2zm-.2-.2L-.4 0zm.1-.4L-.4 0zm.2-.3-.1.3zm.2-.2-.1.2zm.3-.1-.1.2zm0 0 .1-.2z"
        />
        <circle r=".15" fill="#fff" />
        <path
          fill="#000088"
          d="M0-.4 0 .4M.2-.4l-.4.8m.6-.7-.8.6m.9-.4-1 .2m1.1-.1-1.2-.2m1.2-.4-1.2.6m1-.8-.8 1m.6-1.1-.4 1.2M.4 0H-.4m.8.2L-.4-.2M.4.4 0-.4m-.2.8.4-.8m-.6.7.8-.6m-.9.4 1-.2m-1.1.1 1.2.2m-1.2.4 1.2-.6m-1 .8.8-1m-.6 1.1.4-1.2"
        />
      </g>
    </svg>
  );
}

export default createFlagComponent(INSvg);
