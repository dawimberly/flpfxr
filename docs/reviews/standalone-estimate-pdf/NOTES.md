# Standalone estimate PDF action

Base: main 63d78ff6299b910ef8bfb5dc5b3e494d22d5bd62. Do not merge or deploy.

The existing PDF/follow-up action sat below the on-site CTA and disappeared during availability checks/unavailability. It now stays visible directly after the total/disclaimer, ahead of the on-site action and size/material controls. Mobile uses a full-width outlined button, clear of the sticky call/text bar.

Availability is a GET only, with a 10-second deadline, abort/cleanup guards, clear failure/unavailable messages and retry. First click only reveals the existing form. The action explains that completing the form requests follow-up and does not email the customer. Existing form fields, consent/privacy text, submission payload, saved snapshot/PDF and Jon-notification server code are unchanged. A changed estimate starts a fresh download request.

Mocked browser regressions cover loading, available, unavailable, HTTP failure, network failure, invalid JSON and timeout/retry at 390px and 1280px. Mutation APIs and external traffic are blocked; initial click/retry assertions require zero mutation requests. Existing follow-up/PDF smoke tests and the application suite provide delivery-behavior regression coverage without real email.

Screenshots: [390px](pdf-action-390.png), [1280px](pdf-action-1280.png). These show local development output; no production forms were submitted.

Open PR #90 also modifies both estimator UI components and the existing estimator smoke script. This PR deliberately excludes its range/customer-email changes; those overlapping edits will need reconciliation before either PR is merged after the other.

Pricing/calculation/range/default logic, PDF contents, saved-record schema, tracking, navigation, other page copy and remote settings are untouched. The branch-only Vercel safeguard prevents automatic deployment.

Validation: all 12 mocked PDF UI scenarios pass; application suite 304 passed/1 existing skip; metadata/injector 49 passed; pricing/security 31 passed; planner redirects 4 passed; lint 0 errors/16 existing warnings; typecheck and complete build chain pass (Windows Node workaround; migration skipped without DATABASE_URL). Existing planner smoke passed the mobile run and isolated desktop rerun; the first combined run timed out in unchanged desktop contact-email validation. CI reruns the full suite.
