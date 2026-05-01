// packages/core/types/src/crud/components.ts

/**
 * @fileoverview CRUD Component Props Types
 * @description Shared prop types for CRUD components used across UI, Templates, and CRUD packages
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ReactNode } from 'react';

import type { AnyEntity, EntityRecord } from './schemas';
import type { QueryOptions } from './types';

/**
 * Shared base props for entity browsing components (table and card grid).
 * Both fetch the same data — just render differently based on entity field config.
 */
export interface EntityBrowseBaseProps {
  /** The entity definition */
  entity: AnyEntity;
  /**
   * Base path for view. Default: `/${collection}`. View = `${basePath}/${id}`.
   */
  basePath?: string;
  /**
   * Called when user clicks a row/card. If provided, overrides default navigation to basePath/:id (e.g. open sheet).
   */
  onClick?: (id: string) => void;
  /** Hide filters section (default: false) */
  hideFilters?: boolean;
  /** Current user role (for UI toggle only - backend enforces security) */
  userRole?: string;
  /** Optional query constraints (server-side filtering via adapter) */
  queryOptions?: QueryOptions;
  /** Cache stale time in ms */
  staleTime?: number;
  /**
   * Tone for the filter and results Section wrappers.
   * Use 'base' or 'muted' when the app has an image background so sections are readable.
   * @default 'ghost' (transparent — inherits parent background)
   */
  tone?: 'ghost' | 'base' | 'muted' | 'contrast' | 'accent';
  /**
   * Static data for design-time preview.
   * When provided, the component renders this data directly instead of
   * fetching from the CRUD backend. All interactive elements (edit, delete,
   * create, filters, favorites, navigation) are rendered but disabled.
   *
   * No CrudProvider or backend connection required.
   * Hooks are never called - rendering delegates to a standalone preview component.
   *
   * @example
   * ```tsx
   * // Design preview with mock data
   * <EntityCardList entity={productEntity} preview={mockProducts} />
   *
   * // Spec chat: entity generated from user description
   * <EntityList entity={specEntity} preview={generateMockData(specEntity, 6)} />
   * ```
   */
  preview?: (Record<string, unknown> & { id: string })[];
}

/** Props for the entity data table component with server/client pagination. */
export interface EntityListProps extends EntityBrowseBaseProps {
  /**
   * Pagination mode:
   * - `'auto'` (default) — fetches up to 1000 client-side. Auto-switches to server if total > 1000.
   * - `'client'` — forces client-side (all data in memory, instant search/sort/filter).
   * - `'server'` — forces server-side (cursor pagination, one page at a time).
   */
  pagination?: 'auto' | 'client' | 'server';
  /** Page size - passed to DataTable. If not provided, DataTable uses its default (12) */
  pageSize?: number;
  /**
   * Enable export to CSV functionality
   * @default true (admin tables typically need export)
   */
  exportable?: boolean;
}

/** Props for the entity card grid component with filtering and sorting. */
export interface EntityCardListProps extends EntityBrowseBaseProps {
  /** Grid columns (responsive) - defaults to [1, 2, 3, 4] */
  cols?: number | [number, number, number, number];
  /** Optional filter function to filter items client-side */
  filter?: (item: Record<string, unknown> & { id: string }) => boolean;
  /**
   * Custom label for the results section title.
   * Receives the current item count so you can handle pluralization and empty state.
   * When not provided, defaults to the built-in i18n label ("Found N occurrences").
   *
   * @param count - Number of items after all filters are applied
   * @returns The string to display as the results section title
   *
   * @example
   * ```tsx
   * // Simple override
   * <EntityCardList
   *   entity={apartmentEntity}
   *   resultLabel={(count) =>
   *     count === 0
   *       ? 'No apartments available'
   *       : count === 1
   *         ? 'Your future home is right here'
   *         : `Your future home is among these ${count} apartments`
   *   }
   * />
   * ```
   */
  resultLabel?: (count: number) => string;
  /** Render a custom overlay on each card (e.g. status stamp). Receives the item. */
  renderCardOverlay?: (item: EntityRecord & { id: string }) => ReactNode;
  /** Client-side sort: field config, comparator function, or null to disable. Defaults to entity.defaultSort. */
  clientSort?:
    | { field: string; direction?: 'asc' | 'desc' }
    | ((a: any, b: any) => number)
    | null;
  /** Make filter/results sections collapsible. @default false */
  collapsible?: boolean;
  /** Initial open state when collapsible. Only relevant when `collapsible` is true. */
  defaultOpen?: boolean;
}

/**
 * Props for CrudCard — presentational card built from entity + item + field slots.
 * Not route-aware: parent (e.g. EntityCardList) provides detailHref or onClick.
 * For a11y/SEO prefer detailHref so the card is wrapped in a Link.
 */
export interface CrudCardProps {
  /** The list item (must have id) */
  item: EntityRecord & { id: string };
  /** The entity definition (for entity.fields and formatting) */
  entity: AnyEntity;
  /**
   * Called when card is clicked (e.g. open sheet instead of navigating).
   * Navigation via Link is handled by the parent wrapper (CrudCardLink), not by CrudCard itself.
   */
  onClick?: (id: string) => void;
  /** Field names for card title (values joined with space) */
  titleFields?: string[];
  /** Field names for subtitle */
  subtitleFields?: string[];
  /** Field names for content body (label + value rows) */
  contentFields?: string[];
  /** Field names for footer */
  footerFields?: string[];
  /** When true, show delete button with confirm dialog */
  showDelete?: boolean;
  /** Optional actions slot (e.g. favorites heart) rendered in card corner */
  renderActions?: ReactNode;
  /** Optional overlay rendered over the full image area (position absolute, centered, pointer-events none) */
  renderOverlay?: ReactNode;
  /** Optional className for the card wrapper */
  className?: string;
}

/** Props for the entity form renderer with create/edit modes, validation, and navigation. */
export interface EntityFormRendererProps<
  T extends EntityRecord = EntityRecord,
> {
  /** Entity definition - pass the full entity from defineEntity() */
  entity: AnyEntity;
  /** Form submission handler */
  onSubmit: (data: T) => void | Promise<void>;
  /** Translation function */
  t?: (key: string, options?: Record<string, unknown>) => string;
  /** Additional CSS classes */
  className?: string;
  /** Submit button text */
  submitText?: string;
  /**
   * Whether form data is loading (shows loading overlay)
   * Use this when fetching existing entity data for edit mode
   */
  loading?: boolean;
  /** Initial form values */
  defaultValues?: Partial<T>;
  /** Submit button variant */
  submitVariant?: 'primary' | 'destructive' | 'outline' | 'ghost' | 'link';
  /** Secondary button text */
  secondaryButtonText?: string;
  /** Secondary button variant */
  secondaryButtonVariant?:
    | 'primary'
    | 'destructive'
    | 'outline'
    | 'ghost'
    | 'link';
  /** Secondary button submission handler */
  onSecondarySubmit?: (data: T) => void | Promise<void>;
  /**
   * Current viewer's role for editability checks.
   * Auto-detected from auth when not provided. Pass explicitly to override (e.g. View-As preview).
   * Fallback chain: prop → useAuthSafe('userRole') → 'guest'
   */
  viewerRole?: string;
  /**
   * Form operation type
   * @default 'create' (or 'edit' if defaultValues provided)
   */
  operation?: 'create' | 'edit';
  /**
   * Optional form ID for tracking loading state.
   * If not provided, one will be generated automatically.
   */
  formId?: string;
  /**
   * Cancel button text. If provided, shows a cancel button.
   * If not provided but onCancel is provided, shows default "Cancel" text.
   * Set to null to explicitly hide cancel button.
   */
  cancelText?: string | null;
  /**
   * Success path - full path to navigate after successful submit (e.g., `/products`).
   * If not provided, stays on page (edit) or relies on onSubmit to navigate (create).
   */
  successPath?: string;
  /**
   * Cancel path - full path (e.g., `/products`). If not provided, navigates back.
   * If onCancel callback is provided, it takes precedence over cancelPath.
   */
  cancelPath?: string;
  /**
   * Callback when cancel is clicked (after confirmation if dirty).
   * If not provided, cancel navigates to cancelPath or `/${collection}`.
   * If provided, cancel button will show (with cancelText or default "Cancel").
   */
  onCancel?: () => void;
  /**
   * Hide visibility indicators (badges + View As toggle).
   * When false (default), shows badge next to non-guest fields and View As role selector.
   * @default false
   */
  hideVisibilityInfo?: boolean;

  /**
   * Explicit form instance key for isolation between records.
   * When provided, React remounts the form whenever this value changes —
   * ensuring clean state when navigating between entities (e.g. `/cars/:id`).
   *
   * Pass the route ID: `instanceKey={id}`
   *
   * @example
   * ```tsx
   * // Automatically isolates form state per car — no manual reset needed
   * <EntityFormRenderer entity={carEntity} instanceKey={id} defaultValues={carData} />
   * ```
   */
  instanceKey?: string;
}

/** Props for the entity recommendations section (e.g. "Similar items"). */
export interface EntityRecommendationsProps {
  /** The entity definition */
  entity: AnyEntity;
  /** Query constraints — caller defines "related by what" (where, limit, etc.) */
  queryOptions: QueryOptions;
  /** Section title (e.g. "Similar apartments") */
  title?: string;
  /** Base path for card links. Default: `/${entity.collection}` */
  basePath?: string;
  /** Grid columns — default `[1,1,3,3]` */
  cols?: number | [number, number, number, number];
  /**
   * Tone for the Section wrapper.
   * Use 'base' or 'muted' when the app has an image background so the section is readable.
   * @default 'ghost' (transparent — inherits parent background)
   */
  tone?: 'ghost' | 'base' | 'muted' | 'contrast' | 'accent';
  /** Additional className on wrapper Section */
  className?: string;
}

/** Props for the read-only entity detail renderer with role-based visibility. */
export interface EntityDisplayRendererProps<
  T extends EntityRecord = EntityRecord,
> {
  /** Entity definition - pass the full entity from defineEntity() */
  entity: AnyEntity;
  /** Entity ID to fetch. Not required when `preview` is provided. */
  id?: string;
  /** Translation function (optional - auto-generated if not provided) */
  t?: (key: string, options?: Record<string, unknown>) => string;
  /** Additional CSS classes */
  className?: string;
  /** Custom loading message */
  loadingMessage?: string;
  /** Custom not found message */
  notFoundMessage?: string;
  /**
   * Current viewer's role for visibility checks.
   * Auto-detected from auth when not provided. Pass explicitly to override.
   * Fallback chain: prop → useAuthSafe('userRole') → 'guest'
   */
  viewerRole?: string;
  /**
   * Field names to exclude from rendering.
   * Use when the page already displays certain fields in a custom hero/header section.
   */
  excludeFields?: string[];
  /**
   * Static data for design-time preview.
   * When provided, renders this record directly instead of fetching by id.
   * The `id` prop becomes unnecessary (ignored when preview is set).
   *
   * @example
   * ```tsx
   * <EntityDisplayRenderer entity={productEntity} preview={mockProduct} />
   * ```
   */
  preview?: Partial<T>;
}
