// packages/core/types/src/ai/schemas.ts

/**
 * @fileoverview AI Schemas
 * @description Valibot schemas for AI request/response validation.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';
import { AI_PROVIDERS, AI_ROLES } from './constants';

// =============================================================================
// Message Schemas
// =============================================================================

/** Schema for a single AI message */
export const AIMessageSchema = v.object({
  role: v.picklist([AI_ROLES.USER, AI_ROLES.ASSISTANT, AI_ROLES.SYSTEM]),
  content: v.pipe(v.string(), v.minLength(1)),
  id: v.optional(v.string()),
  createdAt: v.optional(v.string()),
});

// =============================================================================
// Tool Schemas
// =============================================================================

/** Schema for a JSON Schema property (recursive via lazy) */
const AIToolParameterSchema: v.GenericSchema<any> = v.lazy(() =>
  v.object({
    type: v.picklist(['string', 'number', 'boolean', 'array', 'object']),
    description: v.optional(v.string()),
    enum: v.optional(v.array(v.string())),
    items: v.optional(AIToolParameterSchema),
    properties: v.optional(v.record(v.string(), AIToolParameterSchema)),
    required: v.optional(v.array(v.string())),
  })
);

/** Schema for an AI tool definition */
export const AIToolDefinitionSchema = v.object({
  description: v.pipe(v.string(), v.minLength(1)),
  parameters: v.object({
    type: v.literal('object'),
    properties: v.record(v.string(), AIToolParameterSchema),
    required: v.optional(v.array(v.string())),
  }),
});

/** Schema for a tool call result */
export const AIToolCallSchema = v.object({
  id: v.string(),
  name: v.string(),
  args: v.record(v.string(), v.unknown()),
});

// =============================================================================
// Request / Response Schemas
// =============================================================================

/** Schema for AI chat request (client → server) */
export const AIChatRequestSchema = v.object({
  messages: v.pipe(v.array(AIMessageSchema), v.minLength(1)),
  provider: v.optional(
    v.picklist([
      AI_PROVIDERS.ANTHROPIC,
      AI_PROVIDERS.OPENAI,
      AI_PROVIDERS.GOOGLE,
    ])
  ),
  model: v.optional(v.string()),
  maxTokens: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  temperature: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(2))),
  systemPrompt: v.optional(v.string()),
  stream: v.optional(v.boolean()),
  tools: v.optional(v.record(v.string(), AIToolDefinitionSchema)),
});

/** Schema for AI token usage */
export const AIUsageSchema = v.object({
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
});

/** Schema for AI chat response (server → client, non-streaming) */
export const AIChatResponseSchema = v.object({
  message: AIMessageSchema,
  usage: v.optional(AIUsageSchema),
  finishReason: v.optional(v.string()),
  toolCalls: v.optional(v.array(AIToolCallSchema)),
});

/** Schema for AI provider configuration (consumer's _shared/aiConfig.ts) */
export const AIProviderConfigSchema = v.object({
  provider: v.picklist([
    AI_PROVIDERS.ANTHROPIC,
    AI_PROVIDERS.OPENAI,
    AI_PROVIDERS.GOOGLE,
  ]),
  model: v.optional(v.string()),
  maxTokens: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  temperature: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(2))),
  systemPrompt: v.optional(v.string()),
});

// =============================================================================
// Type Exports (Schema-Derived)
// =============================================================================

/** A single message in an AI chat conversation. */
export type AIMessage = v.InferOutput<typeof AIMessageSchema>;
/** Request payload for an AI chat completion. */
export type AIChatRequest = v.InferOutput<typeof AIChatRequestSchema>;
/** Token usage statistics for an AI completion. */
export type AIUsage = v.InferOutput<typeof AIUsageSchema>;
/** Response payload from an AI chat completion. */
export type AIChatResponse = v.InferOutput<typeof AIChatResponseSchema>;
/** Configuration for an AI provider backend. */
export type AIProviderConfig = v.InferOutput<typeof AIProviderConfigSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

export function validateAIChatRequest(data: unknown) {
  return v.safeParse(AIChatRequestSchema, data);
}

export function validateAIChatResponse(data: unknown) {
  return v.safeParse(AIChatResponseSchema, data);
}
