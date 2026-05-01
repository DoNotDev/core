// packages/core/schemas/src/common/canvas.ts

/**
 * @fileoverview Canvas base schemas + catalog + validators
 * @description Valibot schemas for the two canvas contracts (agent -> canvas
 *   render, canvas -> agent event), plus the process-local widget registry
 *   and the two validation entry points (`validateBlock`, `validateEvent`).
 *
 *   The catalog is the single trust boundary between untrusted
 *   LLM-originated payloads and the renderer. Unknown kinds, missing
 *   actions, and schema mismatches are all reported as `{ ok: false }`;
 *   callers never receive malformed data.
 *
 *   This file is isomorphic (no React). The React host + component
 *   registration helpers live in `@donotdev/canvas`.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type {
  CanvasBlock,
  CanvasEvent,
  CanvasCallerAccess,
  CanvasSurface,
  ValidateBlockOptions,
  WidgetDef,
  AnyValibotSchema,
} from '@donotdev/types';

/**
 * Box-proxied image URL. Covers, avatars, thumbnails — every image in a
 * canvas widget MUST resolve through the box proxy.
 *
 * Accepted forms:
 * - `/proxy/...` — absolute proxy path on the same origin.
 * - `data:image/...` — inline data URI (agent-generated thumbnails).
 */
export const ProxiedImageUrlSchema = v.pipe(
  v.string(),
  v.check(
    (url) => url.startsWith('/proxy/') || url.startsWith('data:image/'),
    'Image URL must be box-proxied (/proxy/...) or an inline data:image URI.'
  )
);

export const CanvasLifetimeSchema = v.picklist([
  'ephemeral',
  'session',
  'persistent',
]);

export const CanvasWidgetMetadataSchema = v.object({
  title: v.optional(v.string()),
  pinnable: v.optional(v.boolean()),
  preferredHeight: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export const CanvasBlockSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  kind: v.pipe(v.string(), v.minLength(1)),
  lifetime: v.optional(CanvasLifetimeSchema, 'ephemeral'),
  metadata: v.optional(CanvasWidgetMetadataSchema),
  payload: v.unknown(),
});

export const CanvasEventSchema = v.object({
  widgetId: v.pipe(v.string(), v.minLength(1)),
  action: v.pipe(v.string(), v.minLength(1)),
  payload: v.unknown(),
});

// ---------------------------------------------------------------------------
// Registry + validators
// ---------------------------------------------------------------------------

/**
 * A widget as it lives in the registry. Widened to accept an arbitrary
 * component attachment so the UI package can register React components
 * without this module importing React.
 */
export interface RegisteredWidgetBase<
  Kind extends string = string,
  PayloadSchema extends AnyValibotSchema = AnyValibotSchema,
  Actions extends Record<string, AnyValibotSchema> = Record<
    string,
    AnyValibotSchema
  >,
> extends WidgetDef<Kind, PayloadSchema, Actions> {
  readonly component: unknown;
}

// Module-scoped singleton so multiple imports share the same registry.
const registry = new Map<string, RegisteredWidgetBase>();

export function registerWidget(widget: RegisteredWidgetBase): void {
  if (registry.has(widget.kind)) {
    throw new Error(
      `[canvas] Widget kind "${widget.kind}" already registered.`
    );
  }
  registry.set(widget.kind, widget);
}

export function getWidget(kind: string): RegisteredWidgetBase | undefined {
  return registry.get(kind);
}

export function listWidgets(): readonly RegisteredWidgetBase[] {
  return Array.from(registry.values());
}

export type ValidateResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly widget: RegisteredWidgetBase;
    }
  | { readonly ok: false; readonly reason: string };

/**
 * Validate an incoming canvas block end-to-end: envelope shape, kind is
 * in the allowlist, payload conforms to the widget's payload schema, and
 * (optionally) the widget's surface is reachable by the caller's access tier.
 *
 * Failure ordering: envelope → kind → payload → surface. Surface-rejection
 * reasons are prefixed `surface_forbidden: ` so callers can distinguish
 * policy rejection from schema rejection.
 */
export function validateBlock(
  block: unknown,
  opts?: ValidateBlockOptions
): ValidateResult<CanvasBlock> {
  const envelope = v.safeParse(CanvasBlockSchema, block);
  if (!envelope.success) {
    return {
      ok: false,
      reason: `Invalid canvas block envelope: ${formatIssues(envelope.issues)}`,
    };
  }

  const widget = registry.get(envelope.output.kind);
  if (!widget) {
    return {
      ok: false,
      reason: `Unknown widget kind: "${envelope.output.kind}"`,
    };
  }

  const payload = v.safeParse(widget.schema, envelope.output.payload);
  if (!payload.success) {
    return {
      ok: false,
      reason: `Payload rejected by "${envelope.output.kind}" schema: ${formatIssues(payload.issues)}`,
    };
  }

  if (opts?.caller !== undefined) {
    const access = opts.caller.access;
    if (!isSurfaceReachable(widget.surface, access)) {
      return {
        ok: false,
        reason: `surface_forbidden: widget "${envelope.output.kind}" surface=${widget.surface} not reachable by caller access=${access === null ? 'null' : access}`,
      };
    }
  }

  const value: CanvasBlock = {
    ...envelope.output,
    payload: payload.output,
  };
  return { ok: true, value, widget };
}

function isSurfaceReachable(
  surface: CanvasSurface,
  access: CanvasCallerAccess
): boolean {
  if (surface === 'meta') return true;
  if (surface === 'household' || surface === 'private') {
    return access === 'admin' || access === 'member';
  }
  return false;
}

export function validateEvent(
  event: unknown,
  widgetKind: string
): ValidateResult<CanvasEvent> {
  const envelope = v.safeParse(CanvasEventSchema, event);
  if (!envelope.success) {
    return {
      ok: false,
      reason: `Invalid canvas event envelope: ${formatIssues(envelope.issues)}`,
    };
  }

  const widget = registry.get(widgetKind);
  if (!widget) {
    return { ok: false, reason: `Unknown widget kind: "${widgetKind}"` };
  }

  const actionSchema = widget.actions[envelope.output.action];
  if (!actionSchema) {
    return {
      ok: false,
      reason: `Widget "${widgetKind}" has no action "${envelope.output.action}"`,
    };
  }

  const payload = v.safeParse(actionSchema, envelope.output.payload);
  if (!payload.success) {
    return {
      ok: false,
      reason: `Payload rejected by "${widgetKind}.${envelope.output.action}" schema: ${formatIssues(payload.issues)}`,
    };
  }

  const value: CanvasEvent = {
    ...envelope.output,
    payload: payload.output,
  };
  return { ok: true, value, widget };
}

function formatIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.map((p) => String(p.key)).join('.') ?? '';
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
