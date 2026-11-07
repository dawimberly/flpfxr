# Optional flooring + personalized estimate PDF/email

## Updated default totals (flooring excluded by default)

Kitchen/bathroom remodel estimates no longer bundle floor covering unless **Include flooring** is checked. Dedicated flooring projects are unchanged.

| Project | Size | Without flooring (new default) | With flooring |
| --- | --- | ---: | ---: |
| Kitchen | Small | $9,600 | $11,000 |
| Kitchen | Medium | $12,000 | $13,300 |
| Kitchen | Large | $17,500 | $19,100 |
| Bathroom | Small | $5,900 | $6,900 |
| Bathroom | Medium | $8,000 | $9,300 |
| Bathroom | Large | $10,300 | $13,300 |
| Flooring | Medium | n/a (always included) | $3,600 |

Older shared links without `includeFlooring` keep working and now show the **without flooring** total. Add `includeFlooring=1` to restore the previous bundled total.

Flooring exclusion removes only the separable floor covering materials/install line (and bathroom tiled-floor setting materials when the floor is tile). Room-area scaling for walls/trim/paint/cabinets is unchanged.

## Delivery configuration (not enabled until verified sender)

Customer estimate email stays disabled until:

1. `RESEND_API_KEY` is set
2. `ESTIMATE_FROM_EMAIL` (or `LEAD_FROM_EMAIL`) is a **verified business sender** such as `The Flip Fixer <leads@theflipfixer.com>`
3. The sender is **not** `onboarding@resend.dev`

Migration `0006_estimate_email.sql` adds `marketing_consent`, `estimate_total_cents`, and `estimate_pdf_downloads`.

## Privacy

`/privacy` now describes the estimate-PDF email path. Marketing consent stays separate, optional, and unchecked.

## Evidence

- `fictitious-personalized-estimate.pdf` — sample personalized PDF for “Alex Sample” ($12,000, flooring not included). Not example-only.
- Phone/desktop smoke screenshots from local Playwright runs.
- Sample estimate PDF/PNG fingerprints unchanged.
