# Flip Fixer — marketing site

Public website for **The Flip Fixer** (kitchen/bath remodels, flooring, paint, make-ready). Built with React, TanStack Start, and Vite. Deploys to Vercel.

**Live site:** https://theflipfixer.com  
**Repo:** https://github.com/dawimberly/flpfxr  
**Vercel project:** Dirty INK → `flpfxr`

---

## Employee login → estimator

Crew sign in on the marketing site, then use the room-by-room estimator on the **same domain**.

| Step | URL |
|------|-----|
| Sign in | https://theflipfixer.com/login (footer: **Employee login**) |
| Estimator | https://www.theflipfixer.com/estimator |

Public pages (home, services, gallery, contact) stay open. No customer login.

The estimator UI ships in this repo (`src/components/estimator-app.tsx` and related libs). PDFs include **By trade** and **Cost per item** for contractor and customer downloads.

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

Copy `.env.example` to `.env` (gitignored). Required for employee login:

| Variable | Local | Production (Vercel) |
|----------|-------|---------------------|
| `VITE_AUTH_ENABLED` | `true` | `true` |
| `BETTER_AUTH_URL` | `http://localhost:8080` | `https://theflipfixer.com` |
| `BETTER_AUTH_SECRET` | random 32+ chars | same value as local |
| `DATABASE_URL` | Neon Postgres URL | same Neon URL |
| `EMPLOYEE_EMAIL` | crew email | (scripts only, not on Vercel) |
| `EMPLOYEE_PASSWORD` | crew password | (scripts only) |
| `EMPLOYEE_NAME` | display name | (scripts only) |

Auth uses **Better Auth** with email/password. The auth schema migration is `migrations/0001_auth.sql` (copied from `migrations/auth/` when sign-in is enabled). It runs on every Vercel build when `DATABASE_URL` is set.

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
node scripts/migrate-with-env.mjs
```

---

## Deploy (Vercel)

1. Connect repo `dawimberly/flpfxr` to project **flpfxr** (team **Dirty INK**).
2. Set production env vars (table above). Prefer `BETTER_AUTH_URL=https://theflipfixer.com` (www is also trusted).
3. Domains: `theflipfixer.com`, `www.theflipfixer.com` → **Production**.
4. Push to `main` — Vercel redeploys automatically.

This one project serves marketing **and** `/estimator`. Do not attach `theflipfixer.com` to the old `the-flip-fixer-estimator` Vercel project.

---

## Contact

**Call:** (210) 436-9117  
**Email:** Jon@TheFlipFixer.com

Service areas: Alamo Heights, Terrell Hills, Olmos Park, The Dominion, Shavano Park, Fair Oaks Ranch, Hollywood Park, Stone Oak, Helotes, Boerne, Kerrville, San Antonio.
