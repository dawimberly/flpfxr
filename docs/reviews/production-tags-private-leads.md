# Production tracking and private lead log — review only

Base: main a7a5303. Branch: review/production-tags-private-leads.

## Changes

- GoogleTag returns before configuration, script injection, or page views unless the browser hostname exactly equals theflipfixer.com or www.theflipfixer.com. The shared gtag dispatcher independently enforces the same allowlist, including when another caller invokes a tracking helper.
- Enhanced conversion contact data is scoped to the Ads conversion event instead of setting global user_data. GA4 event payloads do not receive contact fields. Every explicit GA4 event and config call receives sanitized page_location and page_referrer values. Safe config defaults refresh after SPA navigation; global user_data is not set. Explicit page-view URLs also omit queries/fragments.
- Existing contact_leads remains the private database log, keyed by submission_id; optional gclid and other attribution remain in ad_ids. A new migration adds contact_status, qualification, quote_amount, booked_job, is_test and updated_at, plus a gclid lookup index.
- A private database view supplies business totals, excluding failed email delivery, spam, flagged tests, and the explicitly excluded test ID. Unreviewed and unqualified real inquiries remain inquiries; qualification and booked-job totals are separate.
- Known test 89184cbd-8083-4fe0-948d-595de1614cf7 is excluded even if is_test is later cleared. Existing row is flagged by migration; a later backfill is excluded by ID and new intake checks the exclusion table.
- Operator CLI uses existing database credentials. No public lead-read/update endpoint or customer-data file is added. No intake field requirements were changed; phone-only leads remain accepted.

## Private operator use after deployment approval

Provide DATABASE_URL through the existing private environment. Do not place credentials in commands or commit exports.

```sh
node scripts/lead-log.mjs summary
node scripts/lead-log.mjs list
node scripts/lead-log.mjs update SUBMISSION_UUID contact_status attempted
node scripts/lead-log.mjs update SUBMISSION_UUID qualification qualified
node scripts/lead-log.mjs update SUBMISSION_UUID quote_amount 2500.00
node scripts/lead-log.mjs update SUBMISSION_UUID booked_job true
node scripts/lead-log.mjs update SUBMISSION_UUID is_test true
```

Status values: new/attempted/connected/closed; qualification: unreviewed/qualified/unqualified/spam. Quote amount is nullable until entered. List returns up to 100 eligible records and attribution, without names, emails, phones, messages, or client IPs. Use the business notification's submission ID to update the corresponding record. No automated qualification or automatic offline Ads uploads are introduced.

## Verification and limitations

- Focused tracking/intake tests: 34 passed. All library tests after review fixes: 187 passed.
- PGLite integration test verifies migration, phone-only record with blank attribution, attribution preservation, operator updates, no contact fields in view, and test exclusion.
- Local build: npm run build:dev passed (no production migration).
- Full script suite: 181 passed, 16 failed. Untouched main has the same 16 failures (180 passed); they concern missing template .grok resources and existing template assumptions. The migration-list test was updated for migration 0004.
- Typecheck reports existing errors in unrelated estimator/roof/gallery files. Compared against untouched main: identical diagnostics. This branch is not represented as having a clean full suite/typecheck.
- Intercepted Playwright browser smoke passed on virtual theflipfixer.com and www.theflipfixer.com origins served entirely from local Vite. Preview and localhost queue zero Google calls and make zero Google requests. The test verifies safe GA4 config/event contexts, Ads-only enhanced data, one conversion on mocked acceptance, no conversion on mocked abort/502 or duplicate replay, and preserved form fields after failure. External requests are intercepted; /api/leads is mocked. This verifies application dispatch, not actual Google tag transport, enhanced measurement configuration, or Ads attribution. No deployed preview or production browser check was run. No live submission, Ads change, production DB read/write, or deployment was performed.
- Existing persistence semantics are retained: if DATABASE_URL is absent, no durable intake record is saved; if persistence fails after email delivery, the visitor still receives success to prevent duplicate inquiries. Before rollout, confirm a durable private database is configured and migration succeeds. Email history is not backfilled by this branch.
- Consent interpretation remains unverified. Consent configuration, account goals, budgets, bidding, campaign status, and domain suggestions are unchanged.

## Review and rollout

Review the diff first. Do not publish or merge until deployment is authorized. Deploy code and migration 0004 together when authorized, then verify both production hostname variants and that a preview emits no Google tracking requests. The existing successful network test is evidence for the prior deployment only, not this branch.

Rollback code to the previous commit if needed; leave the additive migration/data intact. Do not drop lead records or undo the test exclusion as part of rollback.

## Read-only review corrections

The first review identified incomplete GA4 context sanitation and an outdated localhost smoke test. Both are corrected in the follow-up commit. Browser interception now verifies both allowed hosts and excluded hosts without a live submission. The standard Playwright browser download was unavailable in this environment; the passing run used an isolated Chromium executable via LEAD_SMOKE_CHROMIUM. No dependency or lockfile changes were needed. The existing best-effort persistence limitation remains as documented above.

## Second review: test coverage expansion

The complete mocked form flow now runs separately on both production origins, including double-click success, network failure followed by retry, duplicate replay, 502 delivery failure, and preservation of form fields. Blocking checks cover the five reported deployment preview hosts plus a generic preview, look-alike and subdomain hosts, a trailing-dot host, and localhost. Unit allowlist cases also include uppercase raw strings and both trailing-dot variants. Browser URL parsing normalizes uppercase hosts before the application sees them; the raw helper itself remains an exact-match function.

No application code or database permissions changed in this follow-up. Database-role exposure and real GA4 automatic-event behavior remain unverified operational risks, not confirmed defects. The view intentionally counts only emailed inquiries; it is not a complete intake-attempt count. Sanitized persistence diagnostics and that reporting design remain follow-up considerations.
