# @donotdev/types

A centralized package containing all shared TypeScript types and interfaces used across the DoNotDev ecosystem.

## Purpose

This package serves as the single source of truth for type definitions used by multiple packages in the DoNotDev project. It ensures type consistency and prevents circular dependencies between packages.

## Installation

```bash
bun add @donotdev/types
```

## Package Organization

The type package's internal structure mirrors the core DoNotDev packages. Each subdirectory contains the types corresponding to its parent core package:

```
@donotdev/types/               @donotdev/ (core packages)
├── auth/        ────────→  @donotdev/auth
├── common/      ────────→  (shared across all packages)
├── errors/      ────────→  (used by error handling utilities)
├── firebase/    ────────→  @donotdev/firebase
├── functions/   ────────→  @donotdev/functions
├── hooks/       ────────→  @donotdev/hooks
├── i18n/        ────────→  @donotdev/i18n
├── schemas/     ────────→  @donotdev/schemas
├── stores/      ────────→  @donotdev/stores
├── ui/          ────────→  @donotdev/ui
└── utils/       ────────→  @donotdev/utils
```

This structure ensures that:

1. Types used by a specific package are defined in the corresponding type subdirectory
2. Cross-package types have a clear home based on their primary ownership
3. Developers can easily find the types they need by looking at the package that uses them

## Usage

All types are exported from the root package:

```typescript
// Import types from the main package entry point
import {
  // Auth types
  AuthUser,
  AuthStatus,

  // UI types
  EntityField,

  // Network types
  NetworkStatus,
  NetworkConnectionType,

  // Store types
  AuthState,
  TokenStatus,
} from '@donotdev/types';
```

While the package is organized by subdirectories internally, all types are re-exported from the main entry point for convenience.

## Core Principles

1. **Single Source of Truth**: Each type is defined exactly once, in the subdirectory corresponding to its primary owner
2. **No Implementation Logic**: Only type definitions - no functions or business logic
3. **No Circular Dependencies**: Type definitions flow in one direction
4. **Synchronization**: Types should always be updated before updating their implementations in core packages

## Best Practices

1. **Define types in the appropriate subdirectory** based on the parent core package
2. **Add JSDoc comments** to document the purpose and usage of each type
3. **Avoid redefining types** - import from this package instead of creating duplicates
4. **Maintain clean exports** in the main index.ts to ensure all types are accessible

## Development Workflow

When developing new features:

1. First, define or update types in this package
2. Then implement using these types in the corresponding core packages
3. This ensures type consistency across the entire ecosystem

## 📄 License & Ownership

All rights reserved.  
The DoNotDev framework and its premium features are the exclusive property of **Ambroise Park Consulting**.

- Licensed under MIT. See LICENSE.md.

© Ambroise Park Consulting – 2025
