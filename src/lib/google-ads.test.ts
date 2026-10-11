import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GA4_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  GOOGLE_ADS_LEAD_SEND_TO,
  GOOGLE_ADS_WEBSITE_CALL_SEND_TO,
  pagePathFromLocation,
  trackContactFormSubmit,
  trackFormStart,
  trackPageView,
  consumePendingLeadSubmit,
  markLeadSubmitPending,
  trackPhoneClick,
  trackSmsClick,
} from "./google-ads.ts";

describe("pagePathFromLocation", () => {
  it("keeps the homepage as / so ads landing sessions do not collapse into (not set)", () => {
    assert.equal(pagePathFromLocation("/"), "/");
    assert.equal(pagePathFromLocation("", ""), "/");
  });

  it("keeps contact search on the path so kitchen vs roofing landings stay split in GA", () => {
    assert.equal(
      pagePathFromLocation("/contact", "?service=kitchen&side=interior"),
      "/contact?service=kitchen&side=interior",
    );
    assert.equal(pagePathFromLocation("/contact", ""), "/contact");
  });

  it("keeps kitchen ads landings on /kitchen so they are not a 1s redirect bounce", () => {
    assert.equal(pagePathFromLocation("/kitchen"), "/kitchen");
  });
});

type Call = unknown[];

describe("ads events", () => {
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      window: {
        dataLayer: [],
        gtag: (...args: unknown[]) => {
          calls.push(args);
        },
        location: { href: "https://theflipfixer.com/contact?service=kitchen" },
      },
      document: { title: "Contact | The Flip Fixer" },
      sessionStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  it("sends page views to GA4 and the Ads tag, not to a conversion label", () => {
    trackPageView("/contact?service=kitchen");
    const destinations = calls.map((call) => (call[2] as { send_to?: string }).send_to);
    assert.deepEqual(destinations, [GA4_MEASUREMENT_ID, GOOGLE_ADS_ID]);
    assert.equal(destinations.includes(GOOGLE_ADS_WEBSITE_CALL_SEND_TO), false);
    assert.equal(destinations.includes(GOOGLE_ADS_LEAD_SEND_TO), false);
  });

  it("counts a form lead once, and does not count a call or text tap as an Ads conversion", () => {
    trackContactFormSubmit({
      name: "Jon Smith",
      email: "jon@theflipfixer.com",
      phone: "(210) 436-9117",
    });
    trackContactFormSubmit({ name: "Jon Smith", email: "jon@theflipfixer.com" });
    trackPhoneClick();
    trackSmsClick();
    trackFormStart();
    trackFormStart();

    const conversions = calls.filter((call) => call[1] === "conversion");
    assert.equal(conversions.length, 1);
    assert.equal(
      (conversions[0][2] as { send_to: string }).send_to,
      GOOGLE_ADS_LEAD_SEND_TO,
    );

    const names = calls.map((call) => call[1]);
    assert.equal(names.filter((name) => name === "generate_lead").length, 1);
    assert.equal(names.filter((name) => name === "click").length, 2);
    assert.equal(names.filter((name) => name === "form_start").length, 1);
    for (const call of calls) {
      if (call[0] !== "event" || call[1] === "conversion") continue;
      assert.equal((call[2] as { send_to?: string }).send_to, GA4_MEASUREMENT_ID);
    }
  });

  it("counts a full-page form redirect only when this submit marked it pending", () => {
    assert.equal(consumePendingLeadSubmit(), false);
    markLeadSubmitPending();
    assert.equal(consumePendingLeadSubmit(), true);
    assert.equal(consumePendingLeadSubmit(), false);
    trackContactFormSubmit({
      name: "Jon Smith",
      email: "jon@theflipfixer.com",
      phone: "2104369117",
    });
    const conversions = calls.filter((call) => call[1] === "conversion");
    assert.equal(conversions.length, 1);
  });

  it("does not load the Tag Manager container that counted page views as leads", () => {
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    assert.equal(root.includes("GTM-"), false);
    assert.equal(root.includes("googletagmanager.com/gtm.js"), false);
    assert.equal(root.includes("googletagmanager.com/ns.html"), false);
  });
});
