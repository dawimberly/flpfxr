# Public cleanup review

Base: main `9ee3d6af286643dee7cb4bef1f2dd995750b2f0e`. Do not merge or deploy.

- Changed: page-specific OG/Twitter text on public route heads, including area/resource details; descriptive San Antonio estimate title; appointment-guide budget request removed; two Eileen spellings corrected. Kitchen positioning and shared navigation/footer were already correct and are unchanged.
- Independent read-only review found no blocking defect. One-shot/streaming injection, every UTF-8 split boundary, reinjection idempotence, article image/type, canonicals, robots, and JSON-LD preservation were checked. The fixed estimate title changes the existing analytics `page_title` value; event/conversion logic is unchanged. No title dependency was found in landing selection, query retention, redirects, or calculations.
- #90 overlap: only `src/routes/privacy.tsx`; this PR wraps its head metadata, while #90 edits body copy in separate hunks. No estimator/customer-email components overlap. Availability loading text remains deferred.
- Removed 20 screenshots and `smoke-results.json` from the PR diff. Screenshot evidence remains linked in the PR description; future smoke output is a CI artifact, not tracked source.
- Existing per-branch Vercel deployment-disabled pattern is retained for this branch only; remove that entry after merge. No production settings were changed.

Verification: application tests, metadata/injector regressions, pricing/security scan, planner redirects, typecheck, lint, and the complete production build chain pass (one existing application skip; 16 existing lint warnings). The Windows npm wrapper still fails with `spawn vite ENOENT`; the equivalent full Node build chain passes. Migration is skipped with no DATABASE_URL. Built output for kitchen, bathroom, estimate, services, Alamo Heights, and the first-appointment guide has one unique document title and each OG/Twitter text tag. Canonical/robots/JSON-LD tags are byte-identical to main, including absent tags; homepage JSON-LD and login noindex also match.

Original CI run [42346999169](https://github.com/dawimberly/flpfxr/actions/runs/42346999169) passed all steps, including public cleanup smoke. Local cold Windows startup exposed the smoke runner’s effective 30-second readiness cutoff; it now uses a 180-second deadline and captures spawn errors. Updated-head smoke/CI results are recorded in the PR description.

Read-only production inspection: Vercel `dpl_CEiucrhtkn1J8DvKr8nW6o3hSoBV` serves main `9ee3d6af286643dee7cb4bef1f2dd995750b2f0e`, matching the base. Live kitchen HTML has broad scope copy and no $10,000 minimum/larger-indoor wording.

Canonicals, indexing, sitemap, structured data, pricing/defaults/ranges, forms, email delivery, tracking code/tags, auth/protected layouts, service areas, sample assets, Northville link, planner query behavior, and call/text controls are unchanged. No real leads/messages, deployments, remote database/environment, or production-setting changes.
