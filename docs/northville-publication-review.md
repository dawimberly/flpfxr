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
- Complete desktop/mobile browser review before publication approval.
- Vercel automatic deployment is disabled for this branch.

## Scope and estimator behavior
- Desktop More dropdown, scrollable mobile menu, and footer expose Northville Installation and preserve the other active destinations.
- Existing insurance-claim page now returns 404. Related shared copy, service option, navigation, area references, metadata, and homepage/about links were removed to comply with this brief. The customer review uses an ellipsis for its omitted claim-related passage.
- The public estimator shows one rounded combined preliminary price (the existing rounded lower estimate), retaining its quote disclaimer. Pricing arithmetic and list prices are server-side; the browser receives total and safe lead text only. Internal pricing calculations are unchanged. The legacy estimate_range payload key is retained for compatibility and now carries one price.
- Custom projects keep their inquiry handoff without an invented numeric estimate.
- Fixed two pre-existing lint errors: document the JWT fallback catch and explain the PDF ASCII regex exception.

## Verification
- npm test: 226 pass (including three publication/response-boundary tests).
- Estimator/landing tests: 29 pass, one pre-existing calibration TODO skipped pending real jobs from Jon.
- npm run lint: zero errors, 16 pre-existing warnings.
- npm run typecheck: passed after the generated route tree was refreshed.
- Production Vite build and generated server syntax check passed; DB migration command skipped because no DATABASE_URL is configured.
- On Windows the existing npm build wrapper cannot spawn the Vite command shim (ENOENT). Equivalent production pipeline used: node scripts/with-app-env.mjs node node_modules/vite/bin/vite.js build, node scripts/check-server-output.mjs, npm run db:migrate. No remote database was touched.
- Local HTTP checks: /, /northville, /estimate, /estimate?service=bathroom, /kitchen, /bathroom, /about, /services, /contact, /areas return 200. /financing and the retired /insurance-claims return 404.
- Rendered HTTP content checks found no restricted claims or certification wording on those pages. Marketing pages have no dollar amounts; kitchen and bathroom estimator pages each show one combined price.
- Sitemap includes /northville and excludes /financing and /insurance-claims.
- Updated existing browser smoke assertions for the single-price presentation; browser smoke and visual layout verification were NOT completed. The extension failed, the in-app browser could not reach this host, and Windows Computer Use stopped because it could not confidently identify the current URL. Do not treat source review as desktop/mobile visual approval.
