# Optional flooring + estimate download / follow-up

## Release gate (default OFF)

`ESTIMATE_FOLLOWUP_ENABLED` must be explicitly set to `1`/`true`/`yes` before the download/follow-up form is offered. Leave it unset in production until owner approval. Availability GET and submission POST both require the flag plus **durable** storage (`DATABASE_URL`). On Vercel/serverless, in-memory PGLite is never accepted for this feature. Local/smoke may set `ESTIMATE_FOLLOWUP_ALLOW_EPHEMERAL_STORAGE=1` (never on Vercel).

## Flow

Visitors keep the on-screen preliminary estimate without contact details. When the feature is enabled, **Download estimate & request follow-up** collects optional name, email **or** phone (at least one), and a required five-digit ZIP. Submission:

1. Atomically claims the submission ID (unique constraint)
2. Persists lead + immutable PDF snapshot (transaction when available)
3. Issues a gated personalized PDF download
4. Notifies **only** `jon@theflipfixer.com` via the existing Resend path (outside the DB transaction; durable idempotency key)

No customer email. No marketing opt-in on this form.

## Proposed privacy wording (for owner approval — not an approval by itself)

> When you choose “Download estimate & request follow-up,” we collect a five-digit ZIP code and at least one of email or phone (name is optional). We store your project selections with the server-calculated preliminary total, provide a private personalized PDF download for those selections, and notify The Flip Fixer so we can contact you about that project. We do not email the estimate PDF to you and we do not subscribe you to marketing from that form. A private download link expires after a limited time and is not meant to be shared.

This text is what `/privacy` currently shows (without internal review notes). Owner should confirm before relying on it for live traffic with the feature enabled.

## Flooring defaults

| Project | Size | Without flooring | With flooring |
| --- | --- | ---: | ---: |
| Kitchen | Medium | $12,000 | $13,300 |
| Bathroom | Large | $10,300 | $10,700 (LVP) / $13,300 (tile) |

Optional flooring calculations and tests preserved. Sample $12,800 example PDF fingerprint unchanged.

## Configuration still needed (do not flip in this PR)

1. Owner approval of privacy wording above
2. `ESTIMATE_FOLLOWUP_ENABLED=1` only after approval
3. Production `DATABASE_URL` / Neon (required; ephemeral PGLite is blocked on Vercel)
4. `RESEND_API_KEY` + verified `LEAD_FROM_EMAIL` for Jon notification (lead/PDF can succeed without it; UI reports pending)
5. Do **not** set `ESTIMATE_FOLLOWUP_ALLOW_EPHEMERAL_STORAGE` in production

## Northville link

Kitchen cabinet finish selector shows “Browse Northville cabinet styles” → `https://www.northvillecabinetry.com/` (`target=_blank`, `rel=noopener noreferrer`, accessible new-tab indication). No imported pricing, logos, or certification claims.
