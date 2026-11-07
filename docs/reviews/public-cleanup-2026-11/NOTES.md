# Public website cleanup review

Base: current `main`, `9ee3d6af286643dee7cb4bef1f2dd995750b2f0e` (November 7, 2026). Branch: `fix/public-site-cleanup`. Do not merge or deploy.

## Verified findings and changes

| Item | Observed on current main | Result |
| --- | --- | --- |
| Kitchen minimum-price positioning | Kitchen already uses the broad residential remodeling/construction `PROJECT_FIT` copy; no public $10,000 minimum or larger-indoor-remodel positioning was present. Live kitchen HTML also had no $10,000 minimum. | No positioning rewrite or new price introduced. |
| Budget requests | Public source search found a request to share a budget range in the first-appointment resource article. The other remaining public budget references describe estimating concepts or are existing testimonial wording. | Replaced only that request and its section heading with priorities/inspiration-photo wording. No form changes. |
| Public navigation/footer | Every public route uses the root `SiteShell`, `SiteHeader`, and `SiteFooter`, including kitchen and dynamic area/blog pages. Kitchen already includes Estimate and Resources. | Shared chrome left unchanged; browser regressions compare navigation destinations and complete footer links, including service areas. |
| Social text | The HTML injector stripped route social metadata and substituted the site identity, producing the generic live kitchen `og:title`. Most routes lacked Twitter text tags. | One route metadata helper supplies page-specific OG/Twitter text. Both streaming and ordinary injection preserve the complete route-owned set, including existing article images/type. Employee/app surfaces without that set retain their previous injection behavior. |
| Estimate metadata | Default title was “Plan your next project.” | Title is “San Antonio Remodeling & Handyman Estimator”; description explicitly includes kitchen, bathroom, flooring, painting, and handyman projects in San Antonio. UI headings/search validation/calculations remain unchanged. |
| Name | Whole tracked-repository search found two misspellings: shared featured-review name and Dominion page attribution. | Corrected both to Eileen. Quotation text, other names, and locations are unchanged. |
| Insurance claims | No insurance-claim service/footer wording was present in the current kitchen/shared footer. Existing retired-route behavior was present. | No insurance wording or route behavior added, removed, or rewritten; no business-insurance claim introduced. |

## Deferred item

Estimate availability loading text is deliberately unchanged. Open [PR #90](https://github.com/dawimberly/flpfxr/pull/90), head `62a29a1943400c7787685e2b97a72bfc0bd6e8cd` at inspection, changes `src/components/email-my-estimate.tsx` and the public estimator. Per the requested conflict rule, this cleanup does not touch either component, availability outcomes, status announcements, or loading-state tests. Revisit the compact loading state after that PR merges.

## Changed pages

- Social text: homepage, kitchen, bathroom, services, gallery, contact (including existing service-specific search variants), resources index and all resource details, areas index and all five area details, about, community, reviews, privacy, estimate, and the existing estimate-payment/roof route metadata declarations.
- Visible text: first-remodeling-appointment resource detail; homepage/reviews via the shared Eileen name; Dominion attribution.
- Header/footer markup and copy: unchanged on every page.

## Before/after screenshots

Local preview at 390px and 1280px; external services blocked and no forms submitted. Full-page captures can contain offscreen lazy-image placeholders.

| Page | Mobile before / after | Desktop before / after |
| --- | --- | --- |
| Homepage | [Before](before-home-390.png) / [After](after-home-390.png) | [Before](before-home-1280.png) / [After](after-home-1280.png) |
| Kitchen | [Before](before-kitchen-390.png) / [After](after-kitchen-390.png) | [Before](before-kitchen-1280.png) / [After](after-kitchen-1280.png) |
| Estimate | [Before](before-estimate-390.png) / [After](after-estimate-390.png) | [Before](before-estimate-1280.png) / [After](after-estimate-1280.png) |
| Reviews | [Before](before-reviews-390.png) / [After](after-reviews-390.png) | [Before](before-reviews-1280.png) / [After](after-reviews-1280.png) |
| First appointment | [Before](before-appointment-390.png) / [After](after-appointment-390.png) | [Before](before-appointment-1280.png) / [After](after-appointment-1280.png) |

## Preservation and limits

Canonicals, indexing directives, sitemap content/generation behavior, and structured data are unchanged. Pricing/ranges/defaults, form fields/submission/delivery, customer emails, tracking tags/events, auth/protected layouts, service areas, sample PDF/image assets, Northville link, planner redirects/query retention, and call/text controls are unchanged. No real leads or messages were submitted. No database/environment or production settings were changed.

The sole deployment configuration edit disables automatic deployment for this PR branch only, so pushing the review cannot publish a preview. Production deployment configuration and redirects are unchanged.

The standard Windows `npm run build` wrapper failed to spawn `vite` (`ENOENT`). The equivalent complete chain passed with `with-app-env.mjs node node_modules/vite/bin/vite.js build`, followed by PGLite runtime packaging, private-asset protection/output pricing scan, generated-server syntax checks, and the migration script (skipped with no `DATABASE_URL`). Dependency versions and the lockfile are unchanged; package.json only adds the cleanup smoke command.

Production deployment and real lead delivery are intentionally untested. Browser screenshots and smoke assertions use the local preview, not a deployed PR. Loading-state work remains deferred as explained above.

## Check results

- Application suite: 304 passed, 1 existing skip, 0 failures.
- Metadata/helper/injector regressions: 49 passed. Generic injector fixtures now run outside the real site's identity configuration.
- Public pricing/security/private-asset packaging regressions: 31 passed.
- Planner redirect/query preservation regressions: 4 passed.
- Lint: passed, 0 errors and 16 existing warnings. Typecheck: passed.
- Complete production build chain and source/output pricing scans: passed via the Windows workaround above. Public source scan: 185 files; protected 3 employee chunks; generated-server syntax: 4 modules passed.
- Final self-managed local browser smoke: 46 checks across 23 public URLs at 390px and 1280px passed, including active desktop nav, mobile opening/closing, footer/service-area parity, unique titles/descriptions, single OG/Twitter tags, client navigation, call/text links, no overflow, and no uncaught startup errors. Preview server shut down after the run. See [machine-readable results](smoke-results.json).
- Source/diff audit: untouched protected contracts and sample assets verified; no remaining misspelled-name matches; only remaining public budget wording is a category label and existing testimonial text.
