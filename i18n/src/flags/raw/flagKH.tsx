// packages/core/i18n/src/flags/raw/flagKH.tsx

/**
 * @fileoverview Cambodian Flag Component
 * @description React component for displaying the Cambodian flag with customizable size and styling options.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createFlagComponent, type FlagSvgProps } from './FlagBase';

function KHSvg({ width, height, className = '', style, title }: FlagSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width={width}
      height={height}
      className={className}
      style={style}
      aria-label={title || 'KH flag'}
      role="img"
    >
      <path fill="#032ea1" d="M0 0h640v480H0z" />
      <path fill="#e00025" d="M0 123.4h640v233.1H0z" />
      <path
        fill="#fff"
        d="M374.2 163.7h11.9v2.5h-11.9zm-108.4 0h11.9v2.5h-11.9zm-46.7 4.7h202v78.2h-202z"
      />
      <path
        fill="#fff"
        d="M312.4 163.7h15.2v2.5h-15.2zm-2.4 87.2h20v2.4h-20z"
      />
      <path
        fill="none"
        stroke="#e00025"
        strokeWidth="2"
        d="M414.5 246.6h-189V174h189z"
      />
      <path
        fill="none"
        stroke="#e00025"
        strokeWidth="2.4"
        d="m320 206.5 21.6-41.2m0 0 21.5 41.2m-86.2 0 21.6-41.2m0 0 21.5 41.2m43.2 0 21.6-41.2m0 0 21.6 41.2"
      />
      <path
        fill="none"
        stroke="#e00025"
        strokeWidth="2"
        d="M255.4 206.5h129.2"
      />
      <path
        fill="#fff"
        d="m276.9 168.4-5.3 5.6h10.5zm43.1 0-5.2 5.6h10.4zm43.1 0-5.2 5.6h10.5zm45.3 78.2h15.9v2.4h-15.9zm-162.7 0h15.9v2.4h-15.9zm-13.2 3.8h195v16h-195z"
      />
      <path
        fill="none"
        stroke="#e00025"
        strokeWidth="2"
        d="M414.5 250.4h-189v16h189z"
      />
      <g fill="#e00025">
        <path d="M239.1 260h16.8v6.7h-16.8zm21.4 0h16.8v6.7h-16.8zm21.5 0h16.8v6.7H282zm21.4 0h16.9v6.7h-16.9zm21.5 0h16.8v6.7h-16.8zm21.4 0h16.8v6.7h-16.8zm21.5 0h16.8v6.7h-16.8zm21.4 0h16.8v6.7h-16.8z" />
        <path d="M225.5 250.4h14.4v16h-14.4zm174.6 0h14.4v16h-14.4z" />
      </g>
    </svg>
  );
}

export default createFlagComponent(KHSvg);
