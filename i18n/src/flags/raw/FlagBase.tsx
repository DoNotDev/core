// packages/core/i18n/src/flags/raw/FlagBase.tsx

/**
 * @fileoverview Flag Base Component Factory
 * @description Base component factory and type definitions for creating flag components with consistent sizing and styling.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// packages/assets/flags/raw/FlagBase.tsx

/**
 * Props for flag base components
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FlagBaseProps {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * Props for flag SVG components
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FlagSvgProps {
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * Creates a flag component with consistent sizing
 *
 * Uses CSS variables for sizing:
 * - Default: 20px (var(--icon-md)) when next to label
 * - Standalone: 48px (var(--icon-touch)) when alone
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createFlagComponent(
  SvgComponent: React.ComponentType<FlagSvgProps>,
  customAspectRatio?: string
) {
  return function Flag({ className = '', style, title }: FlagBaseProps) {
    const defaultDimension = 20;
    const defaultHeight = Math.round(defaultDimension * 0.75);

    return (
      <SvgComponent
        width={defaultDimension}
        height={defaultHeight}
        className={className}
        style={{
          width: 'var(--icon-md, 20px)',
          height: 'auto',
          aspectRatio: customAspectRatio || '4/3',
          ...style,
        }}
        title={title}
      />
    );
  };
}
