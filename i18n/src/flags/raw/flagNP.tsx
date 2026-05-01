// packages/core/i18n/src/flags/raw/flagNP.tsx

/**
 * @fileoverview Nepali Flag Component
 * @description React component for displaying the Nepali flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function NPSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'NP flag'}
      role="img"
    >
      <path fill="#003595" d="M0 0h640v480H0z" />
      <path fill="#dc143c" d="M35.6 447.6 350 263H128.8L402.6 30H0v417.6z" />
      <path
        fill="#fff"
        d="M96.6 360.2a67.6 67.6 0 1 1 113.8-31 67.6 67.6 0 0 1-113.8 31m111.9-204a62.8 62.8 0 0 1-111.3 22 62.8 62.8 0 0 1 106.8-22"
      />
      <path
        fill="#fff"
        d="M129.4 179.7c-5.8 28 20.2 13.9 22.8 20 2.2-6.5 28.5 7.6 22.8-20-.4 0-11-20.7-22.8-19.1-12.2-1.6-22.3 19-22.8 19.1z"
      />
    </svg>
  );
}

export default createFlagComponent(NPSvg);
