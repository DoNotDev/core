// packages/core/i18n/src/flags/raw/flagAZ.tsx

/**
 * @fileoverview Azerbaijani Flag Component
 * @description React component for displaying the Azerbaijani flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagAZ.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function AZSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'AZ flag'}
      role="img"
    >
      <path fill="#3f9c35" d="M.1 0h640v480H.1z" />
      <path fill="#ed2939" d="M.1 0h640v320H.1z" />
      <path fill="#00b9e4" d="M.1 0h640v160H.1z" />
      <circle cx="304" cy="240" r="72" fill="#fff" />
      <circle cx="320" cy="240" r="60" fill="#ed2939" />
      <path
        fill="#fff"
        d="m384 200 7.7 21.5 20.6-9.8-9.8 20.7L424 240l-21.5 7.7 9.8 20.6-20.6-9.8L384 280l-7.7-21.5-20.6 9.8 9.8-20.6L344 240l21.5-7.7-9.8-20.6 20.6 9.8z"
      />
    </svg>
  );
}

export default createFlagComponent(AZSvg);
