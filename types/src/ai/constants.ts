// packages/core/types/src/ai/constants.ts

/**
 * @fileoverview AI Constants
 * @description Provider IDs, model lists, roles, defaults for AI feature.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

/** Supported AI providers */
export const AI_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
} as const;

/** Message roles */
export const AI_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

/** Default models per provider */
export const AI_MODELS = {
  [AI_PROVIDERS.ANTHROPIC]: {
    default: 'claude-sonnet-4-6',
    models: [
      'claude-sonnet-4-6',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-6',
      'claude-opus-4-20250514',
    ],
  },
  [AI_PROVIDERS.OPENAI]: {
    default: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
  },
  [AI_PROVIDERS.GOOGLE]: {
    default: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  },
} as const;

/** Default AI configuration */
export const DEFAULT_AI_CONFIG = {
  maxTokens: 4096,
  temperature: 0.7,
  stream: true,
} as const;

/** AI error codes */
export const AI_ERROR_CODES = {
  UNKNOWN: 'unknown',
  UNAUTHENTICATED: 'unauthenticated',
  INVALID_API_KEY: 'invalid_api_key',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  PROVIDER_ERROR: 'provider_error',
  TOKEN_LIMIT_EXCEEDED: 'token_limit_exceeded',
  STREAM_INTERRUPTED: 'stream_interrupted',
} as const;

/** AI model tiers - SSOT for tier-based model resolution */
export const AI_TIERS = {
  FAST: { id: 'fast', defaultModel: 'claude-haiku-4-5-20251001' },
  STANDARD: { id: 'standard', defaultModel: 'claude-sonnet-4-6' },
  PREMIUM: { id: 'premium', defaultModel: 'claude-opus-4-6' },
} as const;

/** AI tier identifier derived from AI_TIERS constant. */
export type AITierId = (typeof AI_TIERS)[keyof typeof AI_TIERS]['id'];

/** Default markup multiplier (provider cost x 4 = billed cost) */
export const DEFAULT_AI_MARKUP = 4.0;

/**
 * Token pricing per model (USD per 1M tokens).
 * SSOT - imported by both client (cost display) and server (cost recording).
 */
export const AI_TOKEN_PRICING: Record<
  string,
  { promptPer1M: number; completionPer1M: number; currency: 'usd' }
> = {
  // Anthropic (current)
  'claude-sonnet-4-6': {
    promptPer1M: 3.0,
    completionPer1M: 15.0,
    currency: 'usd',
  },
  'claude-haiku-4-5-20251001': {
    promptPer1M: 0.8,
    completionPer1M: 4.0,
    currency: 'usd',
  },
  'claude-opus-4-6': {
    promptPer1M: 15.0,
    completionPer1M: 75.0,
    currency: 'usd',
  },
  // Anthropic (legacy - kept for historical cost lookups)
  'claude-sonnet-4-20250514': {
    promptPer1M: 3.0,
    completionPer1M: 15.0,
    currency: 'usd',
  },
  'claude-opus-4-20250514': {
    promptPer1M: 15.0,
    completionPer1M: 75.0,
    currency: 'usd',
  },
  // OpenAI
  'gpt-4o': { promptPer1M: 2.5, completionPer1M: 10.0, currency: 'usd' },
  'gpt-4o-mini': { promptPer1M: 0.15, completionPer1M: 0.6, currency: 'usd' },
  'gpt-4.1': { promptPer1M: 2.0, completionPer1M: 8.0, currency: 'usd' },
  'gpt-4.1-mini': { promptPer1M: 0.4, completionPer1M: 1.6, currency: 'usd' },
  'o3-mini': { promptPer1M: 1.1, completionPer1M: 4.4, currency: 'usd' },
  // Google
  'gemini-2.0-flash': {
    promptPer1M: 0.1,
    completionPer1M: 0.4,
    currency: 'usd',
  },
  'gemini-2.5-pro': {
    promptPer1M: 1.25,
    completionPer1M: 10.0,
    currency: 'usd',
  },
  'gemini-2.5-flash': {
    promptPer1M: 0.15,
    completionPer1M: 0.6,
    currency: 'usd',
  },
} as const;
