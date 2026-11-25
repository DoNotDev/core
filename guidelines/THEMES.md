# Themes

**Single source of truth:** `src/themes.css`. Import it from `globals.css`; do not set font/color overrides in globals. Framework handles theme switching.

**Default essence = SaaS** (Inter, neutral). Optional essences (Brutalist, Luxury) are available as reference; they do **not** apply until you set the class on `<html>` (e.g. `class="brutalist"`) or use the theme switcher.

**Reference:** See `ESSENCES_REFERENCE.css` for Brutalist/Luxury/Retro essence definitions to copy into your `src/themes.css`.

**Framework defaults:** a neutral light theme (zinc surfaces, blue primary `#1d4ed8` with white text, rounded buttons like cards) and a dark theme (`.dark` on `<html>`), both WCAG AA (4.5:1) for every text/surface pair. An app whose CSS declares no theme (no block with `--theme-label`) lists Light and Dark in its theme switcher; a first visit follows the OS preference. An app that declares themes owns its list: to add the framework dark, declare `.dark { --theme-icon: 'Moon'; --theme-label: 'Dark'; --theme-is-dark: 1; }` (override any token in it). Values: `@donotdev/components` `styles/themes.css`.

**Fonts — the theme decides what ships, the framework ships it.** Name the families in your font tokens (`--font-family`, `--font-headline`, `--font-mono`, through `--font-sans` / `--font-serif`), for `:root` and each theme class. At build the framework resolves every family of those stacks and writes the font plan into the server HTML (Next: generated root layout; Vite: `index.html` and every prerendered page): `<link rel="preload" as="font">` for the first paint (body font at `--font-weight-normal`, headline font at `--font-weight-bold`, the page language's subsets), one inline `@font-face` style (`font-display: optional`, size-matched `'<Family> Fallback'` faces), content-hashed files under `/fonts/` cached immutable. Same on both bundlers; zero flicker, no render-blocking font stylesheet. Never Google Fonts. SSOT: `packages/core/config/fonts/buildFontPlan.js`.
- Where a family comes from, by name (`slug` = lower-case, spaces → `-`): `appConfig.fonts['<Family>']` (your own woff2 files, see APP_CONFIG.md), else `@fontsource-variable/<slug>`, else `@fontsource/<slug>` in your app's dependencies, else the families `@donotdev/ui` bundles (Inter, Playfair Display, Space Grotesk, Roboto, Press Start 2P). Install the package, never import it. System and generic families (`system-ui`, `-apple-system`, `Segoe UI`, `Arial`, `ui-monospace`, `sans-serif`, … `SYSTEM_FONT_FAMILIES`) need no source.
- Default theme: Inter only (`--font-family`/`--font-headline` → `--font-sans: Inter…`).
- Weights: the values of your `--font-weight-*` tokens, per theme. Every one a family's source has ships (a variable package covers its range). One it lacks (Instrument Serif ships 400 only) is no error: the face the browser matches ships and the browser synthesizes the rest, as without the framework; the build lists it (`🔤 Instrument Serif: weight 700 not in source, browser-synthesized`).
- Write the family's fallback face right after it in the declaration that names it: `--font-headline: 'Space Grotesk', 'Space Grotesk Fallback', var(--font-sans);` (the default `--font-sans` / `--font-serif` already do).
- The build fails (`[dndev-fonts] …`, with the line to paste or the fix) on: a family nothing provides; a leading family without its `'<Family> Fallback'` next; a `var()` in a font stack that no CSS defines; `next/font`, an `@fontsource` import or an `@font-face` in the app (`src/**`, Vite `index.html`). `public/fonts/` is the framework's: rewritten every build.
- Preconnects to third-party origins are never injected by the framework: declare the ones your app needs in its document `<head>`.

---

## Standard Use

**File:** `src/themes.css` (scaffolded with light, dark, and optional Brutalist/Luxury)

**Override colors:**
```css
:root {
  /* Brand colors */
  --primary: #2563eb;
  --secondary: #9333ea;
  --accent: #ec4899;

  /* Base colors */
  --background: #ffffff;
  --foreground: #000000;
}
```

**Add custom theme:**
```css
.ocean {
  --theme-icon: 'Waves';
  --theme-label: 'Ocean';
  --primary: #0ea5e9;
  --background: #001a33;
  --foreground: #e0f2fe;
}
```

**Framework auto-computes:** Surfaces (card, popover), muted colors, borders, text on brand colors.

---

## Advanced: All CSS Variables

**Brand colors:**
```css
--primary, --secondary, --accent
--primary-foreground, --secondary-foreground, --accent-foreground
```

**Base colors:**
```css
--background, --foreground
```

**Status colors:**
```css
--success, --warning, --destructive
--success-foreground, --warning-foreground, --destructive-foreground
```
`--<status>` colours text, borders and icons on the page (an error message, an invalid input's border: `var(--destructive)`). `--<status>-foreground` is only the text **on** a `--<status>` background (a destructive button, badge, toast): on the page it is the background colour, invisible.

**Surfaces:**
```css
--card, --card-foreground
--popover, --popover-foreground
--muted, --muted-foreground
--border, --input, --ring
```

**Floating surfaces (optional):** popovers, dropdowns, menus, tooltips and navigation panels (`.dndev-floating`) paint a subtle glow gradient. A theme sets `--floating-background` to flatten all of them at once. Unset = gradient (default look).
```css
.my-theme { --floating-background: var(--popover); }
```

**Theme metadata:**
```css
--theme-icon: 'Sun';      /* Lucide icon name: imported by name at build time (static, server-rendered toggle) */
--theme-label: 'Light';    /* Display name */
--theme-is-dark: 0;        /* 0 = light, 1 = dark */
```

---

## Advanced: Styling Overrides

**Utility classes:**
```tsx
<Card className="dndev-gap-sm" />  // Gap utilities
<div className="dndev-flex dndev-gap-md" />  // Layout utilities
```

**Data attributes:**
```tsx
<HeroSection data-text-align="center" title="Centered" />
<div data-gap="medium" data-radius="md" />
```

**Inline styles:**
```tsx
<Button style={{ minWidth: '200px' }} />
```

**Global CSS rules:**
```css
/* src/themes.css */
.dndev-button {
  border-radius: 8px;  /* Override default */
}
```

**Framework respects your overrides.** All components use CSS variables, so color changes propagate automatically.

---

**Override variables, get themes. Framework handles the rest.**
