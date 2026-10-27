import { test } from "node:test";
import assert from "node:assert/strict";
import { captureFirstTouch, sourceLabel } from "./lead-attribution.ts";

test("source label respects click ID and profile precedence", () => {
  for (const key of ["gclid", "gbraid", "wbraid"] as const) assert.equal(sourceLabel({ [key]: "test", utm_source: "gbp", referrer: "google.com" }), "Google Ads");
  for (const source of ["gbp", "Google Business Profile", "google_business_profile", "google maps"]) assert.equal(sourceLabel({ utm_source: source, referrer: "google.com" }), "Business Profile");
  assert.equal(sourceLabel({ utm_source: "google", utm_campaign: "gbp" }), "Business Profile");
});

test("source label distinguishes Google, other referrals and direct", () => {
  assert.equal(sourceLabel({ referrer: "www.google.com" }), "Google organic");
  assert.equal(sourceLabel({ referrer: "google.co.uk" }), "Google organic");
  assert.equal(sourceLabel({ referrer: "notgoogle.com" }), "Referral: notgoogle.com");
  assert.equal(sourceLabel({ referrer: "example.org" }), "Referral: example.org");
  assert.equal(sourceLabel({}), "Direct/unknown");
});

test("first touch is retained after navigation", () => {
  const entries = new Map<string, string>();
  Object.assign(globalThis, { window: { location: { search: "?gclid=first&utm_term=kitchen", pathname: "/kitchen" } }, document: { referrer: "https://www.google.com/search?q=test" }, sessionStorage: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) } });
  try {
    const first = captureFirstTouch();
    assert.equal(first.gclid, "first");
    assert.equal(first.referrer, "www.google.com");
    Object.assign(window.location, { search: "?gclid=second", pathname: "/contact" });
    assert.deepEqual(captureFirstTouch(), first);
  } finally {
    for (const key of ["window", "document", "sessionStorage"]) Reflect.deleteProperty(globalThis, key);
  }
});
