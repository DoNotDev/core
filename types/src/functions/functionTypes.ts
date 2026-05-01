// packages/core/types/src/functions/functionTypes.ts

/**
 * @fileoverview Function Types
 * @description Type definitions for function types. Defines schema metadata, function request/response types, and function-related interfaces.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

import type { dndevSchema, SchemaMetadata } from '../crud/schemas';
import type { DateValue } from '../firebase';
import type { ListOptions } from '../hooks';

// Re-export unified types for backward compatibility
export type { SchemaMetadata, dndevSchema };

/**
 * Valid operators for database queries
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type WhereOperator =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'array-contains'
  | 'array-contains-any'
  | 'in'
  | 'not-in';

/**
 * Firestore where clause tuple
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type WhereClause = [string, WhereOperator, any];

/**
 * Firestore orderBy clause tuple
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OrderByClause = [string, 'asc' | 'desc'];

/**
 * Represents a reference to another document.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface Reference {
  /** The collection containing the referenced document */
  collection: string;
  /** The ID of the referenced document */
  document: string;
  /** The field in the referenced document */
  field: string;
}

/**
 * Metadata fields for an entity.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EntityMetadata {
  /** ISO 8601 timestamp when the entity was created */
  createdAt: string;
  /** ISO 8601 timestamp when the entity was last updated */
  updatedAt: string;
  /** ID of the user who created the entity */
  createdById: string;
  /** ID of the user who last updated the entity */
  updatedById: string;
}

/**
 * Utility type that adds metadata to a document.
 * @template T - The base document type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type WithMetadata<T> = T & EntityMetadata;

// Input types for CRUD operations – T is constrained to object.

/**
 * Data required for creating an entity
 * @template T - The entity type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CreateEntityData<T extends Record<string, any>> {
  /** The schema to validate against */
  schema: dndevSchema<T>;
  /** The entity data to create */
  payload: T;
  /** Optional idempotency key for preventing duplicate operations */
  idempotencyKey?: string;
}

/**
 * Data required for updating an entity
 * @template T - The entity type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UpdateEntityData<T extends Record<string, any>> {
  /** The schema to validate against */
  schema: dndevSchema<T>;
  /** The ID of the entity to update */
  id: string;
  /** The partial entity data to update */
  payload: Partial<T>;
  /** Optional idempotency key for preventing duplicate operations */
  idempotencyKey?: string;
}

/**
 * Data required for getting an entity
 * @template T - The entity type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface GetEntityData<T extends Record<string, any>> {
  /** The schema to validate against */
  schema: dndevSchema<T>;
  /** The ID of the entity to get */
  id: string;
}

/**
 * Data required for listing entities
 * @template T - The entity type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ListEntityData<
  T extends Record<string, any>,
> extends ListOptions {
  /** The schema to validate against */
  schema: dndevSchema<T>;
}

/**
 * Supported function platforms
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FunctionPlatform = 'firebase' | 'vercel' | 'aws' | 'custom';

/**
 * Function call configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionCallConfig {
  /** Platform to use for function calls */
  platform: FunctionPlatform;
  /** Region for the function (platform-specific) */
  region?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Base URL for custom platforms */
  baseUrl?: string;
}

/**
 * Function call options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionCallOptions {
  /** Whether this is a public function call (no auth required) */
  public?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Abort signal for request cancellation */
  signal?: AbortSignal;
  /** Whether to cache the response */
  cache?: boolean;
  /** Cache stale time in milliseconds */
  staleTime?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Function response wrapper
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionResponse<T = any> {
  /** Response data */
  data: T;
  /** Whether the call was successful */
  success: boolean;
  /** Error message if any */
  error?: string;
  /** Response metadata */
  metadata?: {
    platform: FunctionPlatform;
    duration: number;
    cached: boolean;
    timestamp: string;
  };
}

/**
 * Function error details
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: any;
  /** Platform-specific error information */
  platform?: {
    name: FunctionPlatform;
    errorCode?: string;
    errorMessage?: string;
  };
}

/**
 * Function call result
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FunctionCallResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: FunctionError };

/**
 * Function client interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionClient {
  /** Call a function */
  callFunction<TData>(
    functionName: string,
    params?: object,
    schema?: v.BaseSchema<unknown, TData, v.BaseIssue<unknown>>,
    options?: FunctionCallOptions
  ): Promise<TData>;

  /** Get client configuration */
  getConfig(): FunctionCallConfig;

  /** Update client configuration */
  updateConfig(config: Partial<FunctionCallConfig>): void;
}

/**
 * Function loader interface for lazy loading
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionLoader {
  /** Load the functions system */
  load(): Promise<FunctionSystem>;

  /** Check if system is loaded */
  isLoaded(): boolean;

  /** Get loaded system (throws if not loaded) */
  getSystem(): FunctionSystem;
}

/**
 * Result type for useFunctionsQuery hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseFunctionsQueryResult<TData> {
  /** Query data */
  data: TData | undefined;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query encountered an error */
  isError: boolean;
  /** Error details if any */
  error: FunctionError | null;
  /** Whether the query is currently fetching (includes background refetch) */
  isFetching: boolean;
  /** Refetch the query */
  refetch: () => Promise<void>;
}

/**
 * Result type for useFunctionsMutation hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseFunctionsMutationResult<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation and return a promise */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Whether the mutation encountered an error */
  isError: boolean;
  /** Whether the mutation succeeded */
  isSuccess: boolean;
  /** Error details if any */
  error: FunctionError | null;
  /** Mutation result data */
  data: TData | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Result type for useFunctionsCall hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseFunctionsCallResult<TData> {
  /** Execute the function call */
  call: (params?: object) => Promise<TData>;
  /** Whether the call is in progress */
  isLoading: boolean;
  /** Whether the call encountered an error */
  isError: boolean;
  /** Error details if any */
  error: FunctionError | null;
  /** Call result data */
  data: TData | undefined;
}

/**
 * Complete functions system interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionSystem {
  /** Function client */
  client: FunctionClient;
  /** React Query hooks */
  hooks: {
    useFunctionsQuery: <TData = unknown>(
      functionName: string,
      params?: object,
      schema?: v.BaseSchema<unknown, TData, v.BaseIssue<unknown>>,
      options?: UseFunctionsQueryOptions<TData>
    ) => UseFunctionsQueryResult<TData>;
    useFunctionsMutation: <TData = unknown, TVariables = object>(
      functionName: string,
      schema?: v.BaseSchema<unknown, TData, v.BaseIssue<unknown>>,
      options?: UseFunctionsMutationOptions<TData, TVariables>
    ) => UseFunctionsMutationResult<TData, TVariables>;
    useFunctionsCall: <TData = unknown>(
      functionName: string,
      options?: FunctionCallOptions
    ) => UseFunctionsCallResult<TData>;
  };
  /** Direct call function */
  callFunction: FunctionClient['callFunction'];
}

/**
 * React Query options for functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseFunctionsQueryOptions<TData> {
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Time until data is considered stale */
  staleTime?: number;
  /** Time until inactive data is garbage collected */
  gcTime?: number;
  /** Number of retry attempts */
  retry?: number;
  /** Whether to keep previous data while fetching */
  keepPreviousData?: boolean;
  /** Whether to refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Callback for successful queries */
  onSuccess?: (data: TData) => void;
  /** Callback for failed queries */
  onError?: (error: FunctionError) => void;
}

/**
 * React Query mutation options for functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseFunctionsMutationOptions<TData, TVariables> {
  /** Number of retry attempts */
  retry?: number;
  /** Callback before mutation */
  onMutate?: (variables: TVariables) => void | Promise<void>;
  /** Callback for successful mutations */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback for failed mutations */
  onError?: (error: FunctionError, variables: TVariables) => void;
  /** Callback after mutation (success or failure) */
  onSettled?: (
    data: TData | undefined,
    error: FunctionError | null,
    variables: TVariables
  ) => void;
}

/**
 * Function schema definition
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionSchema<TInput = any, TOutput = any> {
  /** Input validation schema */
  input?: v.BaseSchema<unknown, TInput, v.BaseIssue<unknown>>;
  /** Output validation schema */
  output?: v.BaseSchema<unknown, TOutput, v.BaseIssue<unknown>>;
  /** Function name */
  name: string;
  /** Whether this is a public function */
  public?: boolean;
  /** Function description */
  description?: string;
}

/**
 * Predefined function schemas
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionSchemas {
  /** Auth-related functions */
  auth: {
    getUserProfile: FunctionSchema<{ userId: string }, Record<string, unknown>>;
    updateUserProfile: FunctionSchema<
      Record<string, unknown>,
      Record<string, unknown>
    >;
    refreshToken: FunctionSchema<
      Record<string, never>,
      Record<string, unknown>
    >;
  };

  /** Billing-related functions */
  billing: {
    createCheckoutSession: FunctionSchema<
      Record<string, unknown>,
      Record<string, unknown>
    >;
    refreshSubscriptionStatus: FunctionSchema<
      Record<string, never>,
      Record<string, unknown>
    >;
    processPaymentSuccess: FunctionSchema<
      Record<string, unknown>,
      Record<string, unknown>
    >;
  };

  /** Generic CRUD functions */
  crud: {
    createEntity: FunctionSchema<
      Record<string, unknown>,
      Record<string, unknown>
    >;
    updateEntity: FunctionSchema<
      Record<string, unknown>,
      Record<string, unknown>
    >;
    deleteEntity: FunctionSchema<{ id: string }, Record<string, unknown>>;
    getEntity: FunctionSchema<{ id: string }, Record<string, unknown>>;
    listEntities: FunctionSchema<
      Record<string, unknown>,
      Record<string, unknown>[]
    >;
  };
}

/**
 * Function call context
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionCallContext {
  /** User authentication token */
  token?: string;
  /** User ID */
  userId?: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * Function client factory options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionClientFactoryOptions {
  /** Default configuration */
  config?: Partial<FunctionCallConfig>;
  /** Authentication token provider */
  getToken?: () => Promise<string | null>;
  /** Error handler */
  onError?: (error: FunctionError) => void;
  /** Request interceptor */
  onRequest?: (functionName: string, params: any) => void;
  /** Response interceptor */
  onResponse?: (functionName: string, response: any) => void;
}

// =============================================================================
// DEPLOYMENT CONFIGURATION TYPES (for functions.yaml generation)
// =============================================================================

/**
 * Memory allocation options for Cloud Functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FunctionMemory =
  | '128MB'
  | '256MB'
  | '512MB'
  | '1GB'
  | '2GB'
  | '4GB'
  | '8GB';

/**
 * Function trigger types
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FunctionTrigger =
  | 'callable'
  | 'http'
  | 'pubsub'
  | 'firestore'
  | 'auth'
  | 'storage'
  | 'scheduled';

/**
 * Function-level deployment metadata
 * @description Per-function configuration for Firebase deployment (like PageMeta for pages)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionMeta {
  /** Custom entry point name (defaults to export name) */
  entryPoint?: string;
  /** Deployment regions (overrides app defaults) */
  region?: string[];
  /** Platform version */
  platform?: 'gcfv1' | 'gcfv2';
  /** Category label for organization */
  category?: 'auth' | 'crud' | 'analytics' | 'scheduled' | 'webhook' | string;
  /** Additional labels */
  labels?: Record<string, string>;
  /** Trigger type (defaults to 'callable') */
  trigger?: FunctionTrigger;
  /** For scheduled functions - cron expression */
  schedule?: string;
  /** Memory allocation */
  memory?: FunctionMemory;
  /** Timeout in seconds */
  timeoutSeconds?: number;
  /** Minimum instances (for cold start optimization) */
  minInstances?: number;
  /** Maximum instances */
  maxInstances?: number;
  /** Secret environment variable names (synced via sync-secrets, read via defineSecret) */
  secrets?: string[];
}

/**
 * CRUD entity configuration for auto-generation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CrudConfig {
  /** Entity collection names to generate CRUD for */
  entities: string[];
  /** Override defaults for all CRUD functions */
  defaults?: Partial<FunctionMeta>;
}

/**
 * App-level defaults for all functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionDefaults {
  /** Default deployment regions */
  region?: string[];
  /** Default platform version */
  platform?: 'gcfv1' | 'gcfv2';
  /** App label for all functions */
  labels?: Record<string, string>;
  /** Default memory allocation */
  memory?: FunctionMemory;
  /** Default timeout in seconds */
  timeoutSeconds?: number;
}

/**
 * Complete functions configuration for an app
 * @description Single config file pattern for functions.yaml generation
 *
 * @example
 * ```typescript
 * export const functionsConfig: FunctionsConfig = {
 *   defaults: {
 *     region: ['europe-west1'],
 *     platform: 'gcfv2',
 *     labels: { app: 'myapp' },
 *   },
 *   functions: {
 *     setCustomClaims: { category: 'auth' },
 *     getDashboardMetrics: { category: 'analytics', memory: '512MB' },
 *   },
 *   crud: {
 *     entities: ['car', 'customer', 'inquiry'],
 *   },
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionsConfig {
  /** App-level defaults applied to all functions */
  defaults?: FunctionDefaults;
  /** Static functions configuration (non-CRUD) */
  functions?: Record<string, FunctionMeta>;
  /** CRUD auto-generation configuration */
  crud?: CrudConfig;
}

/**
 * Generated function endpoint entry (for YAML output)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FunctionEndpoint {
  /** Function name (key in endpoints object) */
  name: string;
  /** Deployment regions */
  region: string[];
  /** Platform version */
  platform: 'gcfv1' | 'gcfv2';
  /** Trigger configuration */
  callableTrigger?: Record<string, never>;
  httpsTrigger?: Record<string, never>;
  scheduleTrigger?: { schedule: string };
  /** Entry point in bundled code */
  entryPoint: string;
  /** Labels for organization */
  labels: Record<string, string>;
  /** Memory allocation */
  memory?: string;
  /** Timeout */
  timeoutSeconds?: number;
  /** Min instances */
  minInstances?: number;
  /** Max instances */
  maxInstances?: number;
  /** Secret environment variables */
  secretEnvironmentVariables?: Array<{ key: string }>;
}
