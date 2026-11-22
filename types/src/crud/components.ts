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

import type { CreateInput, FieldOperation, FormValues } from './fieldSemantics';
import type { AnyEntity, EntityRecord, InferEntityRow } from './schemas';
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
  /**
   * Edit the list in place, spreadsheet-style: list fields of type text, email,
   * url, tel, textarea, number, select, radio and reference are edited in their
   * cells (references and selects as dropdowns), checked rows take one value
   * for a field at once, blocks paste from Excel / Sheets. Fields the viewer may
   * not edit (`editable`) stay read-only. Save writes every change in one
   * `useCrud().bulk({ updates })`. Rows open from the leading open-link icon
   * (a row click edits). Opt out with `editable={false}`: a read-only list
   * (read-only cells, no Add, no row selection, no delete; a row click opens
   * the record).
   * @default true
   * @since 0.2.3
   */
  editable?: boolean;
  /**
   * Nested list of one parent's children (e.g. the products of a brand on the
   * brand page): lists only rows whose `field` equals `value`, hides that column
   * and filter, and the add button opens the create form with `field` prefilled
   * (`EntityFormRenderer` reads it from the URL). `field` must be a `reference`
   * field of the entity.
   *
   * **Joined to the parent's form:** when the list is `editable` (default) and an
   * edit form (`useEntityForm` / `EntityFormRenderer`) is open on the parent
   * record, the rows join it
   * (`useChildRows`): no own Save, deletes wait for the form's Save, pending
   * counts and Discard are shown, and the form's Save writes the rows with the
   * record. Add opens a picker for link tables (one reference besides the
   * parent's), else adds a blank row. Without such a form, or with
   * `editable={false}`: the behaviour above.
   *
   * `value: null` (parent not created yet): the list only shows "Create the
   * draft before adding …".
   * @example
   * ```tsx
   * <EntityList entity={productEntity} basePath="/produits" parent={{ field: 'brandId', value: brandId }} />
   * ```
   * @since 0.2.3
   */
  parent?: EntityListParent;
  /**
   * App columns after the entity's list fields, rendered from the row with its
   * unsaved edits applied (computed values: totals, prices from another field).
   * Web only: the Expo `EntityList` throws when given.
   * @since 0.2.5
   */
  extraColumns?: EntityListExtraColumn[];
  /**
   * App content of the list's toolbar (e.g. "Add the brand's products"). It can
   * call `useChildRows` on the same entity and parent to act on the same rows.
   * Web only: the Expo `EntityList` throws when given.
   * @since 0.2.5
   */
  actions?: ReactNode;
  /**
   * 1:1 extensions of the listed records (a record split across two tables, e.g.
   * products + product_offers): read in one batched query, shown as extra columns
   * (the extension entity's list fields, prefixed `key.`), edited in their cells
   * and written with the rows. The list is then a display of `useChildRows`
   * (joined to the parent's open form, or standalone with its own Save; deletes
   * wait for that Save). A viewer without read access to an extension entity gets
   * none of its columns. Web only: the Expo `EntityList` throws when given.
   * @example
   * ```tsx
   * <EntityList entity={productEntity} extend={{ offer: { entity: productOfferEntity, field: 'productId' } }} />
   * ```
   * @since 0.2.5
   */
  extend?: EntityExtensions;
}

/**
 * A 1:1 extension of an entity: another entity whose `field` references the
 * extended record (one extension row per record, e.g. `productOffers.productId`).
 */
export interface EntityExtension {
  /** The extension entity (from `defineEntity`) */
  entity: AnyEntity;
  /** Its reference field pointing at the extended record */
  field: string;
}

/**
 * Extensions keyed by the name their fields are addressed under: `offer` →
 * `row.offer.priceExclVat`, form / cell / draft field `offer.priceExclVat`.
 * Keys must not contain `.` nor equal a field of the extended entity.
 */
export type EntityExtensions = Record<string, EntityExtension>;

/** Parent of a nested `EntityList`: the reference field and the parent record id. */
export interface EntityListParent {
  /** Reference field of the listed entity pointing at the parent (e.g. `'brandId'`) */
  field: string;
  /**
   * Parent record id, or `null` while the parent is not created yet (create
   * page): the list then only shows "Create the draft before adding …".
   */
  value: string | null;
}

/** An app column of `EntityList` (`extraColumns`). */
export interface EntityListExtraColumn {
  /** Unique column key (not an entity field name) */
  key: string;
  /** Column header (translated by the app) */
  title: string;
  /** Cell content, from the row with its unsaved edits applied */
  render: (row: EntityRecord & { id: string }) => ReactNode;
  /** Logical alignment (`end` for numbers). @default 'start' */
  align?: 'start' | 'center' | 'end';
}

/** Props for the entity card grid component with filtering and sorting. */
export interface EntityCardListProps extends EntityBrowseBaseProps {
  /** Grid columns (responsive) - defaults to [1, 2, 3, 4] */
  cols?: number | [number, number, number, number];
  /**
   * Opt-in feed rendering (web): render this many cards first (server HTML included),
   * then this many more each time the end of the grid nears the viewport, until every
   * card is shown. Data is still fetched in one go; this only cuts the cards rendered
   * and hydrated up front, and cards past the first page are not in the server HTML.
   * Omitted: every card renders at once.
   */
  pageSize?: number;
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
 * Not route-aware: parent (e.g. EntityCardList) passes `href` (real link, a11y/SEO) or onClick.
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
  /**
   * Detail page URL: the card renders a real `<a href>` (crawlable, client-side
   * navigation through the app router). Takes precedence over `onClick`.
   */
  href?: string;
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

/**
 * `defaultValues` of an entity form: the stored row on edit (accepted as-is,
 * {@link InferEntityRow}), create defaults on create (`Partial<CreateInput<E>>`).
 * Either when the operation is not known statically.
 *
 * @template E - Entity type from defineEntity()
 * @template Op - Form operation
 *
 * @version 0.1.0
 * @since 0.2.5
 * @author AMBROISE PARK Consulting
 */
export type EntityFormDefaultValues<
  E extends AnyEntity,
  Op extends FieldOperation = FieldOperation,
> = [Op] extends ['edit']
  ? InferEntityRow<E>
  : [Op] extends ['create']
    ? Partial<CreateInput<E>>
    : InferEntityRow<E> | Partial<CreateInput<E>>;

/**
 * Props for the entity form renderer with create/edit modes, validation, and navigation.
 *
 * @template E - Entity from `defineEntity()` (inferred from `entity`)
 * @template Op - Form operation (inferred from `operation`; both when omitted)
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EntityFormRendererProps<
  E extends AnyEntity = AnyEntity,
  Op extends FieldOperation = FieldOperation,
> {
  /** Entity definition - pass the full entity from defineEntity() */
  entity: E;
  /**
   * Form submission handler: writes the record. Omit it to use the default
   * writer: `useEntityForm`'s `handleSubmit()` saves the record (update, or add
   * on create) with the fields the entity allows, plus the child rows joined to
   * the form (`useChildRows` / a nested `EntityList`), in one `bulkAcross`.
   * A handler cannot read the joined rows' writes (no form handle): when joined
   * rows have edits the submit fails with an explicit error. Omit `onSubmit`
   * there, or build the page with `useEntityForm` and `form.pendingWrites()`.
   *
   * Receives the validated values the form writes ({@link FormValues}: fields
   * editable for the viewer and operation, computed fields, i18n companions, `id`
   * on edit), not the whole stored row.
   */
  onSubmit?: (data: FormValues<E, Op>) => void | Promise<void>;
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
  /**
   * Initial form values ({@link EntityFormDefaultValues}): the stored row on edit
   * (accepted as-is), create defaults on create
   */
  defaultValues?: EntityFormDefaultValues<E, Op>;
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
  /**
   * Secondary button handler: the current form state, the same shape `onSubmit`
   * receives ({@link FormValues}), not validated
   */
  onSecondarySubmit?: (data: FormValues<E, Op>) => void | Promise<void>;
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
  operation?: Op;
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
   * Where the page goes on submit (e.g., `/products`). It leaves once validation
   * and uploads pass, before the server answers, and returns if `onSubmit` rejects
   * (the draft restores the edits).
   * - omitted: the previous breadcrumb (nearest existing parent route, else `/`)
   * - `null`: stay on the page (wizards, dialogs, create flows that open the new record)
   */
  successPath?: string | null;
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
