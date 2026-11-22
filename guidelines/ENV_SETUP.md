# Environment Setup

**The complete onboarding flow - from `dndev init` to deployed app.**

---

## The Flow

```
bun install                    -> install dependencies
dndev dev                      -> start app, read the homepage setup guide
dndev coach                    -> see what to configure (numbered checklist)
  (fill in .env values from dashboard)
dndev setup                    -> validate .env, automate provider config
dndev doctor                   -> health check
dndev emu start                -> test locally with emulators (Firebase)
dndev deploy                   -> deploy to production
```

---

## Step 1: Install & Run

```bash
bun install
dndev dev
```

Open the app. The homepage shows every setup step with instructions.

---

## Step 2: Git

```bash
git init
git add . && git commit -m "Initial scaffold"
```

Create a repo on GitHub, then:

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

---

## Step 3: Backend Setup

### 1. See what to configure

```bash
dndev coach
```

Prints a numbered checklist: which dashboard to visit, what to copy, where to paste it. No automation, no prompts.

### 2. Fill in credentials

Follow the coach checklist. Paste **public** credentials into `apps/<app>/.env`, and **secret** keys into `.dndev.secrets` at project root.

### 3. Run setup

```bash
dndev setup
```

Validates all required env vars are present, runs provider automation (CLI linking, migrations, etc.), and runs an inline health check. If values are missing, it tells you which ones and points you back to `dndev coach`.

---

## Step 4: Test Locally

```bash
dndev emu start          # Firebase emulators
```

Select services: Auth + Firestore + Functions. This starts Firebase emulators so you can develop without touching production.

For Supabase, development runs against your Supabase project directly (or use `supabase start` for local Supabase if installed).

---

## Step 5: Build With AI

Open the project in **Cursor**, **Claude Code**, **Windsurf**, or **AntiGravity**.

The AI reads `AGENTS.md` and follows the WAI-WAY protocol:
- Phase 0: Brainstorm -> produce a spec
- Phase 1: Scaffold -> create pages
- Phase 2: Entities -> define data models
- Phase 3: Compose -> build pages with components
- Phase 4: Configure -> generate tests, firestore rules, CI/CD

---

## Step 6: Deploy

```bash
dndev deploy
```

Deploys hosting + functions + rules. Before deploying functions, pushes to Firebase Secret Manager the secrets they bind in the generated `functions/functions.yaml` (changed values only; values from `process.env`, then `.dndev.secrets`, then `functions/.env` with a legacy warning; a bound secret with no value stops the deploy). `--force` deletes deployed functions missing locally; without it the deploy aborts and names them.

---

## Secrets Philosophy

**DoNotDev follows strict rules about credentials:**

### Tier 1: Public Keys - We Ask Directly

These are safe to share, shipped in your client JS bundle. We ask for them during setup.

| Key | Where It Goes |
|-----|--------------|
| Firebase API key, project ID, auth domain, etc. | `apps/<app>/.env` as `VITE_FIREBASE_*` |
| Supabase project URL | `apps/<app>/.env` as `VITE_SUPABASE_URL` |
| Supabase anon key (public JWT) | `apps/<app>/.env` as `VITE_SUPABASE_ANON_KEY` |
| Stripe publishable key | `apps/<app>/.env` as `VITE_STRIPE_PUBLISHABLE_KEY` |

### Tier 2: Secret Keys - One File, Project Root

All secret keys go in **`.dndev.secrets`** at project root (gitignored). One file, every secret.

| Key | How To Get It |
|-----|---------------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard -> Settings -> API |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard -> Webhooks |

Resolution order: `process.env` (CI) -> `.dndev.secrets` (local) -> legacy paths (with warning).

**Which secrets a Firebase function gets is declared in code**, never inferred from `.env`: `defineSecret('X')` plus `secrets: [x]` in the function's options. The functions build reads those declarations from the built bundle (the firebase-functions SDK manifest) and writes them per function into `functions/functions.yaml` (`secretEnvironmentVariables`); a function that declares none binds none. `config.functions[name].secrets` in `functions.config.js` replaces a function's declarations. The build moves only declared keys from `functions/.env` to `functions/.env.local` (emulator); every other `functions/.env` key stays plain config. Framework functions declare their own: billing `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET` for the webhook and `billingHealth`), `createExchangeToken` / `createRefreshToken` `{PROVIDER}_CLIENT_SECRET` for the providers listed (`{PROVIDER}_CLIENT_ID` stays in `functions/.env`).

Then sync to your runtime:

```bash
dndev sync-secrets                    # -> Firebase Secret Manager or Vercel env
dndev sync-secrets --target github    # -> GitHub Secrets (for CI/CD)
```

### Tier 3: Service Account Files - Download, Place, Gitignore

| File | Where It Goes | How To Get It |
|------|--------------|---------------|
| `service-account-key.json` | App root (next to firebase.json) | Firebase Console -> Settings -> Service Accounts |
| `service-account-key.staging.json` | Same location, for staging | Same, from staging project |

These files are `.gitignored`. Never commit them. For CI/CD, upload the file content as a GitHub Secret and decode it in your workflow.

---

## Environment Variables

**Public config** lives in each app's `.env`. **Secrets** live in `.dndev.secrets` at project root.

```
my-project/
+-- .dndev.secrets            <-- ALL secrets (gitignored)
+-- .dndev.secrets.example    <-- Template (committed)
+-- apps/
|   +-- my-app/
|       +-- .env              <-- Public keys: VITE_*, VERCEL_ORG_ID, VERCEL_PROJECT_ID
|       +-- .env.staging      <-- Used by dndev staging
|       +-- .env.production   <-- Production overrides
|       +-- service-account-key.json  <-- Firebase SA (gitignored)
```

**Rules:**
- `VITE_*` / `NEXT_PUBLIC_*` vars -> `apps/<app>/.env` (public, shipped to browser)
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` -> `apps/<app>/.env` (public, per-app)
- All secret keys -> `.dndev.secrets` at project root (one file, gitignored)
- Service account files -> app root, gitignored

---

## CLI Commands

| Command | What It Does |
|---------|-------------|
| `dndev dev` | Start dev server |
| `dndev emu start` | Start Firebase emulators |
| `dndev coach` | Show what to configure (numbered checklist) |
| `dndev setup` | Validate .env, automate provider config, health check |
| `dndev doctor` | Check project health (providers, .env) |
| `dndev deploy` | **Firebase:** hosting + functions + rules. **Supabase:** deploys frontend to Vercel (via scaffolded vercel.json) and Edge Functions to Supabase. Vercel apps get their public `.env` vars (`VITE_*` / `NEXT_PUBLIC_*`) pushed to the Vercel project automatically. |
| `dndev deploy <app> --scope <target> --yes` | Unattended deploy (CI, agents): never prompts; a missing value exits 1 naming its flag. Targets: `frontend`, `functions`, `rules`, `both`, `all`. `--skip-build` reuses builds, `--no-sync-secrets` skips the secrets sync, `--force` deletes deployed functions missing locally. |
| `dndev deploy --dry-run` | Rehearse a deploy: validates everything and prints each command / HTTP request; builds, writes and deploys nothing. |
| `dndev staging` | Deploy to staging environment |
| `dndev sync-secrets` | **Firebase:** push function secrets to Secret Manager. **Vercel** (`--platform vercel --app <app>`): push only the public vars of `apps/<app>/.env`; `.dndev.secrets` never goes to Vercel. |
| `dndev sync-secrets --target github` | Push secrets to GitHub Secrets (CI/CD) |
| `bun run test` | Run tests (after Phase 4) |
| `bun run type-check` | TypeScript validation |

---

## What's Optional

| Feature | Required? | When to Set Up |
|---------|-----------|---------------|
| Git + GitHub | Recommended | Before starting development |
| Firebase or Supabase | Yes (pick one) | Before building any features |
| Cloud Functions | If using server logic | Before deploying functions |
| Stripe | If using billing | When adding payment features |
| GitHub Actions CI/CD | Optional | Phase 4 generates the workflow |
| Staging environment | Optional | When you want a test environment |
| Custom domain | Optional | After first deploy |
| Sentry | Optional | When you want error tracking |
| i18n | Optional | Phase 4 or after launch |

---

**Start here: `bun install && dndev dev`. The homepage tells you everything else.**
