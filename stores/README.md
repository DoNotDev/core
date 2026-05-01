# @donotdev/stores

Complete UI state management system for DoNotDev apps. Handles authentication, subscriptions, themes, settings, entity selection, error handling, and more using Zustand with **event-driven store updates**.

**What it does**: Comprehensive UI state layer - NOT server data management  
**What it doesn't do**: API calls, server state, data fetching

## Installation

```bash
bun add @donotdev/stores
```

## Core Architecture

### Store Types

1. **Entity Stores** - UI state for data lists (selection, filters, sorting)
2. **Auth Store** - Authentication, subscriptions, rate limiting
3. **Theme Store** - Theme management with build-time detection
4. **Settings Store** - App preferences (theme, language, cache)
5. **OAuth Store** - Third-party connection management
6. **Error Store** - Global error handling and notifications
7. **Modal Store** - Modal state management
8. **AbortController Store** - Request cancellation

### Store Initialization

All stores are automatically initialized by the platform-specific StoreInitializer components:

- **Vite**: `ViteStoresInitializer` (included in `ViteAppProviders`)
- **Next.js**: `NextJsStoresInitializer` (included in `NextJsAppProviders`)

Stores are initialized automatically when you use the app providers - no manual setup needed.

## Event-Driven Store Updates

Stores automatically update via **domain-specific event listeners** when auth events occur. This provides zero-coupling integration between `@donotdev/auth` and store state.

### How It Works

```typescript
// @donotdev/auth emits events
authService.emit('user:signedIn', { user, subscription, credentials });

// @donotdev/stores listeners automatically update relevant stores
AuthListener    → Updates authStore.setUser(user)
UserListener    → Updates userStore.setProfile(user.profile)
StorageListener → Syncs user data to cloud via your StorageManager
```

### Event Listeners

Each store has a dedicated listener that subscribes to relevant auth events:

```typescript
// AuthListener - Updates authentication store
class AuthListener {
  constructor(authService, authStore) {
    authService.on('user:signedIn', ({ user, subscription }) => {
      authStore.setAuthenticated(true, user.id);
      authStore.setSubscription(subscription);
    });

    authService.on('user:signedOut', () => {
      authStore.reset();
    });

    authService.on('subscription:changed', ({ subscription }) => {
      authStore.setSubscription(subscription);
    });
  }
}

// UserListener - Updates user profile store
class UserListener {
  constructor(authService, userStore) {
    authService.on('user:signedIn', ({ user }) => {
      userStore.setProfile(user.profile);
      userStore.setPreferences(user.preferences);
    });

    authService.on('user:updated', ({ user, changes }) => {
      if (changes.profile) userStore.setProfile(user.profile);
      if (changes.preferences) userStore.setPreferences(user.preferences);
    });
  }
}

// StorageListener - Integrates with your existing StorageManager
class StorageListener {
  constructor(authService, storageManager) {
    authService.on('user:signedIn', ({ user, subscription }) => {
      storageManager.syncUserToCloud(user);
      storageManager.syncSubscriptionToGitHub(subscription);
    });

    authService.on('user:signedOut', ({ userId }) => {
      storageManager.clearUserCache(userId);
    });

    authService.on('subscription:changed', ({ subscription }) => {
      storageManager.syncSubscriptionToCloud(subscription);
    });
  }
}
```

### Benefits

- ✅ **Zero Coupling** - Auth doesn't import stores, stores don't import auth
- ✅ **Automatic Updates** - All relevant stores update when auth changes
- ✅ **Extensible** - Add new stores/listeners without touching existing code
- ✅ **Testable** - Mock auth events to test store behavior
- ✅ **Robust** - Listeners handle failures gracefully
- ✅ **Integrates with Your Patterns** - Works with your existing StorageListener system

### Custom Store Listeners

You can create custom listeners for specific business needs:

```typescript
// Custom analytics listener
class AnalyticsListener {
  constructor(authService, analyticsStore) {
    authService.on('user:signedIn', ({ user }) => {
      analyticsStore.trackEvent('user_signed_in', {
        userId: user.id,
        provider: user.provider,
        tier: user.subscription?.tier,
      });
    });

    authService.on('subscription:changed', ({ subscription, previousTier }) => {
      analyticsStore.trackEvent('subscription_changed', {
        newTier: subscription.tier,
        previousTier,
        userId: subscription.userId,
      });
    });
  }
}
```

## Entity Stores - List UI State

For managing selection, filters, and sorting in data tables/lists.

```typescript
import { createDoNotDevStore } from '@donotdev/stores';
import { productEntity } from './entities';
import type { Product } from './types';

export const useProductStore = createDoNotDevStore<Product>({
  name: 'productStore',
  createStore: (set, get) => ({
    // Store implementation
  })
});

function ProductList() {
  const {
    selected,        // Currently selected item
    filters,         // Active filters object
    sort,           // Current sort config
    select,         // Select/deselect function
    setFilters,     // Update filters
    setSort,        // Update sorting
    reset           // Reset all state
  } = useProductStore();

  return (
    <div>
      <SearchInput
        value={filters.search || ''}
        onChange={(search) => setFilters({ ...filters, search })}
      />

      <DataTable
        data={products}
        selectedId={selected?.id}
        onSelect={select}
        sort={sort}
        onSort={(field, direction) => setSort(field, direction)}
      />

      <button onClick={reset}>Clear All</button>
    </div>
  );
}
```

## Auth Store - Authentication & Subscriptions

Comprehensive authentication with partner support, subscriptions, and rate limiting. **Automatically updated via AuthListener**.

```typescript
import { useAuthStore } from '@donotdev/stores';

function LoginForm() {
  const {
    authenticated,
    userId,
    subscription,
    partners,
    setAuthenticated,
    setSubscription,
    hasFeature,
    hasTier,
    checkRateLimit,
    consumeRateLimit
  } = useAuthStore();

  const handleLogin = async (email: string) => {
    // Check rate limiting
    const rateLimit = checkRateLimit('auth:signin', email);
    if (!rateLimit.allowed) {
      console.log(`Rate limited. Try again in ${rateLimit.blockRemainingSeconds}s`);
      return;
    }

    // Consume rate limit attempt
    consumeRateLimit('auth:signin', email);

    // Perform login... (this will trigger auth events that update stores automatically)
  };

  // Feature gating
  if (!hasFeature('advanced-analytics')) {
    return <UpgradePrompt />;
  }

  return <AnalyticsDashboard />;
}
```

### Subscription Management

```typescript
function SubscriptionManager() {
  const {
    subscription,
    upgradeSubscription,
    extendSubscription,
    getSubscriptionInfo
  } = useAuthStore();

  const handleUpgrade = () => {
    upgradeSubscription('pro', 30); // Upgrade to Pro for 30 days
  };

  return (
    <div>
      <p>Current: {subscription.tier}</p>
      <p>Expires: {subscription.daysRemaining} days</p>
      <p>Features: {subscription.features.join(', ')}</p>
      <button onClick={handleUpgrade}>Upgrade to Pro</button>
    </div>
  );
}
```

## Theme Store - Theme Management

Theme management with build-time detection via Vite plugin.

```typescript
import { useThemeStore } from '@donotdev/stores';

function ThemeSelector() {
  const {
    currentTheme,
    isDarkMode,
    availableThemes,    // From build-time detection
    setTheme,
    toggleDarkMode,
    switchToNextTheme
  } = useThemeStore();

  return (
    <div>
      <select value={currentTheme} onChange={(e) => setTheme(e.target.value)}>
        {availableThemes.map(theme => (
          <option key={theme.name} value={theme.name}>
            {theme.displayName}
          </option>
        ))}
      </select>

      <button onClick={toggleDarkMode}>
        {isDarkMode ? 'Light' : 'Dark'} Mode
      </button>

      <button onClick={switchToNextTheme}>
        Next Theme
      </button>
    </div>
  );
}
```

## Clean Architecture - Stores Overview

The DoNotDev framework uses dedicated stores for global state management:

- **Auth Store** → User authentication and subscription state
- **OAuth Store** → Third-party service connections
- **Theme Store** → Application theming with build-time discovery
- **i18n Store** → Internationalization and translations
- **Modal/Loading/Error Stores** → UI state management
- **AbortController Store** → Request cancellation

Each store owns its domain completely - no cross-store dependencies or shared state.

## OAuth Store - Third-Party Connections

Manages OAuth connections for various partners.

```typescript
import { useOAuthStore } from '@donotdev/stores';

function ConnectionsPanel() {
  const {
    connections,
    setConnecting,
    setConnected,
    setCredentials,
    resetPartner,
    isConnected,
    getCredentials
  } = useOAuthStore();

  const handleConnect = async (partnerId: 'github' | 'google') => {
    setConnecting(partnerId, true);

    try {
      const credentials = await performOAuthFlow(partnerId);
      setCredentials(partnerId, credentials);
      setConnected(partnerId, true);
    } catch (error) {
      setPartnerError(partnerId, error);
    } finally {
      setConnecting(partnerId, false);
    }
  };

  return (
    <div>
      {Object.entries(connections).map(([partnerId, state]) => (
        <div key={partnerId}>
          <p>{partnerId}: {state.isConnected ? 'Connected' : 'Disconnected'}</p>

          {state.isConnected ? (
            <button onClick={() => resetPartner(partnerId as any)}>
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => handleConnect(partnerId as any)}
              disabled={state.isConnecting}
            >
              {state.isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Error Handling - Direct Toast Calls

Global error management using direct toast notifications.

```typescript
import { toast } from '@donotdev/components';

// Show error toasts directly
function SomeComponent() {
  const handleError = () => {
    toast('error', 'Something went wrong!');
  };

  const handleSuccess = () => {
    toast('success', 'Operation completed!');
  };
}
```

## Modal Store

Simple global state for modals.

```typescript
import { useOverlayStore } from '@donotdev/stores';

function GlobalModal() {
  const { isOpen, content, closeModal } = useOverlayStore();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content">
        {content}
      </div>
    </div>
  );
}
```

## AbortController Store - Request Cancellation

Manage request cancellation across the app.

```typescript
import { useAbortControllerStore } from '@donotdev/stores';

function DataFetcher() {
  const { createController, abortController } = useAbortControllerStore();

  const fetchData = async () => {
    const controller = createController('fetch-users');

    try {
      const response = await fetch('/api/users', {
        signal: controller.signal
      });
      // Handle response...
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
      }
    }
  };

  const cancelFetch = () => {
    abortController('fetch-users');
  };

  return (
    <div>
      <button onClick={fetchData}>Fetch Data</button>
      <button onClick={cancelFetch}>Cancel</button>
    </div>
  );
}
```

## Hooks

### useRateLimit

```typescript
import { useRateLimit } from '@donotdev/stores';

function LoginForm() {
  const { isLimited, remaining, formattedBlockTime, recordAttempt, reset } =
    useRateLimit('user@example.com', 'auth:signin');

  const handleSubmit = () => {
    if (isLimited) {
      alert(`Rate limited. Try again in ${formattedBlockTime}`);
      return;
    }

    recordAttempt();
    // Perform login...
  };
}
```

### useNavigationAbort

```typescript
import { useNavigationAbort } from '@donotdev/stores';

function Navigation() {
  const { navigateWithAbort } = useNavigationAbort();

  return (
    <button onClick={() => navigateWithAbort('/dashboard')}>
      Go to Dashboard
    </button>
  );
}
```

## Store Integration

Stores communicate via `initStores()` and **event-driven listeners** which set up:

- **Event-Driven Auth Updates**: AuthListener, UserListener, StorageListener automatically update stores when auth events occur
- **Settings ↔ Theme**: Settings changes trigger theme updates
- **Auth ↔ OAuth**: Auth logout resets OAuth connections
- **Error events**: Global error handling across stores
- **Storage events**: Cross-tab synchronization
- **Your StorageManager Integration**: StorageListener triggers your existing cloud sync patterns

### Event Listener Setup

```typescript
// Automatically initialized by StoreInitializer components
function initializeStoreListeners(authService) {
  // Set up all domain-specific listeners
  new AuthListener(authService, authStore);
  new UserListener(authService, userStore);
  new StorageListener(authService, storageManager); // Your existing pattern
  new AnalyticsListener(authService, analyticsStore);

  // Cross-store integrations
  settingsStore.subscribe((settings) => {
    if (settings.theme !== themeStore.currentTheme) {
      themeStore.setTheme(settings.theme);
    }
  });
}
```

## Build-Time Theme Detection

Themes are **automatically detected** when you use `defineViteConfig()` - no configuration needed!

**Smart Detection**: Automatically determines if themes are dark/light based on CSS `--background` color values using WCAG luminance calculations. No hardcoded theme names required.

Works with **any CSS** that gets imported/bundled:

- Local CSS files (`import './styles.css'`)
- CSS from workspace packages (`import '@donotdev/ui/themes.css'`)
- CSS from node_modules (`import 'library/theme.css'`)

Just define themes in your CSS with `--theme-label`:

```css
/* src/themes.css or ../dndev/themes/dndev.css */
.my-dark-theme {
  --theme-label: 'My Dark Theme';
  --theme-icon: 'LightningBoltIcon';
  --background: #120458; /* Dark color = auto-detected as dark theme */
  /* other variables */
}

.my-light-theme {
  --theme-label: 'My Light Theme';
  --theme-icon: 'WaveIcon';
  --background: #ffffff; /* Light color = auto-detected as light theme */
  /* other variables */
}
```

Available themes automatically populated in theme store. **Zero configuration required.**

### Debug Theme Detection

```typescript
// vite.config.ts
export default defineViteConfig({
  themes: {
    debug: true, // See theme detection logs
  },
});
```

Look for logs like:

- `🔍 Scanning CSS: themes.css`
- `✨ Found 3 themes in dndev.css`
- `🎨 Theme detection complete: 6 themes`

## Store Types Reference

```typescript
// Entity Store
interface Store<T> {
  selected?: T;
  filters: Record<string, any>;
  sort?: { field: keyof T; direction: 'asc' | 'desc' };
  select: (item?: T) => void;
  setFilters: (filters: Record<string, any>) => void;
  setSort: (field: keyof T, direction: 'asc' | 'desc') => void;
  reset: () => void;
}

// Auth Store
interface AuthState {
  authenticated: boolean;
  userId: string | null;
  subscription: SubscriptionInfo;
  partners: Record<AuthPartnerId, AuthPartnerState>;
  // ... more fields
}

// Settings Store
interface SettingsState {
  theme: string;
  language: string;
  cacheOptions: CacheOptions;
}
```

## Usage Patterns

- **For UI Lists**: Use `createStore<T>(entity)`
- **For Authentication**: Use `useAuthStore()` (automatically updated via events)
- **For Theming**: Use `useThemeStore()`
- **For Internationalization**: Use native i18next : useTranslation()
- **For Global Errors**: Use `toast()` from `@donotdev/components`
- **For Modals**: Use `useOverlayStore()`
- **For Loading States**: Use `useCrudList().loading` or `useCrudList().fetching` from `@donotdev/crud` (TanStack Query)
- **For Request Cancellation**: Use `useAbortControllerStore()`
- **For App Setup**: Use `ViteAppProviders` or `NextJsAppProviders` (automatically initializes stores)

---

**Bottom Line**: Complete UI state management system with **event-driven store updates**. Auth events automatically trigger relevant store updates via domain-specific listeners. Zero coupling, automatic synchronization, integrates with your existing StorageManager patterns.

## 📄 License & Ownership

All rights reserved.
The DoNotDev framework and its premium features are the exclusive property of **Ambroise Park Consulting**.

- Licensed under MIT. See LICENSE.md.

© Ambroise Park Consulting – 2025
