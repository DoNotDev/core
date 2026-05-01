// packages/core/i18n/src/flags/raw/flagSV.tsx

/**
 * @fileoverview Swedish Flag Component
 * @description React component for displaying the Swedish flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagSV.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function SVSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'SV flag'}
      role="img"
    >
      <path fill="#005293" d="M0 0h640v480H0z" />
      <path fill="#fecb00" d="M176 0v192H0v96h176v192h96V288h368v-96H272V0z" />
    </svg>
  );
}

export default createFlagComponent(SVSvg);
