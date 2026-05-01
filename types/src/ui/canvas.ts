// packages/core/types/src/ui/canvas.ts

/**
 * @fileoverview Canvas catalog types
 * @description TypeScript-only types describing widget definitions and the
 *   shape stored in the catalog registry. Runtime validation lives in
 *   `@donotdev/schemas` (see `schemas/common/canvas.ts`). This file is
 *   purely structural and isomorphic (no React imports).
 *
 * The React component side of the registered widget is a concern of
 * `@donotdev/canvas` (the UI package). Server-side consumers (validators,
 * brokers) only need the definition shape, not the rendered component.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import type * as v from 'valibot';

/**
 * Which surface a widget is allowed to render on.
 *
 * - `household` — any authenticated member.
 * - `private` — member-scoped (mail, 2nd-brain, homework).
 * - `meta` — framing widgets (TextBlock, Composite, ProgressCanvas, Confirmation).
 */
export type CanvasSurface = 'household' | 'private' | 'meta';

/**
 * A valibot schema with an inferable output type. Accepts the generic base
 * schema shape used across the monorepo without locking to a specific issue type.
 */
export type AnyValibotSchema = v.BaseSchema<
  unknown,
  unknown,
  v.BaseIssue<unknown>
>;

/**
 * Declarative widget definition — the static metadata a widget module
 * exports before it is paired with its React component for registration.
 *
 * Discriminator: `kind` (string literal, unique in the catalog).
 *
 * - `schema` validates the block `payload` for this kind.
 * - `actions` is a record of action-name -> schema validating that action's event payload.
 * - `surface` controls policy-layer gating.
 * - `defaultLifetime` is used by the agent-side emitter when the agent does not override it.
 */
export interface WidgetDef<
  Kind extends string = string,
  PayloadSchema extends AnyValibotSchema = AnyValibotSchema,
  Actions extends Record<string, AnyValibotSchema> = Record<
    string,
    AnyValibotSchema
  >,
> {
  readonly kind: Kind;
  readonly schema: PayloadSchema;
  readonly actions: Actions;
  readonly surface: CanvasSurface;
  readonly defaultLifetime?: CanvasLifetime;
}

/**
 * Canvas block lifetime. Kept as a type alias here — the runtime schema
 * `CanvasLifetimeSchema` lives in `@donotdev/schemas`.
 *
 * - `ephemeral` — vanishes with the current turn (default).
 * - `session` — pinned to the current chat thread.
 * - `persistent` — lives on the PWA dashboard until manually removed.
 */
export type CanvasLifetime = 'ephemeral' | 'session' | 'persistent';

/**
 * Optional display hints attached to a canvas block.
 */
export interface CanvasWidgetMetadata {
  readonly title?: string;
  readonly pinnable?: boolean;
  readonly preferredHeight?: number;
}

/**
 * Envelope for a single canvas block emitted by the agent.
 *
 * `payload` is intentionally `unknown` at the envelope level — it is
 * validated against the registered widget's payload schema inside
 * `validateBlock`. Do not trust `payload` without that check.
 */
export interface CanvasBlock {
  readonly id: string;
  readonly kind: string;
  readonly lifetime: CanvasLifetime;
  readonly metadata?: CanvasWidgetMetadata;
  readonly payload: unknown;
}

/**
 * Envelope for a user interaction event emitted back to the agent.
 *
 * `payload` is validated against the widget's per-action schema inside
 * `validateEvent`.
 */
export interface CanvasEvent {
  readonly widgetId: string;
  readonly action: string;
  readonly payload: unknown;
}

/**
 * Caller access tier passed to `validateBlock` for surface gating.
 *
 * Mirrors the gontrand access model. `kid` and `null` fail closed for any
 * non-`meta` surface at the canvas boundary.
 */
export type CanvasCallerAccess = 'admin' | 'member' | 'kid' | null;

/**
 * Optional options for `validateBlock`. When `caller` is present, the
 * widget's `surface` is matched against the caller's access tier after
 * envelope / kind / payload checks pass.
 */
export interface ValidateBlockOptions {
  readonly caller?: { readonly access: CanvasCallerAccess };
}

/**
 * Props every widget component receives from `CanvasHost`. The React
 * component shape itself lives in `@donotdev/canvas` (UI package).
 */
export interface CanvasWidgetProps {
  readonly payload: unknown;
  readonly emit: (action: string, payload: unknown) => void;
}
