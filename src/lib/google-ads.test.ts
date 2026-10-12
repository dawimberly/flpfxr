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
          const others = cookie
            .split("; ")
            .filter((part) => part && !part.startsWith(`${name}=`));
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
    assert.equal(
      (conversions[0][2] as { send_to: string }).send_to,
      GOOGLE_ADS_LEAD_SEND_TO,
    );
    assert.equal(typeof (conversions[0][2] as { event_callback?: unknown }).event_callback, "function");

    const userData = calls.find((call) => call[0] === "set" && call[1] === "user_data");
    assert.ok(userData);
    assert.deepEqual(userData![2], {
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
    setEnhancedUserData({ name: "Ada", phone: "210" });
    // too-short phone is dropped; name still sets address
    const userData = calls.find((call) => call[0] === "set" && call[1] === "user_data");
    assert.deepEqual(userData?.[2], {
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
