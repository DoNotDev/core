// packages/core/i18n/src/flags/Flag.tsx

/**
 * @fileoverview Flag component for displaying country flags
 * @description Convenience component that renders country flags based on ISO country codes. Dynamically loads flag components from the raw flags directory.
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { lazy, Suspense } from 'react';
import type { LazyExoticComponent, ComponentType } from 'react';

import type { FlagBaseProps } from './raw/FlagBase';

const flagComponents: Record<
  string,
  LazyExoticComponent<ComponentType<FlagBaseProps>>
> = {};

function getFlagComponent(code: string) {
  const flagName = `flag${code.toUpperCase()}`;

  if (!flagComponents[flagName]) {
    flagComponents[flagName] = lazy(() => {
      return import(`./raw/${flagName}.tsx`).catch(() => {
        console.warn(`Flag not found: ${code}`);
        return { default: () => null };
      });
    });
  }

  return flagComponents[flagName];
}

function FlagPlaceholder({ className = '', style, title }: FlagBaseProps) {
  return (
    <div
      className={className}
      style={{
        width: 'var(--icon-md, 20px)',
        height: 'auto',
        aspectRatio: '4/3',
        backgroundColor: 'var(--muted)',
        borderRadius: 'var(--radius-sm, 2px)',
        ...style,
      }}
      title={title}
      aria-label={title || 'Loading flag'}
      role="img"
    />
  );
}

export function Flag({
  code,
  className,
  style,
  title,
}: { code: string } & FlagBaseProps) {
  const FlagComponent = getFlagComponent(code);

  return (
    <Suspense
      fallback={
        <FlagPlaceholder className={className} style={style} title={title} />
      }
    >
      <FlagComponent className={className} style={style} title={title} />
    </Suspense>
  );
}
