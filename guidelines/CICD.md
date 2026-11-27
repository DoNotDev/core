# CI/CD Setup

**One command to set up GitHub Actions: secrets and workflows.**

---

## Prerequisites

1. **GitHub CLI** installed and authenticated:
   ```bash
   gh auth login
   ```
2. **Git remote** pointing to your GitHub repository
3. **`.dndev.secrets`** at project root with private tokens:
   ```env
   GH_PAT=<github_personal_access_token>
   VERCEL_TOKEN=your_vercel_token        # if using Vercel
   SUPABASE_ACCESS_TOKEN=your_token      # if using Supabase
   ```
4. **Service account key** (Firebase projects):
   - `service-account-key.json` in your app directory

---

## Quick Start

```bash
dndev setup-cicd
```

The command will:
1. Detect your app and providers (Firebase, Vercel, Supabase)
2. Show a plan of secrets to upload and workflows to generate
3. Upload all secrets to GitHub
4. Write `.github/workflows/ci.yml` and `deploy.yml`

---

## Options

```bash
dndev setup-cicd --app web       # Target specific app
dndev setup-cicd --dry-run       # Preview without uploading or writing
```

---

## What Gets Created

### Secrets (uploaded to GitHub)

| Secret | Source | When |
|--------|--------|------|
| `GH_PAT` | `.dndev.secrets` | Always (private dndev checkout) |
| `FIREBASE_SERVICE_ACCOUNT` | `service-account-key.json` (base64) | Firebase projects |
| `VERCEL_TOKEN` | `.dndev.secrets` | Vercel projects |
| `VERCEL_ORG_ID` | `.env` | Vercel projects |
| `VERCEL_PROJECT_ID` | `.env` | Vercel projects |
| `SUPABASE_ACCESS_TOKEN` | `.dndev.secrets` | Supabase projects |
| `SUPABASE_PROJECT_REF` | Extracted from `VITE_SUPABASE_URL` | Supabase projects |
| `VITE_*` / `NEXT_PUBLIC_*` | `.env` | Public build vars |

### Workflows

| File | Trigger | What it does |
|------|---------|-------------|
| `ci.yml` | Push + PR to main | Checkout, install, typecheck, test |
| `deploy.yml` | Push to main | Build + deploy to detected providers |

---

## Troubleshooting

**"Could not detect GitHub repository"**
-> Ensure `git remote -v` shows a GitHub URL.

**Missing secrets warning**
-> Add the missing values to `.dndev.secrets` or `.env` and re-run.

**"gh: not found"**
-> Install GitHub CLI: https://cli.github.com/

---

## See Also

- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables
