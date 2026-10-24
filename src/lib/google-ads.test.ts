import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isGoogleTrackingHost,
  gtag,
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
  setEnhancedUserData,
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

  it("strips the thank-you flag so replaceState does not add a second page view path", () => {
    assert.equal(pagePathFromLocation("/contact", "?sent=1"), "/contact");
    assert.equal(
      pagePathFromLocation("/contact", "?service=kitchen&sent=1"),
      "/contact?service=kitchen",
    );
  });

  it("keeps kitchen ads landings on /kitchen so they are not a 1s redirect bounce", () => {
    assert.equal(pagePathFromLocation("/kitchen"), "/kitchen");
  });
});

type Call = unknown[];

describe("ads events", () => {
  let calls: Call[];
  let store: Map<string, string>;
  let cookie = "";

  beforeEach(() => {
    calls = [];
    store = new Map();
    cookie = "";
    const location = {
      hostname: "theflipfixer.com",
      href: "https://theflipfixer.com/contact?service=kitchen",
    };
    Object.assign(globalThis, {
      window: {
        dataLayer: [],
        gtag: (...args: unknown[]) => {
          calls.push(args);
        },
        location,
      },
      document: {
        title: "Contact | The Flip Fixer",
        get cookie() {
          return cookie;
        },
        set cookie(value: string) {
          const [pair] = value.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq);
          const val = pair.slice(eq + 1);
          if (value.includes("max-age=0")) {
            cookie = cookie
              .split("; ")
              .filter((part) => part && !part.startsWith(`${name}=`))
              .join("; ");
            return;
          }
          const others = cookie.split("; ").filter((part) => part && !part.startsWith(`${name}=`));
          others.push(`${name}=${val}`);
          cookie = others.join("; ");
        },
      },
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

  it("sanitizes GA4 defaults and every manual event, including referrers", () => {
    window.location.href =
      "https://theflipfixer.com/contact?email=private@example.invalid#phone=2105550100";
    Object.assign(document, { referrer: "https://example.invalid/?name=Private#message=secret" });
    gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false });
    trackFormStart();
    trackPhoneClick();
    trackSmsClick();
    trackContactFormSubmit({ email: "private@example.invalid" });
    const ga4 = calls.filter(
      (call) =>
        call[1] === GA4_MEASUREMENT_ID ||
        (call[2] as { send_to?: string })?.send_to === GA4_MEASUREMENT_ID,
    );
    assert.equal(ga4.length, 5);
    for (const call of ga4) {
      const params = call[2] as Record<string, unknown>;
      assert.equal(params.page_location, "https://theflipfixer.com/contact");
      assert.equal(params.page_referrer, "https://example.invalid/");
      assert.equal("user_data" in params, false);
      assert.equal(JSON.stringify(params).includes("private@"), false);
    }
  });

  it("fires the primary form conversion with enhanced user_data exactly once per call site", () => {
    trackContactFormSubmit({
      name: "Jon Smith",
      email: "jon@theflipfixer.com",
      phone: "(210) 436-9117",
    });
    trackPhoneClick();
    trackSmsClick();
    trackFormStart();
    trackFormStart();

    const conversions = calls.filter((call) => call[1] === "conversion");
    assert.equal(conversions.length, 1);
    assert.equal((conversions[0][2] as { send_to: string }).send_to, GOOGLE_ADS_LEAD_SEND_TO);
    assert.equal(
      typeof (conversions[0][2] as { event_callback?: unknown }).event_callback,
      "function",
    );

    const userData = (conversions[0][2] as { user_data?: unknown }).user_data;
    assert.ok(userData);
    assert.equal(
      calls.some((call) => call[0] === "set" && call[1] === "user_data"),
      false,
    );
    assert.deepEqual(userData, {
      email: "jon@theflipfixer.com",
      phone_number: "+12104369117",
      address: { first_name: "jon", last_name: "smith" },
    });

    const names = calls.map((call) => call[1]);
    assert.equal(names.filter((name) => name === "generate_lead").length, 1);
    assert.equal(names.filter((name) => name === "click").length, 2);
    assert.equal(names.filter((name) => name === "form_start").length, 1);
    for (const call of calls) {
      if (call[0] !== "event" || call[1] === "conversion") continue;
      assert.equal((call[2] as { send_to?: string }).send_to, GA4_MEASUREMENT_ID);
      assert.equal("user_data" in (call[2] as object), false);
    }
  });

  it("allows a second accepted submission in the same session to count", () => {
    trackContactFormSubmit({ name: "A", phone: "2104369117" });
    trackContactFormSubmit({ name: "B", phone: "2104369118" });
    const conversions = calls.filter((call) => call[1] === "conversion");
    assert.equal(conversions.length, 2);
  });

  it("counts a full-page form redirect only when this submit marked it pending", () => {
    assert.equal(consumePendingLeadSubmit(), false);
    markLeadSubmitPending();
    window.location.href = "https://theflipfixer.com/contact?sent=1";
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

  it("keeps a pending mark when the current page is not the thank-you", () => {
    markLeadSubmitPending("/contact");
    window.location.href = "https://theflipfixer.com/services";
    assert.equal(consumePendingLeadSubmit(), false);
    window.location.href = "https://theflipfixer.com/contact?sent=1";
    assert.equal(consumePendingLeadSubmit(), true);
  });

  it("discards an interrupted submit on a normal page visit without ?sent=1 permanently wiping a later match only when stale", () => {
    markLeadSubmitPending();
    window.location.href = "https://theflipfixer.com/contact";
    assert.equal(consumePendingLeadSubmit(), false);
    window.location.href = "https://theflipfixer.com/contact?sent=1";
    assert.equal(consumePendingLeadSubmit(), true);
  });

  it("rejects an unrelated or stale thank-you page", () => {
    markLeadSubmitPending("/roof");
    window.location.href = "https://theflipfixer.com/contact?sent=1";
    assert.equal(consumePendingLeadSubmit(), false);
    sessionStorage.setItem(
      "ff-ads-lead-pending",
      JSON.stringify({ nextPath: "/contact", createdAt: Date.now() - 11 * 60 * 1000 }),
    );
    assert.equal(consumePendingLeadSubmit(), false);
  });

  it("falls back to a short-lived cookie when sessionStorage is unavailable", () => {
    const broken = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    Object.assign(globalThis, { sessionStorage: broken });
    markLeadSubmitPending("/contact");
    window.location.href = "https://theflipfixer.com/contact?sent=1";
    assert.equal(consumePendingLeadSubmit(), true);
    assert.equal(consumePendingLeadSubmit(), false);
  });

  it("shapes enhanced conversions user_data without inventing fields", () => {
    const userData = setEnhancedUserData({ name: "Ada", phone: "210" });
    assert.deepEqual(userData, {
      address: { first_name: "ada" },
    });
  });

  it("does not load the Tag Manager container that counted page views as leads", () => {
    const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
    assert.equal(root.includes("GTM-"), false);
    assert.equal(root.includes("googletagmanager.com/gtm.js"), false);
    assert.equal(root.includes("googletagmanager.com/ns.html"), false);
  });

  it("configures the Ads tag for enhanced conversions and loads gtag with the Ads ID", () => {
    const tag = readFileSync(new URL("../components/google-tag.tsx", import.meta.url), "utf8");
    assert.match(tag, /allow_enhanced_conversions:\s*true/);
    assert.match(tag, /gtag\/js\?id=\$\{GOOGLE_ADS_ID\}/);
    assert.equal(tag.includes("GTM-"), false);
  });

  it("keeps the primary form and website-call labels", () => {
    assert.equal(GOOGLE_ADS_LEAD_SEND_TO, "AW-18251288464/XOc8CJqR8-8cEJCf8v5D");
    assert.equal(GOOGLE_ADS_WEBSITE_CALL_SEND_TO, "AW-18251288464/9UoFCLGyuY4dEJCf8v5D");
  });
});

describe("production hostname isolation", () => {
  it("allows only the two exact production hosts", () => {
    for (const host of ["theflipfixer.com", "www.theflipfixer.com"])
      assert.equal(isGoogleTrackingHost(host), true);
    for (const host of [
      "localhost",
      "flpfxr-test.vercel.app",
      "theflipfixer.com.evil.test",
      "preview.theflipfixer.com",
      "theflipfixer.com.",
      "www.theflipfixer.com.",
      "THEFLIPFIXER.COM",
      "WWW.THEFLIPFIXER.COM",
      "theflipfixer-com.vercel.app",
      "www.theflipfixer.com.evil.test",
      "",
    ])
      assert.equal(isGoogleTrackingHost(host), false);
  });
  it("does not queue events or user data on previews even with gtag present", () => {
    const previous = globalThis.window;
    const calls: unknown[] = [];
    Object.assign(globalThis, {
      window: {
        location: { hostname: "test.vercel.app" },
        gtag: (...args: unknown[]) => calls.push(args),
      },
    });
    try {
      trackContactFormSubmit({ email: "test@example.invalid", phone: "2105550100" });
      trackPageView("/contact");
      trackPhoneClick();
      trackSmsClick();
      assert.deepEqual(calls, []);
    } finally {
      Object.assign(globalThis, { window: previous });
    }
  });
});
