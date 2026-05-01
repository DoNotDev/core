// packages/core/i18n/src/flags/raw/flagAU.tsx

/**
 * @fileoverview Australian Flag Component
 * @description React component for displaying the Australian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/flagAU.tsx

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function AUSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'AU flag'}
      role="img"
    >
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#FFF"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z"
      />
      <path
        fill="#C8102E"
        d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"
      />
      <path fill="#FFF" d="M241 0v480h160V0zM0 160v160h640V160z" />
      <path fill="#C8102E" d="M0 193v96h640v-96zM273 0v480h96V0z" />
      <path fill="#012169" d="M0 0l320 240L0 480zm640 0L320 240l320 240z" />
      <path
        fill="#FFF"
        d="m171 286.7 20.6 63.4 53.4-38.8-33 51.1 53.4-38.8-66.4 2.1 20.6 63.4-20.6-63.4-66.4 2.1 53.4 38.8-33-51.1z"
      />
      <path
        fill="#FFF"
        d="m396.8 91.4 13.7 42.3 35.6-25.9-22 34.1 35.6-25.9-44.3 1.4 13.7 42.3-13.7-42.3-44.3 1.4 35.6 25.9-22-34.1z"
      />
      <path
        fill="#FFF"
        d="m430.4 328.6 13.7 42.3 35.6-25.9-22 34.1 35.6-25.9-44.3 1.4 13.7 42.3-13.7-42.3-44.3 1.4 35.6 25.9-22-34.1z"
      />
      <path
        fill="#FFF"
        d="m488.2 209.7 13.7 42.3 35.6-25.9-22 34.1 35.6-25.9-44.3 1.4 13.7 42.3-13.7-42.3-44.3 1.4 35.6 25.9-22-34.1z"
      />
      <path
        fill="#FFF"
        d="m351.8 251 13.7 42.3 35.6-25.9-22 34.1 35.6-25.9-44.3 1.4 13.7 42.3-13.7-42.3-44.3 1.4 35.6 25.9-22-34.1z"
      />
    </svg>
  );
}

export default createFlagComponent(AUSvg);
