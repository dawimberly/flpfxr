# The Flip Fixer — marketing site + estimator

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

### Contact form delivery

Public lead forms post to same-origin **`/api/leads`** (not FormSubmit). The server emails `LEAD_TO_EMAIL` through [Resend](https://resend.com) when `RESEND_API_KEY` is set, and stores an idempotent row in Neon (`contact_leads`) when `DATABASE_URL` is set.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (required for inbox delivery) |
| `LEAD_TO_EMAIL` | Inbox (default `Jon@TheFlipFixer.com`) |
| `LEAD_FROM_EMAIL` | Verified sender, e.g. `The Flip Fixer <leads@theflipfixer.com>` |

Until `RESEND_API_KEY` is configured on Vercel, the form shows an error and asks the visitor to call or text — it will not pretend the lead was sent.

### Cabinet catalog and paid labor estimate

Migration `migrations/0005_estimate_fee.sql` adds payment and planner columns on `contact_leads`. It runs with the other migrations on deploy when `DATABASE_URL` is set.

| Variable | Purpose |
|----------|---------|
| `SBD_CATALOG_BASE_URL` | Catalog origin. Default `https://stylesbydesigntx.com` |
| `SBD_CATALOG_PATH` | Catalog path. Default `/shop` |
| `STRIPE_SECRET_KEY` | Styles by Design Stripe secret. Required to start checkout |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `DETAILED_ESTIMATE_FEE_CENTS` | Fee in cents. Default `3500` ($35) |
| `RESEND_API_KEY` | Emails the PDF to the customer and notifies staff. The webhook retries while this is missing |

The catalog link is `https://stylesbydesigntx.com/shop?ref=flipfixer` unless those env vars change it. The shop is browse-only. Stripe webhook endpoint: `https://theflipfixer.com/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

The free planning range stays on `/estimate`. After name, phone, and email, the visitor can buy the labor PDF or send a free inquiry. Both write a `contact_leads` row. The PDF prices labor and services only. Material prices are not in it. A designer calls to finalize cabinets, fillers, toe kick, and baseboard. The fee is credited toward the job if they book.

### Draft Stripe invoices from estimate PDFs

Signed-in staff open **Draft invoice** from the estimator (`/estimator/invoices`). Upload a `Flip-Fixer-<Job>-<Contractor|Customer|Materials>-YYYYMMDD.pdf`. If several files are chosen, the contractor copy is used. The page parses lines into an editable table, tags labor versus materials, and can add the paid estimate-fee credit, a discount printed on the PDF, and a 50% deposit split.

Confirming creates a **draft** Stripe invoice (`auto_advance=false`, `collection_method=send_invoice`). It is not finalized or sent. The customer comes from a `contact_leads` row or a `cus_...` id, not from a PDF that says TBD. A missing Stripe customer is created from the lead email. Use `sk_test_...` to exercise this in test mode.

| Variable | Purpose |
|----------|---------|
| `STRIPE_TAX_CODE_LABOR` | Optional Stripe product tax code for labor lines |
| `STRIPE_TAX_CODE_MATERIALS` | Optional Stripe product tax code for materials lines |
| `STRIPE_AUTOMATIC_TAX` | `true` turns on `automatic_tax` for the draft. Default off |
| `STRIPE_INVOICE_DAYS_UNTIL_DUE` | Required by `send_invoice`. Default 30 |

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

## Remodeling resources

Public guides live at `/blog` and `/blog/<slug>`. Edit `src/lib/blog.ts` to add or update guides; cards and related links use the same content list. Existing project photos are decorative, not claims about a specific case study.

## Search engine foundations

`npm run seo:sitemap` generates `public/sitemap.xml` from the public page allowlist in `src/lib/seo-config.ts` and all blog slugs. Both build scripts regenerate it automatically. Employee/login/API routes are excluded. Employee pages emit `noindex`; this supplements authentication, not a replacement for it. Public marketing pages have canonical URLs; campaign query parameters remain available to analytics. The homepage includes business JSON-LD using published facts only; no unverified address, opening hours, or review ratings are supplied.

Next account steps: verify the domain in Google Search Console, submit `https://theflipfixer.com/sitemap.xml`, and inspect indexing for the home, service, and blog pages. Google Business Profile and Search Console are separate account tasks; deploying metadata does not complete either setup.
