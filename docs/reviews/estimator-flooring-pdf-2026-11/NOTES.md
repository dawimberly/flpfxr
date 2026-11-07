# Optional flooring + personalized estimate PDF/email

## Updated default totals (flooring excluded by default)

Kitchen/bathroom remodel estimates no longer bundle floor covering unless **Include flooring** is checked. Dedicated flooring projects are unchanged.

| Project | Size | Without flooring (new default) | With flooring |
| --- | --- | ---: | ---: |
| Kitchen | Small | $9,600 | $11,000 |
| Kitchen | Medium | $12,000 | $13,300 |
| Kitchen | Large | $17,500 | $19,100 |
| Bathroom | Small | $5,900 | $6,100 (LVP) / $6,900 (tile) |
| Bathroom | Medium | $8,000 | $8,300 (LVP) / $9,300 (tile) |
| Bathroom | Large | $10,300 | $10,700 (LVP) / $13,300 (tile) |
| Flooring | Medium | n/a (always included) | $3,600 |

**Large bathroom $10,300 → $13,300:** With flooring checked and ceramic tile selected, the larger Large preset floor area’s covering, install, and tile setting materials raise the **combined** preliminary total by $3,000. Default LVP with flooring is $10,700. Public UI/PDF/email never show a separate flooring price or internal rates.

Older shared links without `includeFlooring` keep working and now show the **without flooring** total. Add `includeFlooring=1` to restore the previous bundled total.

Flooring exclusion removes only the separable floor covering materials/install line (and bathroom tiled-floor setting materials when the floor is tile). Room-area scaling for walls/trim/paint/cabinets is unchanged.

## Delivery configuration (explicitly disabled until approved)

Customer estimate email stays **disabled** until all of:

1. `RESEND_API_KEY` is set
2. `ESTIMATE_FROM_EMAIL` (or `LEAD_FROM_EMAIL`) is a **verified business sender** such as `The Flip Fixer <leads@theflipfixer.com>`
3. The sender is **not** `onboarding@resend.dev`
4. `ESTIMATE_EMAIL_DELIVERY=1` after owner approval (API key alone does **not** enable delivery)
5. `DATABASE_URL` is available so durable abuse limits and PDF snapshots can fail closed correctly
6. Owner has approved `/privacy` wording for this path

When disabled, the estimator shows **Estimate email unavailable** before collecting name/email and does not store failed email requests.

Migrations: `0006_estimate_email.sql`, `0007_estimate_email_hardening.sql`.

## Abuse protection and remaining risks

Durable Postgres counters enforce per-recipient, per-IP, and global submit limits, plus download IP limits. Protection **fails closed** if the store errors.

**Remaining recipient-abuse risk before enabling delivery:** a bot can still request estimates to third-party inboxes they do not own (harassment / spam-via-us). Recommended before flipping `ESTIMATE_EMAIL_DELIVERY=1`: CAPTCHA or similar bot gate, and/or email address verification / double opt-in. Do not install or pay for those services without explicit owner approval.

## Download tokens

Tokens are stored hashed, expire (7 days), are revocable, capped by download count, and returned with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Customer links in email use canonical `SITE.url` (not request Host / `x-forwarded-host`).

**Hosting-log honesty:** application code avoids putting customer PII in public query strings beyond the unguessable token path segment. Reverse proxies, CDN, or platform access logs may still record full request URLs including that path. We do not claim tokens never appear in infrastructure logs.

## Privacy

`/privacy` describes the estimate-PDF email path. Marketing consent stays separate, optional, and unchecked. Owner should re-confirm wording before enabling live delivery.

## Evidence

- `fictitious-personalized-estimate.pdf` — Alex Sample, $12,000, flooring not included. No “example only” label; keeps the preliminary / not-a-quote disclaimer.
- Phone/desktop smoke screenshots from local Playwright runs.
- Sample estimate PDF/PNG fingerprints unchanged.
