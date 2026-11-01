import { beforeEach, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GA4_MEASUREMENT_ID, trackEstimateStart, trackEstimateRangeShown,
  trackEstimateOutOfRange, trackEstimateHandoffClick,
} from "./google-ads.ts";
import { DEFAULT_PROJECT_INPUTS, type ProjectInputs } from "./public-estimate-options.ts";
import { captureAdClickIds } from "./formsubmit.ts";

describe("private secondary planner tracking", () => {
  let calls: unknown[][];
  let storage: Map<string, string>;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  beforeEach(() => {
    calls = [];
    storage = new Map();
    for (const key of ["window", "document", "sessionStorage"]) previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.assign(globalThis, {
      window: {
        location: { hostname: "theflipfixer.com", pathname: "/estimate", search: "?utm_source=facebook&gclid=example", href: "https://theflipfixer.com/estimate?email=private@example.com#private" },
        gtag: (...args: unknown[]) => calls.push(args),
      },
      document: { referrer: "https://example.com/?phone=1234567890" },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });
  afterEach(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  it("sends GA4 only, dedupes starts and ranges per session/combo, and projects safe keys", () => {
    const inputs = {
      ...DEFAULT_PROJECT_INPUTS, name: "Private Person", email: "private@example.com",
      phone: "1234567890", message: "private text", low: 12300, high: 15400, floorSqft: 123.45,
    } as ProjectInputs;
    trackEstimateStart(); trackEstimateStart();
    trackEstimateRangeShown(inputs, false); trackEstimateRangeShown(inputs, false);
    trackEstimateRangeShown({ ...inputs, floorSqft: 222 }, false);
    trackEstimateRangeShown(inputs, true); trackEstimateRangeShown(inputs, true);
    trackEstimateRangeShown({ ...inputs, counter: "laminate" }, true);
    trackEstimateOutOfRange("kitchen"); trackEstimateOutOfRange("kitchen");
    trackEstimateHandoffClick(inputs);
    assert.deepEqual(calls.map(call => call[1]), [
      "estimate_start", "estimate_range_shown", "estimate_range_shown", "estimate_range_shown",
      "estimate_out_of_range", "estimate_handoff_click",
    ]);
    for (const call of calls) {
      assert.equal(call[0], "event");
      assert.equal((call[2] as Record<string, unknown>).send_to, GA4_MEASUREMENT_ID);
    }
    assert.deepEqual(calls[1][2], {
      service: "kitchen", size: "Medium", custom_sqft: false, floor_material: "lvp", counter_material: "quartz",
      send_to: GA4_MEASUREMENT_ID, page_location: "https://theflipfixer.com/estimate", page_referrer: "https://example.com/",
    });
    assert.doesNotMatch(JSON.stringify(calls), /Private|private|1234567890|12300|15400|123\.45|222|AW-|conversion|\$/);
    // Recreating the client module/window still respects the session claim.
    Object.assign(globalThis, { window: { ...window } });
    trackEstimateStart(); trackEstimateRangeShown(inputs, false);
    assert.equal(calls.length, 6);
  });
  it("rejects arbitrary/free-text service, size, and material values", () => {
    trackEstimateRangeShown({ ...DEFAULT_PROJECT_INPUTS, service: "private@example.com" } as unknown as ProjectInputs, false);
    trackEstimateRangeShown({ ...DEFAULT_PROJECT_INPUTS, size: "$15400" } as unknown as ProjectInputs, false);
    trackEstimateHandoffClick({ ...DEFAULT_PROJECT_INPUTS, size: "Private Person" } as unknown as ProjectInputs);
    assert.equal(calls.length, 0);
    trackEstimateRangeShown({ ...DEFAULT_PROJECT_INPUTS, floor: "private text", counter: "$15400" } as unknown as ProjectInputs, false);
    assert.doesNotMatch(JSON.stringify(calls), /private|15400/);
  });
  it("queues nothing on previews and does not consume production session claims", () => {
    window.location.hostname = "preview.vercel.app";
    trackEstimateStart(); trackEstimateRangeShown(DEFAULT_PROJECT_INPUTS, false);
    trackEstimateOutOfRange("kitchen"); trackEstimateHandoffClick(DEFAULT_PROJECT_INPUTS);
    assert.deepEqual(calls, []); assert.equal(storage.size, 0);
    window.location.hostname = "theflipfixer.com";
    trackEstimateStart(); assert.equal(calls.length, 1);
  });
  it("dedupes without storage when storage is denied", () => {
    Object.assign(globalThis, { sessionStorage: { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } } });
    assert.doesNotThrow(() => {
      trackEstimateStart(); trackEstimateStart();
      trackEstimateRangeShown(DEFAULT_PROJECT_INPUTS, false); trackEstimateRangeShown(DEFAULT_PROJECT_INPUTS, false);
    });
    assert.equal(calls.length, 2);
  });
  it("keeps first landing /estimate through /contact while preserving ad ID and UTM behavior", () => {
    const first = captureAdClickIds();
    assert.equal(first.first_landing_path, "/estimate");
    assert.equal(first.gclid, "example"); assert.equal(first.utm_source, "facebook");
    Object.assign(window.location, { pathname: "/contact", search: "?origin=estimate", href: "https://theflipfixer.com/contact?origin=estimate" });
    const next = captureAdClickIds();
    assert.equal(next.first_landing_path, "/estimate");
    assert.equal(next.landing_path, "/contact?origin=estimate");
    assert.equal(next.gclid, first.gclid); assert.equal(next.utm_source, first.utm_source);
    captureAdClickIds(); assert.equal(storage.get("ff-first-landing-path"), "/estimate");
  });
});
