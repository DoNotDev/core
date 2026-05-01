// packages/core/types/src/ai/types.ts

/**
 * @fileoverview AI Types
 * @description Type definitions for AI feature. Vercel AI SDK transport, cost tracking, rebilling.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import type { AI_PROVIDERS } from './constants';
import type {
  AIChatRequest,
  AIChatResponse,
  AIMessage,
  AIUsage,
} from './schemas';

// =============================================================================
// Foundation Types
// =============================================================================

/** AI provider type */
export type AIProvider = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];

/** AI error code type (derived from AI_ERROR_CODES constant) */
export type AIErrorCode =
  (typeof import('./constants').AI_ERROR_CODES)[keyof typeof import('./constants').AI_ERROR_CODES];

/** Configuration for AI feature (consumer-facing) */
export interface AIConfig {
  provider: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

// =============================================================================
// Cost Types
// =============================================================================

/** Per-model token pricing */
export interface AIModelPricing {
  /** Cost per 1M input tokens in USD */
  promptPer1M: number;
  /** Cost per 1M output tokens in USD */
  completionPer1M: number;
  /** Currency code */
  currency: 'usd';
}

/** Cost calculation result */
export interface AICostResult {
  /** Raw provider cost in USD (server-side only, never expose to end users) */
  providerCost: number;
  /** Marked-up cost for consumer billing (what users owe) */
  billedCost: number;
  /** Markup multiplier applied */
  markup: number;
  /** Breakdown */
  breakdown: {
    promptTokens: number;
    completionTokens: number;
    promptCost: number;
    completionCost: number;
  };
}

/** Consumer-facing cost configuration */
export interface AICostConfig {
  /** Markup multiplier for rebilling (provider cost x markup = billed cost) */
  markup: number;
  /** Monthly token budget per user (0 = unlimited) */
  monthlyBudgetTokens: number;
  /** Whether to show cost to end users (false = admin only) */
  showCostToUsers: boolean;
  /** Currency for display */
  displayCurrency: string;
}

/** Server-side cost record (written per AI request) */
export interface AICostRecord {
  userId: string;
  model: string;
  provider: string;
  usage: AIUsage;
  providerCost: number;
  billedCost: number;
  markup: number;
  timestamp: string;
  requestId: string;
}

/** Real-time cost event for billing integration */
export interface AICostEvent {
  type: 'cost_update';
  requestId: string;
  cost: AICostResult;
  cumulative: AICostResult;
}

// =============================================================================
// Tool Types
// =============================================================================

/** JSON Schema property definition for AI tool parameters */
export interface AIToolParameter {
  /** JSON Schema type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Parameter description (sent to the model) */
  description?: string;
  /** Enum constraint */
  enum?: string[];
  /** Array items schema */
  items?: AIToolParameter;
  /** Object properties */
  properties?: Record<string, AIToolParameter>;
  /** Required property names (for object type) */
  required?: string[];
}

/** AI tool definition - JSON Schema based, provider-agnostic */
export interface AIToolDefinition {
  /** Tool description (sent to the model) */
  description: string;
  /** Tool parameters as JSON Schema object */
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

/** Result of a tool call made by the model */
export interface AIToolCall {
  /** Tool call ID (from provider) */
  id: string;
  /** Tool name */
  name: string;
  /** Parsed arguments */
  args: Record<string, unknown>;
}

// =============================================================================
// Hook API (Degraded pattern)
// =============================================================================

/** AI API surface - returned by useAIChat, degraded when @donotdev/ai not installed */
export interface AIAPI {
  /** Conversation messages */
  messages: AIMessage[];
  /** Send a message */
  append: (content: string) => void;
  /** Stop current stream */
  stop: () => void;
  /** Whether a response is streaming */
  isLoading: boolean;
  /** Current error */
  error: Error | undefined;
  /** Clear conversation */
  clearMessages: () => void;
  /** Whether AI is available (auth + consent) */
  isAvailable: boolean;
  /** Current input value (controlled) */
  input: string;
  /** Set input value */
  setInput: (value: string) => void;
  /** Submit the current input */
  handleSubmit: (e?: any) => void;
  /** Cost tracking (billed cost only - provider cost is server-side only) */
  cost: {
    lastCost: AICostResult | null;
    sessionCost: AICostResult;
    formattedBilledCost: string;
  };
  /** Tool calls from the latest assistant response */
  toolCalls: AIToolCall[];
}

// =============================================================================
// Server Types
// =============================================================================

/** Rate limit configuration for AI handler */
export interface AIRateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** AI route configuration (server-side) */
export interface AIRouteConfig {
  /** AI provider */
  provider: AIProvider;
  /** Model ID */
  model?: string;
  /** Max output tokens */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
  /** System prompt */
  systemPrompt?: string;
  /** Cost configuration */
  cost?: AICostConfig;
  /** Rate limit configuration */
  rateLimitConfig?: AIRateLimitConfig;
  /** Tool definitions available to the model */
  tools?: Record<string, AIToolDefinition>;
}

// Re-export schema-derived types for convenience
export type {
  AIChatRequest,
  AIChatResponse,
  AIMessage,
  AIUsage,
} from './schemas';
