# Optional flooring + estimate download / follow-up

## Flow (simplified)

Visitors keep the on-screen preliminary estimate without contact details. “Download estimate & request follow-up” collects optional name, email **or** phone (at least one), and a required five-digit ZIP. Submission:

1. Saves the lead (validated selections + server total + ZIP/contact)
2. Issues a gated personalized PDF download (snapshot bytes; not the example PDF)
3. Notifies **only** `jon@theflipfixer.com` via the existing Resend contact-form path

No customer email. No marketing opt-in on this form.

## Updated default totals (flooring excluded by default)

| Project | Size | Without flooring (new default) | With flooring |
| --- | --- | ---: | ---: |
| Kitchen | Small | $9,600 | $11,000 |
| Kitchen | Medium | $12,000 | $13,300 |
| Kitchen | Large | $17,500 | $19,100 |
| Bathroom | Small | $5,900 | $6,100 (LVP) / $6,900 (tile) |
| Bathroom | Medium | $8,000 | $8,300 (LVP) / $9,300 (tile) |
| Bathroom | Large | $10,300 | $10,700 (LVP) / $13,300 (tile) |
| Flooring | Medium | n/a (always included) | $3,600 |

**Large bathroom $10,300 → $13,300:** flooring checked + ceramic tile on the Large preset floor area (+$3,000 combined). Public output never shows a separate flooring price.

## Configuration still needed

1. `DATABASE_URL` — required to save leads and issue PDF tokens (fails closed without it)
2. `RESEND_API_KEY` + usable `LEAD_FROM_EMAIL` — required for Jon’s notification (lead/PDF can still succeed without it; UI reports notification pending)
3. Owner review of `/privacy` wording for this flow

Do **not** enable retired `ESTIMATE_EMAIL_DELIVERY`. Recipient is hardcoded to Jon; browser cannot set it.

## Evidence

- `fictitious-personalized-estimate.pdf` — Alex Sample, $12,000, flooring not included
- Phone/desktop smoke screenshots
- Sample $12,800 example PDF/PNG fingerprints unchanged
