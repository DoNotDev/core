# Using i18n in Your DoNotDev App

## Quick Setup

### 1. Zero Configuration

If you're using DoNotDev's `AppProviders`, internationalization is **already included** - no setup needed!

```typescript
// Your App.tsx - i18n works automatically
import { AppProviders } from '@donotdev/ui';

export default function App() {
  return (
    <AppProviders LandingPage={YourLandingPage}>
      {/* Your app components can use translations immediately */}
    </AppProviders>
  );
}
```

**Framework translations are automatically included** - you get built-in translations for UI elements, authentication flows, and system messages without any configuration.

### 2. Create Translation Files

Use the required naming format: `namespace_language.json`

**Default structure** (works with zero config):

```
src/
  locales/                    # Always available (critical translations)
    common_en.json
    common_fr.json
    navigation_en.json
    navigation_fr.json

  features/
    dashboard/
      locales/                # Loaded when needed (feature translations)
        dashboard_en.json
        dashboard_fr.json
```

**Or use your own structure** by configuring the patterns:

```
translations/                 # Your custom directory
  global/                     # Always available
    app_en.json
    app_fr.json
  modules/
    billing/                  # Loaded when needed
      billing_en.json
      billing_fr.json
```

```typescript
// vite.config.ts - Tell the plugin where to find your files
export default defineViteConfig({
  i18n: {
    patterns: {
      eager: ['translations/global/*_*.json'],    # Always available
      lazy: ['translations/modules/**/*_*.json']  # Loaded when needed
    }
  }
});
```

### 3. Start Using Translations

```typescript
import { useTranslation } from '@donotdev/i18n';

// For always-available translations
function Header() {
  const { t } = useTranslation();
  return <h1>{t('common:app.title')}</h1>;
}

// For feature-specific translations
function Dashboard() {
  const { t } = useTranslation('dashboard');
  return <h1>{t('title')}</h1>;
}
```

## File Organization

### Default Structure (Zero Config)

Works automatically - no configuration needed:

**Framework translations (automatically included):**

```
packages/features/i18n/src/locales/
├── eager/                   # Always available (core UI elements)
│   ├── dndev_en.json       # Framework UI translations (English)
│   └── dndev_fr.json       # Framework UI translations (French)
└── lazy/                    # Loaded when needed
    ├── terms_en.json        # Terms of service (English)
    ├── terms_fr.json        # Terms of service (French)
    ├── privacy_en.json      # Privacy policy (English)
    └── privacy_fr.json      # Privacy policy (French)
```

**Your app's locales:**

```
src/
  locales/                    # Eager: Always available
    common_en.json
    common_fr.json
    navigation_en.json
    navigation_fr.json

  features/
    dashboard/
      locales/                # Lazy: Loaded when needed
        dashboard_en.json
        dashboard_fr.json
```

**Result:** You get both framework translations and your app translations automatically, with your translations taking precedence.

### Framework Translations (Automatically Included)

**Framework translations are automatically available** - no setup needed! The DoNotDev framework includes built-in translations for common UI elements, authentication flows, and system messages.

**Available framework namespaces:**

- `dndev` - Core framework UI translations (buttons, forms, errors, etc.) - **Always available (eager)**
- `terms` - Terms of service templates - **Loaded when needed (lazy)**
- `privacy` - Privacy policy templates - **Loaded when needed (lazy)**

**Framework translations are automatically discovered from:**

```
packages/features/i18n/src/locales/
├── eager/                   # Always available (core UI elements)
│   ├── dndev_en.json       # Framework UI translations (English)
│   └── dndev_fr.json       # Framework UI translations (French)
└── lazy/                    # Loaded when needed (legal documents)
    ├── terms_en.json        # Terms of service (English)
    ├── terms_fr.json        # Terms of service (French)
    ├── privacy_en.json      # Privacy policy (English)
    └── privacy_fr.json      # Privacy policy (French)
```

**Why this structure?**

- **`dndev` (eager)**: Core UI elements like buttons, forms, and error messages are always needed
- **`terms`/`privacy` (lazy)**: Legal documents are only loaded when someone actually reads them

**Consumer Override Capability:**
You can override any framework translation by adding a file with the same name to your locales folder:

```
src/
  locales/                    # Your app's locales
    dndev_en.json            # Overrides framework dndev_en.json (eager)
    dndev_fr.json            # Overrides framework dndev_fr.json (eager)
    terms_en.json            # Overrides framework terms_en.json (lazy)
    privacy_en.json          # Overrides framework privacy_en.json (lazy)
    common_en.json           # Your app-specific translations
    common_fr.json           # Your app-specific translations

  features/
    dashboard/
      locales/                # Feature-specific translations
        dashboard_en.json
        dashboard_fr.json
```

**Framework translation loading behavior:**

- **Eager framework translations** (`dndev`) are loaded immediately and always available
- **Lazy framework translations** (`terms`, `privacy`) are loaded when first accessed
- **Consumer overrides** work the same way for both eager and lazy framework translations

**How Overriding Works:**

- **Framework provides base translations** for all supported languages
- **Consumer translations take precedence** - your `dndev_en.json` overrides the framework version
- **Missing keys fall back to framework** - if you don't override a key, the framework version is used
- **New languages automatically supported** - add `dndev_de.json` to support German, etc.

**Example: Overriding Framework Button Text**

```json
// Your src/locales/dndev_en.json
{
  "buttons": {
    "signIn": "Custom Sign In Text", // Overrides framework
    "continue": "Custom Continue Text" // Overrides framework
  },
  "newKey": "New Consumer Key" // Adds new translation
}
```

**Result:**

- `buttons.signIn` shows "Custom Sign In Text" (your override)
- `buttons.continue` shows "Custom Continue Text" (your override)
- `newKey` shows "New Consumer Key" (your addition)
- All other framework keys remain available (fallback to framework)

### Custom Structure

**You can organize files however you want** - just tell the plugin where to look:

```
translations/                 # Your custom directory
  core/                       # Always available translations
    app_en.json
    nav_en.json
  modules/                    # Feature translations
    billing/
      billing_en.json
      billing_fr.json
    dashboard/
      dashboard_en.json
      dashboard_fr.json
```

```typescript
// vite.config.ts - Configure your custom paths
export default defineViteConfig({
  i18n: {
    patterns: {
      eager: ['translations/core/*_*.json'],       # Always available
      lazy: ['translations/modules/**/*_*.json']   # Loaded when needed
    }
  }
});
```

### More Examples

**Flat structure:**

```
locales/
  app_en.json         # Eager
  nav_en.json         # Eager
  dashboard_en.json   # Lazy
  settings_en.json    # Lazy
```

```typescript
// vite.config.ts
export default defineViteConfig({
  i18n: {
    patterns: {
      eager: ['locales/{app,nav}_*.json'],
      lazy: ['locales/{dashboard,settings,billing}_*.json'],
    },
  },
});
```

**Monorepo structure:**

```
packages/
  shared/
    i18n/
      common_en.json    # Eager
  dashboard/
    translations/
      dashboard_en.json # Lazy
```

```typescript
// vite.config.ts
export default defineViteConfig({
  i18n: {
    patterns: {
      eager: ['packages/shared/i18n/*_*.json'],
      lazy: ['packages/*/translations/*_*.json'],
    },
  },
});
```

## Translation Files

### Essential Translations (Always Available)

Create these in `src/locales/`:

```json
// src/locales/common_en.json
{
  "app": {
    "title": "My App",
    "description": "Welcome to my application"
  },
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit"
  },
  "messages": {
    "welcome": "Welcome {{name}}!",
    "loading": "Loading...",
    "error": "Something went wrong"
  }
}
```

```json
// src/locales/navigation_en.json
{
  "home": "Home",
  "dashboard": "Dashboard",
  "settings": "Settings",
  "profile": "Profile",
  "logout": "Sign Out"
}
```

### Feature Translations (Loaded When Needed)

Create these in feature directories:

```json
// src/features/dashboard/locales/dashboard_en.json
{
  "title": "Dashboard",
  "stats": {
    "users": "{{count}} users",
    "revenue": "Revenue: ${{amount}}",
    "orders": "{{count}} orders"
  },
  "actions": {
    "refresh": "Refresh Data",
    "export": "Export"
  }
}
```

## Using Translations

### Basic Usage

```typescript
import { useTranslation } from '@donotdev/i18n';

function MyComponent() {
  const { t, i18n } = useTranslation();

  // Handle loading states during language changes
  if (i18n.isLoading) {
    return <div>Loading translations...</div>;
  }

  // Handle translation errors gracefully
  if (i18n.error) {
    return <div>Translation error: {i18n.error}</div>;
  }

  return (
    <div>
      {/* Simple translation */}
      <h1>{t('common:app.title')}</h1>

      {/* With fallback text */}
      <p>{t('common:messages.welcome', 'Hello!', { name: 'John' })}</p>

      {/* Navigation */}
      <nav>
        <a href="/">{t('navigation:home')}</a>
        <a href="/dashboard">{t('navigation:dashboard')}</a>
      </nav>

      {/* Current language always consistent */}
      <footer>Language: {i18n.language}</footer>
    </div>
  );
}
```

### Feature-Specific Translations

```typescript
import { useTranslation } from '@donotdev/i18n';

function DashboardPage() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('stats.users', { count: 1250 })}</p>
      <button>{t('actions.refresh')}</button>
    </div>
  );
}
```

### Language Switching

Use the built-in language selector for automatic language switching:

```typescript
import { LanguageSelector } from '@donotdev/ui';

function AppHeader() {
  return (
    <header>
      <nav>...</nav>
      <LanguageSelector />  {/* Automatic language switching with loading states */}
    </header>
  );
}
```

Or create custom language controls using the i18next instance from `useTranslation`:

```typescript
import { useTranslation } from '@donotdev/i18n';

function CustomLanguageSwitch() {
  const { t, i18n } = useTranslation();
  const isLoading = i18n?.isLoading;
  const error = i18n?.error as string | undefined;

  if (isLoading) return <div>Switching language...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <span>Current: {i18n?.language}</span>
      <button onClick={() => i18n?.changeLanguage('fr')}>Français</button>
      <button onClick={() => i18n?.changeLanguage('en')}>English</button>
    </div>
  );
}
```

## Enhanced Features

### Loading States

Language changes now show loading states automatically:

```typescript
import { useTranslation } from '@donotdev/i18n';

function LanguageAwareComponent() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('welcome')}</h1>

      {i18n.isLoading && (
        <div className="loading-overlay">Switching to new language...</div>
      )}

      <button onClick={() => i18n?.changeLanguage('fr')} disabled={i18n.isLoading}>
        Switch to French {i18n.isLoading && '...'}
      </button>
    </div>
  );
}
```

### Error Handling

Translation errors are handled gracefully:

```typescript
function RobustComponent() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      {i18n.error ? (
        <div className="error-fallback">
          <p>Translation system error: {i18n.error}</p>
          <p>Using default language content...</p>
        </div>
      ) : (
        <h1>{t('welcome', 'Welcome')}</h1>
      )}
    </div>
  );
}
```

### Consistent Language State

All components get the same current language from the store:

```typescript
function Header() {
  const { i18n } = useTranslation();
  return <div>Header in {i18n.language}</div>;
}

function Footer() {
  const { i18n } = useTranslation();
  return <div>Footer in {i18n.language}</div>;
}

// Both Header and Footer always show the same language
// Even during language transitions
```

## Common Patterns

### Form Validation Messages

```json
// src/locales/common_en.json
{
  "validation": {
    "required": "This field is required",
    "email": "Please enter a valid email address",
    "minLength": "Must be at least {{min}} characters",
    "maxLength": "Must be no more than {{max}} characters"
  }
}
```

```typescript
function ContactForm() {
  const { t } = useTranslation();

  const validate = (email: string) => {
    if (!email) return t('common:validation.required');
    if (!isValidEmail(email)) return t('common:validation.email');
    return null;
  };
}
```

### Error Messages

```json
// src/locales/common_en.json
{
  "errors": {
    "network": "Connection failed. Please try again.",
    "notFound": "The requested item was not found",
    "unauthorized": "You don't have permission to do this",
    "serverError": "Server error. Please try again later."
  }
}
```

### Pluralization

```json
// src/locales/common_en.json
{
  "items": {
    "count_one": "{{count}} item",
    "count_other": "{{count}} items"
  }
}
```

```typescript
function ItemList({ items }) {
  const { t } = useTranslation();
  return <p>{t('common:items.count', { count: items.length })}</p>;
}
```

## Configuration

### Different Default Language

```typescript
// vite.config.ts - Use French as default instead of English
export default defineViteConfig({
  i18n: {
    fallbackLanguage: 'fr',
  },
});
```

### Advanced Options

```typescript
// vite.config.ts
export default defineViteConfig({
  i18n: {
    // Custom file locations (see File Organization section above)
    patterns: {
      eager: ['your/path/to/core/*_*.json'],
      lazy: ['your/path/to/features/**/*_*.json'],
    },

    // Language settings
    fallbackLanguage: 'en',

    // Development
    debug: true, // See what files are discovered

    // i18next options (advanced)
    i18nextOptions: {
      defaultNS: 'common',
      fallbackLng: ['en', 'fr', 'de'],
      // Any i18next option...
    },
  },
});
```

## Adding New Languages

1. **Create translation files** for the new language:

   ```bash
   src/locales/common_de.json    # German
   src/locales/navigation_de.json
   ```

2. **Files are automatically discovered** - no configuration needed

3. **Language appears in selector automatically**

**Framework translations automatically support new languages** - if you add `dndev_de.json` to your `src/locales/` folder, the framework will use your German translations for UI elements, authentication flows, and system messages.

## Best Practices

### Organize by Usage

- **`src/locales/`**: Critical translations (buttons, navigation, errors)
- **Feature directories**: Feature-specific translations

### Use Descriptive Keys

```json
{
  "dashboard": {
    "stats": {
      "totalUsers": "Total Users: {{count}}",
      "activeUsers": "Active Users: {{count}}"
    }
  }
}
```

### Provide Fallback Text

```typescript
// Always provide fallback for better UX
t('feature:new.key', 'Default text if translation missing');
```

### Keep Translations Close to Features

```
src/features/billing/
├── components/
├── hooks/
└── locales/           # Billing translations here
    ├── billing_en.json
    └── billing_fr.json
```

### Leverage Framework Translations

- **Don't recreate common UI elements** - use framework translations for buttons, forms, errors, etc.
- **Override only what you need** - add `dndev_en.json` to customize specific framework keys
- **Extend framework translations** - add new keys to your override files without losing framework functionality
- **Framework provides fallbacks** - missing consumer keys automatically use framework versions

## Troubleshooting

### Translations Not Showing

1. **Check file naming**:

   ```bash
   ✅ dashboard_en.json
   ❌ dashboard-en.json
   ❌ en-dashboard.json
   ```

2. **Check file location**:

   ```bash
   # Default structure
   ✅ src/locales/common_en.json           # Always available
   ✅ src/features/dashboard/locales/dashboard_en.json  # Feature-specific

   # Custom structure (see File Organization section)
   ✅ translations/core/app_en.json        # Your custom eager path
   ✅ translations/modules/billing/billing_en.json  # Your custom lazy path

   ❌ src/translations/common_en.json      # Wrong location (unless configured)
   ```

3. **Enable debug mode** to see what files are found:
   ```typescript
   // vite.config.ts
   export default defineViteConfig({
     i18n: { debug: true },
   });
   ```

### Missing Translation Keys

The system shows the key instead of crashing:

```typescript
t('missing.key'); // Shows "[missing.key]"
t('missing.key', 'Backup'); // Shows "Backup"
```

### Framework Translation Issues

1. **Framework translations not showing**:
   - Check if you have `dndev_en.json` in your `src/locales/` folder
   - If you do, make sure you're not accidentally overriding all framework keys
   - Framework translations are always available as fallbacks

2. **Consumer overrides not working**:
   - Ensure your file name matches exactly: `dndev_en.json` (not `dndev-en.json`)
   - Place override files in `src/locales/` (eager) or feature `locales/` folders (lazy)
   - Consumer translations take precedence over framework ones

3. **New language not supported**:
   - Add `dndev_de.json` to your `src/locales/` folder for German support
   - Framework automatically discovers new language files
   - No configuration changes needed

### Language Selector Empty

Make sure you have translation files for multiple languages:

```bash
src/locales/
├── common_en.json  ✅
├── common_fr.json  ✅  # Need at least 2 languages
└── common_de.json  ✅
```

### Restart Development Server

After adding new translation files, restart your dev server:

```bash
npm run dev
# or
bun run dev
```

---

**That's it! Your app now supports multiple languages with zero external requests and perfect offline support.**
