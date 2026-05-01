// packages/core/i18n/src/flags/raw/flagBY.tsx

/**
 * @fileoverview Belarusian Flag Component
 * @description React component for displaying the Belarusian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function BYSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'BY flag'}
      role="img"
    >
      <path fill="#ce1126" d="M0 0h640v320H0z" />
      <path fill="#009e60" d="M0 320h640v160H0z" />
      <path fill="#fff" d="M0 0h106.7v480H0z" />
      <g fill="#ce1126">
        <path d="M42 480 0 448l16-16L0 416l16-16L0 384l16-16L0 352l16-16L0 320l16-16L0 288l16-16L0 256l16-16L0 224l16-16L0 192l16-16L0 160l16-16L0 128l16-16L0 96l16-16L0 64l16-16L0 32l16-16L0 0l42 42L84 0l16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16-16 16 16 16L84 480z" />
        <path d="M53.3 358.5 35.8 376l17.5 17.5 17.5-17.5zm0-96L35.8 280l17.5 17.5 17.5-17.5zm0-96L35.8 184l17.5 17.5 17.5-17.5zm0-96L35.8 88l17.5 17.5 17.5-17.5zm0 336 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7zm0-48 4.7 4.7 4.6-4.7-4.6-4.7z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(BYSvg);
