# Restore estimate ranges + optional customer email

## Range formula (recovered, not invented)

Source commit: `3f92fa7` — *Harden public estimator labor, ranges and allowance validation*  
Still present in `projectPlanningEstimate` → `finalize()` in `src/lib/public-pricing.ts`:

```ts
const low = Math.round(total / 100) * 100;
const high = Math.round(total * 1.25 / 100) * 100;
```

Display helper: `formatEstimateRange` → `between $X and $Y`.  
Default medium kitchen (no flooring): **between $12,000 and $15,000**.

## What this PR restores / adds

- Combined low–high range in estimator UI, public API, personalized PDF, saved snapshot, and Jon’s notification.
- Downloads / emails use the immutable saved snapshot — never reprice an existing submission.
- Optional customer PDF email behind **`ESTIMATE_CUSTOMER_EMAIL_ENABLED` (default OFF)** with explicit “Email me a copy” + **double opt-in** confirmation link, then PDF attachment.
- Phone-only path unchanged: download + Jon notify, no customer email.
- Privacy page includes **proposed** customer-delivery wording flagged for owner approval.

## Activation requirements (production unchanged until approved)

1. Keep `ESTIMATE_FOLLOWUP_ENABLED` working as today for download + Jon notify (still requires durable `DATABASE_URL` on Vercel + Resend for staff mail).
2. Owner approve privacy wording for customer delivery.
3. Set `ESTIMATE_CUSTOMER_EMAIL_ENABLED=1` only after (2).
4. Resend API key + verified business `LEAD_FROM_EMAIL` sender already required for staff mail; same for customer confirm/PDF.
5. Apply migration `0008_estimate_customer_email_confirm.sql`.
6. Do **not** enable customer email without reviewing remaining abuse risks below.

## Remaining customer-email abuse risks (rate limits alone are not enough)

- Attackers can still trigger **confirmation** emails to third-party addresses until rate limits trip (mitigated by durable per-contact/IP limits + honeypot + double opt-in; PDF is not sent until confirm).
- Compromised or misconfigured Resend credentials remain a provider-side risk.
- Shared NAT / public Wi‑Fi can exhaust IP windows and block legitimate visitors.
- Confirmation tokens in email logs / forwarded inboxes are bearer secrets until expiry (24h, single-use confirm).

## Sample assets

- Fixed public sample PDF at `$12,800` is **unchanged**.
- Fictitious personalized evidence: `fictitious-personalized-estimate.pdf` in this folder (range, not sample).
