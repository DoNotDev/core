// packages/core/i18n/src/flags/raw/flagOC.tsx

/**
 * @fileoverview Occitan Flag Component
 * @description React component for displaying the Occitan flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagOC.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function OCSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'OC flag'}
      role="img"
    >
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#000091" d="M0 0h213.3v480H0z" />
      <path fill="#e1000f" d="M426.7 0H640v480H426.7z" />
    </svg>
  );
}

export default createFlagComponent(OCSvg);
