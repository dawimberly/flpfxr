# Public planner tracking and lead handoff

Based on main after PR #51, commit `0693392f3e780440f033dfda02a1da80b747e43b`.

The existing Google tag is reused. No conversion action, label, destination configuration,
enhanced conversion behavior, consent behavior, hostname allowlist, or pricing calculation changes.

## GA4-only events

| Event | Trigger | Parameters |
| --- | --- | --- |
| `estimate_start` | First planner selection/change, size button, or valid handoff | None |
| `estimate_range_shown` | Rendered result enters the viewport, including the initial default | Service, size, relevant material option keys, boolean `custom_sqft` |
| `estimate_out_of_range` | Invalid area input | Service |
| `estimate_handoff_click` | Valid Request an on-site estimate click | Service, size |

All events use the existing `ga4Event` path with `send_to` set only to GA4 and respect
`canTrackGoogle`. Parameters are explicitly projected from allowed options. Bathroom options
also include vanity key and a new-toilet boolean; paint options include preparation and coat keys.
No numeric areas, prices, allowances, free text, or contact details are sent.
Existing GA4 URL sanitization removes search strings and fragments.

Starts dedupe per session; ranges dedupe per service/size/material/custom-area combination.
Changing one custom area to another does not create another event for the same combination.
Out-of-range events dedupe per service/session to avoid sending every invalid keystroke.
Blocked storage falls back to same-document dedupe. Handoff clicks remain per click.
`IntersectionObserver` is disconnected after visibility or on change/unmount; browsers without
it record the rendered range after commit.

## Lead context

The first pathname is recorded once in sessionStorage as `ff-first-landing-path`.
`first_landing_path` is submitted alongside the existing current `landing_path`; existing click-ID
and UTM capture remains unchanged. This is operational lead context, not a new Google event.
If storage is denied, first landing is omitted instead of reporting a later path as first touch.

The planner saves `estimate_service`, `estimate_size`, and the formatted preliminary
`estimate_range` in the existing session draft, separately from the editable message.
The handoff URL contains `origin=estimate`; only that explicit route context uses the saved
metadata and changes Source to `estimate`. Unrelated contact forms keep their own source.
The POST uses separate structured fields, and the server includes them in Jon's email.
The existing subject builder consequently adds `(estimate)`. Missing fields are accepted;
custom projects can have no numeric range. These are visitor-supplied planning details, not a quote.
Successful acceptance clears the draft estimate context. Failed submissions retain it for retry.
No database migration is needed; the new estimate fields are delivered in the email.

## Validation

Run the public estimator pricing tests, `estimate-tracking.test.ts`, and existing lead/Google tests.
The tracking suite checks GA4-only routing, exact safe payloads, dedupe, storage denial,
preview isolation, and `/estimate` → `/contact` first-touch persistence.
Server tests check email metadata after the message is replaced and missing-field compatibility.
The browser smoke checks mobile/desktop, unchanged price outputs, actual handoff and edited-message
POST fields, first landing, successful cleanup, and zero local Google hits.
Every browser lead request is intercepted and answered locally. Unit email delivery is mocked.
This does not verify real ad traffic or a production conversion.
