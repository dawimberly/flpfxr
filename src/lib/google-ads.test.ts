import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_ADS_LEAD_SEND_TO,
  GOOGLE_ADS_PHONE_SEND_TO,
  pagePathFromLocation,
  trackContactFormSubmit,
  trackPhoneClick,
  trackSmsClick,
  trackToolUse,
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

type DataLayerEntry = IArguments | unknown[];

function eventEntries(): Array<{ name: string; params: Record<string, unknown> }> {
  const layer = (globalThis as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
  const out: Array<{ name: string; params: Record<string, unknown> }> = [];
  for (const entry of layer) {
    const args = Array.from(entry as IArguments);
    if (args[0] === "event") {
      out.push({
        name: String(args[1]),
        params: (args[2] as Record<string, unknown>) ?? {},
      });
    }
  }
  return out;
}

describe("GA4 lead tracking", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).window = globalThis;
    (globalThis as Record<string, unknown>).location = { pathname: "/services" };
    (globalThis as Record<string, unknown>).sessionStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    (globalThis as Record<string, unknown>).dataLayer = [];
    delete (globalThis as Record<string, unknown>).gtag;
  });

  it("trackPhoneClick(header) sends phone_click then conversion", () => {
    trackPhoneClick("header");
    const events = eventEntries();
    assert.equal(events.length, 2);
    assert.equal(events[0].name, "phone_click");
    assert.deepEqual(events[0].params, {
      link_url: "tel:+12104369117",
      link_location: "header",
      page_path: "/services",
    });
    assert.equal(events[1].name, "conversion");
    assert.equal(events[1].params.send_to, GOOGLE_ADS_PHONE_SEND_TO);
  });

  it("defaults link_location to other and never names an event click", () => {
    trackPhoneClick();
    const events = eventEntries();
    assert.equal(events[0].params.link_location, "other");
    assert.ok(events.every((e) => e.name !== "click"));
  });

  it("trackSmsClick sends only sms_click with no conversion", () => {
    trackSmsClick("mobile_bar");
    const events = eventEntries();
    assert.equal(events.length, 1);
    assert.equal(events[0].name, "sms_click");
    assert.deepEqual(events[0].params, {
      link_url: "sms:+12104369117",
      link_location: "mobile_bar",
      page_path: "/services",
    });
  });

  it("trackContactFormSubmit with opts sends generate_lead and conversion", () => {
    trackContactFormSubmit({ leadSource: "roof_quote", service: "roofing" });
    const events = eventEntries();
    assert.equal(events[0].name, "generate_lead");
    const keys = Object.keys(events[0].params).sort();
    assert.deepEqual(keys, ["currency", "lead_source", "page_path", "service", "value"]);
    assert.equal(events[0].params.lead_source, "roof_quote");
    assert.equal(events[0].params.service, "roofing");
    assert.equal(events[0].params.page_path, "/services");
    assert.equal(events[1].name, "conversion");
    assert.equal(events[1].params.send_to, GOOGLE_ADS_LEAD_SEND_TO);
  });

  it("trackContactFormSubmit defaults lead_source and service", () => {
    trackContactFormSubmit();
    const events = eventEntries();
    assert.equal(events[0].params.lead_source, "contact_form");
    assert.equal(events[0].params.service, "unspecified");
  });

  it("never includes PII keys or @ in event payloads", () => {
    trackPhoneClick("header");
    trackSmsClick("footer");
    trackContactFormSubmit({ leadSource: "contact_form", service: "kitchen" });
    trackToolUse("roof_quote", "start");
    const events = eventEntries();
    const forbidden = new Set(["name", "email", "phone_digits", "address", "message"]);
    for (const e of events) {
      for (const key of Object.keys(e.params)) {
        assert.ok(!forbidden.has(key), `should not include key ${key}`);
      }
    }
    const json = JSON.stringify(events);
    assert.ok(!json.includes("@"));
  });

  it("fires generate_lead only once per session", () => {
    trackContactFormSubmit();
    trackContactFormSubmit();
    const leads = eventEntries().filter((e) => e.name === "generate_lead");
    assert.equal(leads.length, 1);
  });

  it("trackToolUse is once per tool/step", () => {
    trackToolUse("roof_quote", "start");
    trackToolUse("roof_quote", "start");
    trackToolUse("roof_quote", "complete");
    trackToolUse("quote_estimator", "start");
    const events = eventEntries();
    assert.deepEqual(
      events.map((e) => ({ name: e.name, tool: e.params.tool_name })),
      [
        { name: "tool_start", tool: "roof_quote" },
        { name: "tool_complete", tool: "roof_quote" },
        { name: "tool_start", tool: "quote_estimator" },
      ],
    );
  });
});
