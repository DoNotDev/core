# Gotchas: @donotdev/core

Common mistakes related to core framework concerns: imports, i18n, dependencies, and functions.

---

## Imports [Phase 1, 2, 3]

**Server code MUST use `/server` imports - client imports crash on deploy.**

```typescript
// CORRECT
import { getFirebaseAdminFirestore } from '@donotdev/firebase/server';
import { handleError } from '@donotdev/core/server';

// WRONG - crashes on deploy
import { getFirestore } from '@donotdev/firebase';
import { handleError } from '@donotdev/core';
```

**Rule:** Always use `/server` suffix for `@donotdev/core/server`, `@donotdev/firebase/server`, `@donotdev/security/server`.

**ESM only - never use `require()`.**

```typescript
// WRONG
const { something } = require('@donotdev/package');

// CORRECT
import { something } from '@donotdev/package';
```

**Import ordering is mandatory:**
1. React (values, then types)
2. Other vendors (values, then types)
3. `@donotdev/*` packages (values, then types)
4. Relative imports (values, then types)

One line for values, one line for types. Blank line between categories.

---

## i18n [Phase 3, 4]

**Phase 3: hardcode strings. Phase 4: add translations.** Don't i18n too early.

**Two loading strategies:**
- **Eager** (always loaded): `src/locales/common_en.json` - navigation, buttons, common UI
- **Lazy** (loaded per page): `src/pages/locales/home_en.json` - page-specific content

**Status field translations** fall back: `entity-{name}` namespace - `crud` namespace.

**Rich text uses `<Trans>` component** with supported tags only: `<accent>`, `<primary>`, `<muted>`, `<success>`, `<warning>`, `<error>`, `<bold>`, `<code>`.

**Array translations use `tList`:**
```tsx
import { tList } from '@donotdev/ui';
<Card content={tList(t, 'features.items', 4)} />
```

---

## Functions [Phase 3, 4]

**Use `createFunction` for custom functions - 3 params, everything included:**

```typescript
import { createFunction } from '@donotdev/functions/firebase';

export const myFunction = createFunction(schema, 'operation_name', async (data, { uid }) => {
  // Your logic
});
```

**Use `createBaseFunction` only when you need custom config** (memory, timeout, region override).

**Deploy with `dndev deploy`** - not `firebase deploy`. Manual deploy causes CORS 403 on preflight because Cloud Run blocks unauthenticated OPTIONS by default.

**Naming:** Export in camelCase (`getDashboardMetrics`), operation ID in snake_case (`get_dashboard_metrics`).

**CRUD functions are one-liner:** `export const crud = createCrudFunctions(entities);` - generates all CRUD endpoints per entity. Access controlled via `entity.access`.

---

## Dependencies [Phase 1]

**Apps don't declare bundled deps.** Framework packages (`@donotdev/*`) provide everything. Don't add `react-router-dom`, `react-hook-form`, `valibot`, etc. to app's `package.json` - they come through framework deps.

**Environment variables:**
- Client: `apps/my-app/.env` (prefix with `VITE_*`)
- Server: `functions/.env` (secrets: `STRIPE_*`, OAuth tokens)
- Local overrides: `.env.local` (gitignored)
