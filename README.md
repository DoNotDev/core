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

### Namespaced Imports

```typescript
import { Stores, I18n } from '@donotdev/core';

const myStore = Stores.createDoNotDevStore({ ... });
```

## License

MIT. See [LICENSE.md](./LICENSE.md).
