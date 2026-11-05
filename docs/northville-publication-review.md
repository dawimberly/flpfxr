# Northville and trust updates — review gate

Base: dawimberly/flpfxr main at 9f14c5abc9ad52f5f7c30ada05f4b27f71980eda.
Branch: feat/northville-trust-review. No merge or deployment is authorized.

## Content evidence
Checked November 4, 2026:
- https://www.northvillecabinetry.com/door-styles-and-finishes
- https://www.northvillecabinetry.com/

The manufacturer lists all seven names used on /northville: Elegant White, Grey Shaker, Blue Shaker, Metallic Shaker, Antique White, Midnight Espresso, Cognac.
These are described as manufacturer-listed styles to discuss, rather than a record of lines already installed by this contractor. Jon must confirm the accepted installation lines before publication.
No wood-species, hardware, dimensions, stock, warranty, certification, dealer status, or performance claim is made. Manufacturer construction descriptions conflict between pages and were intentionally omitted.
No Northville artwork or purported Northville project photography is included. Existing gallery photos could not establish the cabinet brand.

## Approval gates
- PUBLICATION_FLAGS.northvilleCertificationVerified stays false until Jon provides certification documentation and the wording is reviewed.
- Artwork requires official files AND written permission separately; turning on certification does not add artwork.
- PUBLICATION_FLAGS.financingApproved stays false. /financing throws a router notFound before rendering, with noindex metadata; no navigation or sitemap entry exists. Only the approved sentence is prepared.
- Jon must confirm the seven installation options and approve the installation process and homepage trust language.
- Desktop/mobile browser review is complete; Jon still needs to approve publication.
- Vercel automatic deployment is disabled for this branch.

## Scope and estimator behavior
- Desktop More dropdown, scrollable mobile menu, and footer expose Northville Installation and preserve the other active destinations.
- The retired /insurance-claims URL and trailing-slash variant permanently redirect to /services through Vercel configuration. Related service/type references and public copy are removed. The edited featured review is withheld pending an authentic replacement.
- The public estimator shows the computed combined total rounded to the nearest $100, retaining its quote disclaimer. It receives only that total and safe lead text. New handoffs use estimate_price; legacy estimate_range remains readable. Crew pricing chunks are served only after real session verification.
- Custom projects keep their inquiry handoff without an invented numeric estimate.
- Fixed two pre-existing lint errors: document the JWT fallback catch and explain the PDF ASCII regex exception.

## Verification
- npm run test:app: 231 pass, including strict input, authenticated asset delivery, legacy metadata and redirect regressions.
- npm run lint: zero errors, 16 existing warnings. npm run typecheck: passed.
- Production build, private-asset extraction/public-output scan and generated server syntax check passed in GitHub Actions. DB migrations skip without DATABASE_URL; no remote database was touched.
- Packaged production HTTP checks: three confidential chunks are absent from static URLs (404), anonymous authenticated-asset URLs return 401 with private/no-store, /estimator redirects anonymous visitors to /login, and /financing returns 404. Verified-session asset delivery is unit tested; the complete signed-in crew workflow has not been exercised with real credentials.
- Browser checks cover homepage/Northville navigation, phone and estimator links at 390, 1280, 1366, 1440 and 1600 pixels. Laptop header screenshots were visually inspected with no overlap. Estimator retry checks reserve the same height while loading and clear stale errors. Lead delivery is mocked; no real leads or conversions are submitted.
- Full repository npm test previously exposed 17 existing template-tooling failures (180 tooling tests passed): missing .grok fixtures, auth-off assumptions, OG template identity assumptions and obsolete auth schema layout. Those tooling tests are unchanged; do not describe the full repository suite as clean.
- Final CI run and screenshot evidence are recorded in PR #67. Vercel branch automatic deployment remains disabled.

## PR #67 review corrections
- Both /insurance-claims URL variants have explicit permanent 301 redirects to /services in vercel.json. Old service/type options are removed. Provider redirect rules are checked from configuration without deploying.
- Inline navigation starts at xl (1280px). Between xl and 2xl the call control is icon-only with an accessible label, the text action is hidden, and navigation spacing is tighter. Checks cover 1280, 1366, 1440, and 1600px, plus mobile.
- Failed estimator requests clear their error state when retried. Loading and price content share reserved space. Strict validation rejects malformed, extra, nonfinite, and out-of-bounds input with a JSON HTTP 400 response.
- Kerrville contact links now preselect kitchen remodeling. Unrelated make-ready links are preserved.
- Next-step copy refers to your preliminary estimate without promotional prices, free-estimate/inquiry or range wording. Roof copy invites a specialist inspection without discount/free claims.
- The edited featured review is withheld. Dan selected the option to provide a verified replacement, but no complete review text/source has yet been supplied. No replacement wording is invented. Other existing reviews are unchanged. This item remains pending.
- New handoffs use estimate_price. Legacy estimate_range drafts and incoming payloads remain readable; email prefers estimate_price.
- The single displayed price is the computed project total rounded to the nearest $100: Math.round(total / 100) * 100. The former high value was the computed total plus a 25% cushion, rounded to $100; that cushion is no longer displayed. It was not a calibrated confidence bound.
- Confidential crew chunks are identified from build-module provenance, rewritten to authenticated /api/employee-assets URLs, and removed from Vercel static output. The endpoint verifies a real session and sends private/no-store responses; it does not accept the development fallback identity. Public output is scanned for MSRP, labor-rate, and pricing-internal markers, with the build failing on a match. Production-output HTTP checks verify former static URLs return 404 and anonymous private URLs return 401. Handler tests also exercise verified-session delivery.
- Certification and financing remain off; no Northville artwork is added.
