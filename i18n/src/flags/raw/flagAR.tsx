// packages/core/i18n/src/flags/raw/flagAR.tsx

/**
 * @fileoverview Argentine Flag Component
 * @description React component for displaying the Argentine flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagAR.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ARSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'AR flag'}
      role="img"
    >
      <path fill="#74acdf" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M0 160h640v160H0z" />
      <g transform="translate(320 240)">
        <circle r="45" fill="#f6b40e" stroke="#85340a" strokeWidth="1.5" />
        <circle r="40" fill="#f6b40e" />
        <g fill="#85340a">
          <path d="M0-35l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M0 35l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-35 0l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M35 0l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-25-25l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M25 25l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M25-25l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-25 25l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-18-30l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M18 30l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M18-30l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-18 30l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-30-18l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M30 18l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M30-18l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
          <path d="M-30 18l3 9h10l-8 6 3 9-8-6-8 6 3-9-8-6h10z" />
        </g>
        <circle r="12" fill="#85340a" />
      </g>
    </svg>
  );
}

export default createFlagComponent(ARSvg);
