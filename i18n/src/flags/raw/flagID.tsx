// packages/core/i18n/src/flags/raw/flagID.tsx

/**
 * @fileoverview Indonesian Flag Component
 * @description React component for displaying the Indonesian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagID.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function IDSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'ID flag'}
      role="img"
    >
      <path fill="#e70011" d="M0 0h640v240H0Z" />
      <path fill="#fff" d="M0 240h640v240H0Z" />
    </svg>
  );
}

export default createFlagComponent(IDSvg);
