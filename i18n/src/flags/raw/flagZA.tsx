// packages/core/i18n/src/flags/raw/flagZA.tsx

/**
 * @fileoverview South African Flag Component
 * @description React component for displaying the South African flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function ZASvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'ZA flag'}
      role="img"
    >
      <path fill="#000000" d="M0 0h640v480H0z" />
      <path fill="#00aa4c" d="M0 0h640v480H0z" />
      <path fill="#e1251b" d="M0 0h640v160H0z" />
      <path fill="#004692" d="M0 320h640v160H0z" />
      <path fill="#fff" d="M0 0v480l240-240L0 0z" />
      <path fill="#000" d="M0 60v360l180-180L0 60z" />
      <path
        fill="#ffb81c"
        d="M0 60v360l180-180L0 60z"
        transform="translate(15) scale(.85)"
      />
      <path fill="#000" d="M0 0v480h60v-6L254 240 60 46v-46H0z" />
      <path fill="#00aa4c" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M640 320H332.2L126.6 480H0v-30.7L258 280H640v40z" />
      <path fill="#fff" d="M640 160H332.2L126.6 0H0v30.7L258 200H640v-40z" />
      <path fill="#e1251b" d="M0 0h640v160H0z" />
      <path fill="#004692" d="M0 320h640v160H0z" />
      <path
        fill="#fcb514"
        d="M0 67.2 201.1 240 0 412.8V350l128-110L0 130V67.2z"
      />
      <path fill="#000" d="M0 80v320l186.2-160L0 80z" />
    </svg>
  );
}

export default createFlagComponent(ZASvg);
