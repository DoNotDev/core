# @donotdev/core

Core framework package for DoNotDev. This package bundles all internal framework modules into a single entry point.

## What's Included

- **Type definitions** - TypeScript types and interfaces
- **Utilities** - Helper functions and common utilities
- **Store management** - Zustand store factory and patterns
- **Schema validation** - Valibot schema creation and validation
- **Hooks** - React hooks for framework initialization
- **i18n** - Internationalization utilities

**Note:** Provider packages (like `@donotdev/firebase`) are separate and should be imported directly when needed.

## Installation

```bash
npm install @donotdev/core
# or
bun install @donotdev/core
```

## License

MIT. See [LICENSE.md](./LICENSE.md).

## Usage

### Tree-shakeable Imports

```typescript
import { createDoNotDevStore, useTranslation } from '@donotdev/core';

// Only imported code included in bundle
const myStore = createDoNotDevStore({ 
  name: 'myStore',
  createStore: (set, get) => ({ ... })
});
```

Named imports only: the namespace re-exports (`Types`, `Utils`, `Stores`, `Schemas`, `Hooks`, `I18n`) were removed because they kept every module of a package in the bundle.

### Server code

```typescript
import { HIDDEN_STATUSES, validateEnvVar } from '@donotdev/core/server';
```

Server-only utilities (`validateEnvVar`, `validateUrl`, `parseServerCookie`, date math) are exported from `@donotdev/core/server` only, never from the browser entry.

## License

MIT. See [LICENSE.md](./LICENSE.md).
