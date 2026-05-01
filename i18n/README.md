# @donotdev/i18n

**Internationalization system for DoNotDev framework with flexible usage modes.**

## 🚀 Usage Modes

### 1. Standalone Mode (Lightweight)

Minimal setup with just translation functionality:

```typescript
import { useTranslation, I18nProvider } from '@donotdev/i18n';

function App() {
  return (
    <I18nProvider>
      <HomePage />
    </I18nProvider>
  );
}

function HomePage() {
  const { t } = useTranslation();
  return <h1>{t('common:welcome')}</h1>;
}
```

**Dependencies:** `@donotdev/types`, `@donotdev/utils`, `@donotdev/i18n`

### 2. UI Mode (AppProviders)

Zero-config with DoNotDev's AppProviders:

```typescript
import { AppProviders } from '@donotdev/ui';
import { useTranslation } from '@donotdev/i18n';

function App() {
  return (
    <AppProviders LandingPage={HomePage}>
      {/* I18nProvider automatically included */}
    </AppProviders>
  );
}

function HomePage() {
  const { t } = useTranslation();
  return <h1>{t('common:welcome')}</h1>;
}
```

**Dependencies:** Full DoNotDev UI framework

### 3. EDA Mode (Enhanced)

Full framework with loading states, error handling, and consistent state:

```typescript
import { AppProviders, LanguageSelector } from '@donotdev/ui';
import { useTranslation } from '@donotdev/i18n';

function App() {
  return (
    <AppProviders LandingPage={HomePage}>
      <Header />
      <HomePage />
    </AppProviders>
  );
}

function Header() {
  return (
    <header>
      <LanguageSelector /> {/* Built-in language switcher */}
    </header>
  );
}

function HomePage() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('common:welcome')}</h1>
      {i18n.isLoading && <p>Switching language...</p>}
      {i18n.error && <p>Error: {i18n.error}</p>}
      <button onClick={() => i18n?.changeLanguage('fr')}>
        Français {i18n.isLoading && '...'}
      </button>
    </div>
  );
}
```

**Dependencies:** Full DoNotDev framework + stores

## 📁 Translation Files

All modes use the same file structure:

```
src/locales/common_en.json
src/locales/common_fr.json
src/features/dashboard/locales/dashboard_en.json
```

## 🔄 Array Translation Pattern

**CRITICAL:** The i18n system uses a specific pattern for arrays that must be followed:

### ✅ Correct JSON Structure (Arrays)

```json
{
  "benefits": [
    "high value",
    "performance",
    "ownership",
    "no headaches",
    "no boilerplate",
    "no setup"
  ]
}
```

### ✅ Correct Code Access (Indexed Keys)

```typescript
// Use indexed keys in code, NOT returnObjects
const benefits = [0, 1, 2, 3, 4, 5]
  .map((index) => t(`benefits.${index}`))
  .filter((benefit, index) => benefit && benefit !== `[benefits.${index}]`);
```

### ✅ Recommended: Use Array Translation Utility

```typescript
import { translateArray } from '@donotdev/utils';

// Much cleaner and more intuitive
const benefits = translateArray(t, 'benefits', 6);
const features = translateArray(t, 'features.list', 3);
```

### ❌ Wrong Patterns

```typescript
// DON'T use returnObjects with arrays
t('benefits', { returnObjects: true }) // ❌

// DON'T use object notation in JSON
"benefits": { "0": "value", "1": "value" } // ❌
```

### 🎯 Why This Pattern?

- **Performance**: Indexed access is faster than object parsing
- **Consistency**: Matches the framework's established patterns
- **Reliability**: Works across all i18n modes (standalone, UI, EDA)
- **Filtering**: Easy to filter out missing translations with `[key]` fallback detection

## 🎯 When to Use

- **Standalone**: Lightweight apps, minimal dependencies
- **UI**: Zero-config setup with DoNotDev UI
- **EDA**: Full framework benefits (loading states, error handling, built-in components)

---

📖 **Detailed documentation:** [USAGE.md](./USAGE.md)  
🏗️ **Architecture details:** [DESIGN.md](./DESIGN.md)

## 📄 License & Ownership

All rights reserved.  
The DoNotDev framework and its premium features are the exclusive property of **Ambroise Park Consulting**.

- Licensed under MIT. See LICENSE.md.

© Ambroise Park Consulting – 2025
