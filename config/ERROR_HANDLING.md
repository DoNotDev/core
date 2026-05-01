# Error Handling Standards

## Principle: Fail Fast, Fail Loud

**If something is wrong, tell the developer immediately. Do NOT silently fail or return empty defaults.**

## Rules

### 1. Required Resources

If a required resource is missing (themes, routes, config), **throw an error** during build/config phase.

❌ **BAD:**

```js
if (!themes || themes.length === 0) {
  return { themes: [] }; // Silent failure
}
```

✅ **GOOD:**

```js
if (!themes || themes.length === 0) {
  throw new Error(
    `[plugin-name] Required resource missing: themes. ` +
      `Ensure CSS files with theme definitions exist.`
  );
}
```

### 2. Invalid Configuration

If configuration is invalid, **throw an error** immediately.

❌ **BAD:**

```js
if (invalidFeatures.length > 0) {
  logger.warn(`Invalid features: ${invalidFeatures.join(', ')}`);
  // Continue anyway
}
```

✅ **GOOD:**

```js
if (invalidFeatures.length > 0) {
  throw new Error(
    `[plugin-name] Invalid features: ${invalidFeatures.join(', ')}. ` +
      `Available: ${availableFeatures.join(', ')}`
  );
}
```

### 3. Framework Requirements

If framework requires something (e.g., HomePage.tsx), **throw an error** if missing.

❌ **BAD:**

```js
if (!homePage) {
  logger.warn('Home route not found');
  return; // Continue with broken app
}
```

✅ **GOOD:**

```js
if (!homePage) {
  throw new Error(
    `[plugin-name] Framework requires HomePage.tsx at src/pages/HomePage.tsx ` +
      `or src/HomePage.tsx. This file defines the root route (/).`
  );
}
```

### 4. Error Messages

Error messages must:

- Include plugin/component name in brackets: `[plugin-name]`
- Explain what's wrong
- Tell developer how to fix it
- Be actionable (not just "something failed")

✅ **GOOD:**

```js
throw new Error(
  `[dndev-theme] No themes found. Framework requires at least light/dark themes. ` +
    `Ensure CSS files with theme definitions exist in your project. ` +
    `Check that @donotdev/components/styles are imported.`
);
```

### 5. When Silent Failure is OK

Only return empty defaults when:

- Feature is **optional** (e.g., PWA, SEO)
- Missing data is **expected** (e.g., no custom themes = use defaults)
- Error is **recoverable** at runtime (not build-time)

Example (optional feature):

```js
if (!pwaConfig) {
  logger.info('PWA disabled - no manifest found');
  return null; // OK - PWA is optional
}
```

## Build-Time vs Runtime

- **Build-time errors**: Throw immediately (config, discovery, required files)
- **Runtime errors**: Can use graceful degradation (optional features, user input)

## Examples

### ThemePlugin ✅

- Missing themes (0 themes) → **throw error** (framework requires at least one theme)
- Empty discovery → **throw error** (required)

### RoutePlugin ❌ → ✅

- Missing root route (/) → **throw error** (framework requirement - can be HomePage.tsx or any page with route: "/")
- Invalid route format → **throw error** (invalid config)

### SEOPlugin ✅ (optional)

- Missing config → **warn and disable** (optional feature)
- Error parsing routes → **throw error** (invalid data)

### FeaturePlugin ✅ (optional)

- Invalid features → **warn** (optional feature, app can run without)

### AssetPlugin ✅ (optional)

- Missing assets → **scaffold from workspace** (inform user, don't crash)

## Migration Checklist

- [x] RoutePlugin: Missing HomePage → throw error
- [x] ThemePlugin: Missing themes → throw error
- [x] FeaturePlugin: Invalid features → warn (optional feature)
- [x] I18nPlugin: Missing locales → warn (optional feature)
- [ ] AssetPlugin: Missing required assets → throw error (if required)
