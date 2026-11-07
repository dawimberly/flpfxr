/**
 * Permanent planner → estimate redirects in vercel.json.
 * Vercel merges request query params into destinations that already have a query.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { estimateLandingFromSearch } from "../src/lib/estimate-landing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

function mergeQuery(destinationPathWithQuery, incomingSearch) {
  const dest = new URL(destinationPathWithQuery, "https://theflipfixer.com");
  const incoming = new URLSearchParams(incomingSearch.startsWith("?") ? incomingSearch.slice(1) : incomingSearch);
  for (const [key, value] of incoming.entries()) {
    if (!dest.searchParams.has(key)) dest.searchParams.append(key, value);
  }
  return `${dest.pathname}${dest.search}`;
}

describe("vercel planner 301 redirects", () => {
  it("keeps www/http canonical rules ahead of planner path redirects", () => {
    const redirects = vercel.redirects;
    assert.ok(Array.isArray(redirects) && redirects.length >= 6);
    const wwwCatchAll = redirects.findIndex(
      (row) => row.source === "/:path*" && row.has?.some((h) => h.value === "www.theflipfixer.com"),
    );
    const kitchen = redirects.findIndex((row) => row.source === "/kitchen/planner");
    const bathroom = redirects.findIndex((row) => row.source === "/bathroom/planner");
    assert.ok(wwwCatchAll >= 0, "www catch-all must remain");
    assert.ok(kitchen > wwwCatchAll, "planner redirects must follow www canonicalization");
    assert.ok(bathroom > wwwCatchAll);
  });

  it("301s /kitchen/planner and /bathroom/planner to the matching estimate service", () => {
    const bySource = Object.fromEntries(vercel.redirects.map((row) => [row.source, row]));
    for (const [source, service] of [
      ["/kitchen/planner", "kitchen"],
      ["/bathroom/planner", "bathroom"],
    ]) {
      const rule = bySource[source];
      assert.ok(rule, source);
      assert.equal(rule.statusCode, 301);
      assert.equal(rule.destination, `/estimate?service=${service}`);
      assert.notEqual(rule.destination, source);
      const landing = estimateLandingFromSearch({ service });
      assert.equal(landing.service, service);
      assert.equal(landing.explicitService, true);
    }
  });

  it("preserves gclid and UTM params when merging onto the estimate destination", () => {
    const tracking = "gclid=EaIwX&utm_source=google&utm_campaign=kitchen_planner&utm_medium=cpc";
    const kitchen = mergeQuery("/estimate?service=kitchen", tracking);
    const bathroom = mergeQuery("/estimate?service=bathroom", `?${tracking}`);
    assert.equal(
      kitchen,
      "/estimate?service=kitchen&gclid=EaIwX&utm_source=google&utm_campaign=kitchen_planner&utm_medium=cpc",
    );
    assert.equal(
      bathroom,
      "/estimate?service=bathroom&gclid=EaIwX&utm_source=google&utm_campaign=kitchen_planner&utm_medium=cpc",
    );
    assert.equal(estimateLandingFromSearch(Object.fromEntries(new URLSearchParams(kitchen.split("?")[1]))).service, "kitchen");
    assert.equal(estimateLandingFromSearch(Object.fromEntries(new URLSearchParams(bathroom.split("?")[1]))).service, "bathroom");
  });

  it("models www → apex → estimate without a redirect loop", () => {
    const wwwRule = vercel.redirects.find(
      (row) => row.source === "/:path*" && row.has?.some((h) => h.value === "www.theflipfixer.com"),
    );
    assert.equal(wwwRule.destination, "https://theflipfixer.com/:path*");
    assert.equal(wwwRule.statusCode, 301);

    // Hop 1: www keeps the planner path (and query) on apex.
    const afterWww = "https://theflipfixer.com/kitchen/planner?gclid=www1&utm_source=ads";
    assert.match(afterWww, /\/kitchen\/planner\?/);

    // Hop 2: apex planner rule selects kitchen and keeps tracking.
    const afterPlanner = mergeQuery("/estimate?service=kitchen", "gclid=www1&utm_source=ads");
    assert.equal(afterPlanner, "/estimate?service=kitchen&gclid=www1&utm_source=ads");
    assert.doesNotMatch(afterPlanner, /\/kitchen\/planner/);
    assert.equal(estimateLandingFromSearch(Object.fromEntries(new URLSearchParams(afterPlanner.split("?")[1]))).service, "kitchen");
  });
});
