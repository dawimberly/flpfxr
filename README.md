# Flip Fixer — marketing site + estimator

Public website for **The Flip Fixer** (kitchen/bath remodels, flooring, paint, make-ready), plus the employee room-by-room estimator. Built with React, TanStack Start, and Vite. Deploys to Vercel.

**Live site:** https://theflipfixer.com / https://www.theflipfixer.com  
**Repo:** https://github.com/dawimberly/flpfxr  
**Vercel project:** Dirty INK → `flpfxr` (sole deploy for the custom domains)

---

## Employee login → estimator

Crew sign in on the marketing site, then use the estimator on the **same domain**.

| Step | URL |
|------|-----|
| Sign in | https://theflipfixer.com/login (footer: **Employee login**) |
| Estimator | https://www.theflipfixer.com/estimator |

Public pages (home, services, gallery, contact) stay open. No customer login.

### Cross-device jobs (phone ↔ laptop)

Signed-in estimates sync to Neon under the employee account — not a git file.

- **In-progress draft** auto-saves to the cloud after you pause typing (~0.7s). Start on the phone in the truck; open the laptop later with the same login and continue.
- **Save to log** writes a permanent job to the Estimate log and pushes it to the account. Open it from any device.
- Newer `updatedAt` / `savedAt` wins when phone and laptop both changed the same draft or job.

Requires `DATABASE_URL` and migration `migrations/0002_estimator_jobs.sql` (`saved_jobs`, `job_drafts`). Auth tables are `migrations/0001_auth.sql`. Both run on Vercel build (and via `npm run db:migrate` when `DATABASE_URL` is set).

### Estimate PDFs

Contractor and customer PDFs share this order:

1. Each room (including elevations, roof, etc.) with a **room total**
2. **Grand total** (Installed + O&P on contractor)
3. **By trade**, then **Cost per item**

UI lives in `src/components/estimator-app.tsx` and related libs under `src/lib/`.

---

## Local development

```bash
npm install
cp .env.example .env   # fill in values (see below)
npm run dev            # http://localhost:8080
```

Other commands:

```bash
npm run build          # production build + DB migrate (when DATABASE_URL is set)
npm run typecheck
npm run test
npm run lint
```

---

## Environment variables

Copy `.env.example` to `.env` (gitignored). Required for employee login and cloud sync:

| Variable | Local | Production (Vercel) |
|----------|-------|---------------------|
| `VITE_AUTH_ENABLED` | `true` | `true` |
| `BETTER_AUTH_URL` | `http://localhost:8080` | `https://theflipfixer.com` |
| `BETTER_AUTH_SECRET` | random 32+ chars | same value as local |
| `DATABASE_URL` | Neon Postgres URL | same Neon URL |
| `EMPLOYEE_EMAIL` | crew email | (scripts only, not on Vercel) |
| `EMPLOYEE_PASSWORD` | crew password | (scripts only) |
| `EMPLOYEE_NAME` | display name | (scripts only) |

Auth uses **Better Auth** with email/password. Migrations under `migrations/` apply on every Vercel build when `DATABASE_URL` is set.

---

## Employee account scripts

**Create account (once):**

```powershell
$env:BETTER_AUTH_URL="https://theflipfixer.com"
npm run create-employee
```

**Reset password** after changing `EMPLOYEE_PASSWORD` in `.env`:

```powershell
$env:BETTER_AUTH_URL="https://theflipfixer.com"
npm run reset-employee-password
```

**Run migrations locally** against Neon:

```bash
# loads DATABASE_URL from .env if your shell helper is set up
npm run db:migrate
# or
node scripts/migrate-with-env.mjs
```

---

## Deploy (Vercel)

1. Connect repo `dawimberly/flpfxr` to project **flpfxr** (team **Dirty INK**).
2. Set production env vars (table above). Prefer `BETTER_AUTH_URL=https://theflipfixer.com` (www is also trusted).
3. Domains: `theflipfixer.com`, `www.theflipfixer.com` → **Production**.
4. Push to `main` — Vercel redeploys automatically.

**Custom domain note:** `vercel --prod` often only aliases `flpfxr-dirty-ink.vercel.app`. After a CLI deploy or promote, point the live domains explicitly if needed:

```bash
npx vercel alias set <deployment-host> theflipfixer.com
npx vercel alias set <deployment-host> www.theflipfixer.com
```

This one project serves marketing **and** `/estimator`. Do not attach `theflipfixer.com` to the old `the-flip-fixer` / `the-flip-fixer-estimator` Vercel projects.

---

## Contact

**Call:** (210) 436-9117  
**Email:** Jon@TheFlipFixer.com

Service areas: Alamo Heights, Terrell Hills, Olmos Park, The Dominion, Shavano Park, Fair Oaks Ranch, Hollywood Park, Stone Oak, Helotes, Boerne, Kerrville, San Antonio.
