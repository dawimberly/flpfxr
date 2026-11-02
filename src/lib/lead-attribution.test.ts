import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  attributionFieldsForSubmit,
  buildAttributionSubject,
  captureFirstTouch,
  deviceType,
  formatLeadSource,
  resetMemoryForTests,
  sanitizeLeadAttribution,
  sourceLabel,
  submissionAttribution,
  type CaptureEnv,
} from "./lead-attribution.ts";
import { buildLeadEmailText, buildLeadSubject } from "./lead-delivery.ts";

const submissionId = "550e8400-e29b-41d4-a716-446655440000";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function capture(partial: Partial<CaptureEnv> & { storage?: CaptureEnv["storage"] }) {
  return captureFirstTouch({
    location: partial.location ?? { pathname: "/", hostname: "theflipfixer.com", search: "" },
    referrer: partial.referrer ?? "",
    storage: partial.storage ?? null,
  });
}

describe("source precedence", () => {
  it("follows the starter order and leaves unrecognized Google subdomains as referrals", () => {
    for (const key of ["gclid", "gbraid", "wbraid"] as const) {
      assert.equal(sourceLabel({ [key]: "x", utm_source: "gbp" }), "Google Ads");
    }
    assert.equal(sourceLabel({ utm_source: "google", utm_campaign: "gbp" }), "Business Profile");
    assert.equal(sourceLabel({ utm_source: "google", utm_medium: "google-maps" }), "Business Profile");
    assert.equal(sourceLabel({ utm_source: "Google Business Profile" }), "Business Profile");
    assert.equal(sourceLabel({ utm_content: "gmb" }), "Direct/unknown");
    assert.equal(sourceLabel({ utm_source: "Google My Business" }), "Direct/unknown");
    assert.equal(sourceLabel({ referrer: "www.google.com" }), "Google organic");
    assert.equal(sourceLabel({ referrer: "google.co.uk" }), "Google organic");
    assert.equal(
      sourceLabel({ utm_source: "google", utm_medium: "organic", referrer: "google.com" }),
      "Google organic",
    );
    assert.equal(sourceLabel({ referrer: "maps.google.com" }), "Referral: maps.google.com");
    assert.equal(sourceLabel({ referrer: "notgoogle.com" }), "Referral: notgoogle.com");
    assert.equal(sourceLabel({ referrer: "www.theflipfixer.com" }), "Direct/unknown");
    assert.equal(sourceLabel({}), "Direct/unknown");
    assert.equal(sourceLabel({ heard_from: "Google Ads", source_label: "Google Ads" }), "Direct/unknown");
  });
});

describe("first touch", () => {
  beforeEach(() => {
    resetMemoryForTests();
  });

  it("keeps the first page and ignores later params", () => {
    const storage = memoryStorage();
    const first = captureFirstTouch({
      location: { pathname: "/start", hostname: "example.com", search: "?gclid=first" },
      referrer: "https://google.com/search",
      storage,
    });
    const second = captureFirstTouch({
      location: { pathname: "/next", hostname: "example.com", search: "?gclid=second" },
      storage,
    });
    assert.deepEqual(second, first);
    assert.equal(first.gclid, "first");
    assert.equal(first.landing_path, "/start");
    assert.equal(first.referrer, "google.com");
  });

  it("does not fill a click id that was absent on the first page", () => {
    const storage = memoryStorage();
    capture({
      storage,
      location: { pathname: "/", hostname: "theflipfixer.com", search: "" },
    });
    const later = capture({
      storage,
      location: { pathname: "/contact", hostname: "theflipfixer.com", search: "?gclid=later-click" },
      referrer: "https://ads.example/landing",
    });
    assert.equal(later.gclid, undefined);
    assert.equal(later.landing_path, "/");
    assert.equal(later.referrer, undefined);
    assert.equal(sourceLabel(later), "Direct/unknown");
  });

  it("does not overwrite a legacy click id already stored for the tab", () => {
    const storage = memoryStorage();
    storage.setItem("ff-gclid", "legacy-click");
    const touch = capture({
      storage,
      location: { pathname: "/roof", hostname: "theflipfixer.com", search: "?gclid=new-click&utm_source=gbp" },
      referrer: "https://www.google.com/",
    });
    assert.equal(touch.gclid, "legacy-click");
    assert.equal(touch.utm_source, undefined);
    assert.equal(touch.landing_path, "/roof");
    assert.equal(touch.referrer, "www.google.com");
  });
});

describe("blocked storage", () => {
  beforeEach(() => {
    resetMemoryForTests();
  });

  it("still returns the landing path when storage throws", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    assert.equal(
      captureFirstTouch({ location: { pathname: "/page", search: "" }, storage }).landing_path,
      "/page",
    );
  });

  it("keeps the first touch in memory when storage keeps throwing", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    const first = capture({
      storage,
      location: { pathname: "/a", hostname: "theflipfixer.com", search: "?utm_source=first-touch" },
    });
    const second = capture({
      storage,
      location: { pathname: "/b", hostname: "theflipfixer.com", search: "?utm_source=second-touch" },
      referrer: "https://other.example/",
    });
    assert.equal(first.utm_source, "first-touch");
    assert.equal(first.landing_path, "/a");
    assert.deepEqual(second, first);
  });

  it("returns an empty note when the window itself is unusable", () => {
    const prevWindow = (globalThis as { window?: unknown }).window;
    Object.assign(globalThis, {
      window: new Proxy(
        {},
        {
          get() {
            throw new Error("no window");
          },
        },
      ),
    });
    try {
      assert.deepEqual(attributionFieldsForSubmit(), {});
    } finally {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = prevWindow;
    }
  });
});

describe("malformed attribution inputs", () => {
  it("drops control characters, bad paths, and values outside the allowlists", () => {
    const clean = sanitizeLeadAttribution({
      gclid: "abc\r\nBcc: attacker@example.com",
      utm_source: "<script>alert(1)</script>",
      utm_campaign: `${"a".repeat(600)}`,
      referrer: "evil.com\n",
      landing_path: "/contact/../secret",
      submitting_path: "https://theflipfixer.com/contact?email=person@example.com",
      page_url: "javascript:alert(1)",
      device: "unique-fingerprint",
      heard_from: "A friend told me off-list",
      source_label: "Google Ads",
    });
    assert.equal(clean.gclid, undefined);
    assert.equal(clean.utm_source, undefined);
    assert.equal(clean.utm_campaign?.length, 500);
    assert.equal(clean.referrer, "evil.com");
    assert.equal(clean.landing_path, undefined);
    assert.equal(clean.submitting_path, "/contact");
    assert.equal(clean.page_url, undefined);
    assert.equal(clean.device, undefined);
    assert.equal(clean.heard_from, undefined);
    assert.equal(clean.source_label, "Referral: evil.com");
  });

  it("uses the starter device buckets", () => {
    assert.equal(deviceType(400), "mobile");
    assert.equal(deviceType(800), "tablet");
    assert.equal(deviceType(1400), "desktop");
    assert.equal(deviceType(1400, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "mobile");
    assert.equal(deviceType(1400, "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
    assert.equal(deviceType(1400, "Mozilla/5.0 (Linux; Android 14)"), "mobile");
    assert.equal(sanitizeLeadAttribution({ device: "mobile" }).device, "mobile");
    assert.equal(sanitizeLeadAttribution({ device: "Mobile/fingerprint" }).device, undefined);
  });
});

describe("lead source email formatting", () => {
  const payload = {
    submissionId,
    name: "Example Person",
    email: "person@example.com",
    phone: "5555550100",
    phoneDigits: "5555550100",
    message: "Example job note",
    service: "roofing",
    source: "contact",
    affiliation: "",
    honey: "",
  };

  it("appends the starter lead source block and puts the label in the subject", () => {
    const adIds = sanitizeLeadAttribution({
      gclid: "test-gclid-example",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring-example",
      utm_term: "roof-repair",
      utm_content: "ad-a",
      referrer: "ads.example",
      landing_path: "/services",
      submitting_path: "/contact",
      device: "desktop",
      heard_from: "Google Ads",
    });
    const text = buildLeadEmailText({ ...payload, adIds });
    const block = formatLeadSource(adIds);
    assert.match(block, /--- Lead source ---/);
    assert.match(block, /Source: Google Ads/);
    assert.match(block, /How did you hear about us: Google Ads/);
    assert.match(block, /gclid: test-gclid-example/);
    assert.match(block, /gbraid: \(none\)/);
    assert.match(block, /referrer: ads\.example/);
    assert.match(block, /landing_path: \/services/);
    assert.match(block, /submitting_path: \/contact/);
    assert.match(block, /device: desktop/);
    assert.equal(text.includes(block), true);
    assert.equal(
      buildLeadSubject("roofing", "contact", adIds.source_label),
      "The Flip Fixer — roofing (contact) [Google Ads]",
    );
    assert.equal(
      buildAttributionSubject("roofing", "contact", adIds.source_label),
      buildLeadSubject("roofing", "contact", adIds.source_label),
    );
    const submit = submissionAttribution(
      { gclid: "test-gclid-example", landing_path: "/services" },
      { pathname: "/contact", width: 1400, userAgent: "Mozilla/5.0", heardFrom: "Google Ads" },
    );
    assert.equal(submit.submitting_path, "/contact");
    assert.equal(submit.device, "desktop");
    assert.equal(submit.heard_from, "Google Ads");
  });

  it("strips injected line breaks from the subject and the lead source block", () => {
    const adIds = sanitizeLeadAttribution({
      gclid: "ok\r\nBcc: attacker@example.com",
      utm_source: "newsletter\nBcc: attacker@example.com",
      heard_from: "Other\r\nBcc: hidden@example.com",
      landing_path: "/contact\r\nBcc: hidden@example.com",
    });
    const text = buildLeadEmailText({ ...payload, adIds });
    const subject = buildLeadSubject(
      "roofing\r\nBcc: hidden@example.com",
      "contact\nBcc: hidden@example.com",
      "Google Ads\r\nBcc: hidden@example.com",
    );
    assert.equal(subject.includes("\n"), false);
    assert.equal(subject.includes("\r"), false);
    assert.match(subject, /\[Direct\/unknown\]/);
    assert.match(subject, /The Flip Fixer/);
    assert.match(text, /Source: Direct\/unknown/);
    assert.match(text, /How did you hear about us: \(not provided\)/);
    assert.equal(text.includes("Bcc:"), false);
    assert.equal(text.includes("<script>"), false);
  });
});
