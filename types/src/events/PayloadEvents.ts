// packages/core/types/src/events/PayloadEvents.ts

/**
 * @fileoverview Payload CMS Events
 * @description Event constants and types for Payload CMS webhook events. Defines Payload CMS-related event names and types for event-driven architecture.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Payload CMS event constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const PAYLOAD_EVENTS = {
  DOCUMENT_CREATED: 'payload.document.created',
  DOCUMENT_UPDATED: 'payload.document.updated',
  DOCUMENT_DELETED: 'payload.document.deleted',
  MEDIA_CREATED: 'payload.media.created',
  MEDIA_UPDATED: 'payload.media.updated',
  MEDIA_DELETED: 'payload.media.deleted',
  GLOBAL_UPDATED: 'payload.global.updated',
  USER_CREATED: 'payload.user.created',
  USER_UPDATED: 'payload.user.updated',
  USER_DELETED: 'payload.user.deleted',
  CACHE_INVALIDATED: 'payload.cache.invalidated',
  PAGE_REGENERATED: 'payload.page.regenerated',
} as const;

/**
 * Type for Payload event keys
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PayloadEventKey = keyof typeof PAYLOAD_EVENTS;

/**
 * Type for Payload event names
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type PayloadEventName = (typeof PAYLOAD_EVENTS)[PayloadEventKey];

/**
 * Payload document event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadDocumentEventData {
  collection: string;
  documentId: string;
  operation: string;
  doc: any;
  previousDoc?: any;
  req: any;
  timestamp: string;
}

/**
 * Payload media event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadMediaEventData {
  mediaId: string;
  operation: string;
  media: any;
  previousMedia?: any;
  req: any;
  timestamp: string;
}

/**
 * Payload global event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadGlobalEventData {
  globalSlug: string;
  doc: any;
  previousDoc?: any;
  req: any;
  affectedPages: string[];
  timestamp: string;
}

/**
 * Payload user event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadUserEventData {
  userId: string;
  operation: string;
  user: any;
  req: any;
  timestamp: string;
}

/**
 * Payload cache event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadCacheEventData {
  reason: string;
  scope: string;
  tags: string[];
  priority: string;
  timestamp: string;
}

/**
 * Payload page regeneration event data interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadPageRegenerationEventData {
  paths: string[];
  reason: string;
  priority: string;
  seoImpact: boolean;
  timestamp: string;
}

/**
 * Payload document interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadDocument {
  id: string;
  [key: string]: any;
}

/**
 * Payload request interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PayloadRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  user?: any;
  timestamp: string;
}
