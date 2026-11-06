import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_ESTIMATE_HEADLINE, areasFromLanding, estimateHandoffSearch, estimateLandingFromSearch,
  estimateLandingUrl, estimateRouteSearch, estimateTrustLine, headlineFor, inputsFromLanding,
  publicPlannerPath,
} from "./estimate-landing.ts";
import { formatEstimateRange, projectPlanningEstimate } from "./public-pricing.ts";
import { SERVICE_AREAS } from "./site.ts";

describe("estimate landing links", () => {
  it("preselects a known project and size", () => {
    const bathroom = estimateLandingFromSearch({ service: "bathroom", size: "small" });
    assert.equal(bathroom.service, "bathroom");
    assert.equal(bathroom.size, "Small");
    assert.equal(bathroom.explicitService, true);
    assert.equal(headlineFor(bathroom.service), "Plan your bathroom remodel.");
    const kitchen = estimateLandingFromSearch(new URLSearchParams("service=kitchen&size=large"));
    assert.equal(kitchen.service, "kitchen");
    assert.equal(kitchen.size, "Large");
    assert.equal(headlineFor(kitchen.service), "Plan your kitchen remodel.");
    assert.equal(estimateLandingFromSearch({ service: "other", size: "medium" }).service, "custom");
    assert.equal(headlineFor("custom"), "Plan your other project.");
  });

  it("ignores invalid values and falls back to kitchen and medium", () => {
    const landing = estimateLandingFromSearch({ service: "roof", size: "tiny", gclid: "keep" });
    assert.equal(landing.service, "kitchen");
    assert.equal(landing.size, "Medium");
    assert.equal(landing.explicitService, false);
    assert.equal(landing.explicitSize, false);
    assert.equal(DEFAULT_ESTIMATE_HEADLINE, "Plan your next project.");
    const search = estimateRouteSearch({ service: "roof", size: "tiny", gclid: "keep", utm_source: "google" });
    assert.equal(search.service, undefined);
    assert.equal(search.size, undefined);
    assert.equal(search.gclid, "keep");
    assert.equal(search.utm_source, "google");
  });

  it("keeps ad click params in the planner url and on the way to contact", () => {
    const href = "https://theflipfixer.com/estimate?gclid=G123&gbraid=B123&wbraid=W123&utm_source=google&utm_medium=cpc&utm_campaign=bath&utm_term=remodel&utm_content=ad&fbclid=leave";
    const next = estimateLandingUrl(href, "bathroom", "Medium");
    const url = new URL(next, "https://theflipfixer.com");
    assert.equal(url.pathname, "/estimate");
    assert.equal(url.searchParams.get("service"), "bathroom");
    assert.equal(url.searchParams.get("size"), "medium");
    for (const [key, value] of [["gclid", "G123"], ["gbraid", "B123"], ["wbraid", "W123"], ["utm_source", "google"], ["utm_medium", "cpc"], ["utm_campaign", "bath"], ["utm_term", "remodel"], ["utm_content", "ad"], ["fbclid", "leave"]]) {
      assert.equal(url.searchParams.get(key), value, key);
    }
    const handoff = estimateHandoffSearch(url.searchParams, { service: "bathroom", side: "interior" });
    assert.equal(handoff.origin, "estimate");
    assert.equal(handoff.service, "bathroom");
    assert.equal(handoff.side, "interior");
    assert.equal(handoff.gclid, "G123");
    assert.equal(handoff.gbraid, "B123");
    assert.equal(handoff.wbraid, "W123");
    assert.equal(handoff.utm_source, "google");
    assert.equal(handoff.utm_medium, "cpc");
    assert.equal(handoff.utm_campaign, "bath");
    assert.equal(handoff.utm_term, "remodel");
    assert.equal(handoff.utm_content, "ad");
    assert.equal("fbclid" in handoff, false);
  });

  it("keeps the bathroom and kitchen ranges for the current box prices", () => {
    const kitchen = projectPlanningEstimate(inputsFromLanding(estimateLandingFromSearch({ service: "kitchen", size: "medium" })));
    const bathroom = projectPlanningEstimate(inputsFromLanding(estimateLandingFromSearch({ service: "bathroom", size: "medium" })));
    assert.equal(formatEstimateRange(kitchen!), "between $13,300 and $16,700");
    assert.equal(formatEstimateRange(bathroom!), "between $9,300 and $11,700");
  });

  it("builds the trust line only from places the site already lists", () => {
    const line = estimateTrustLine(SERVICE_AREAS);
    assert.equal(line, "Serving San Antonio, Boerne, Alamo Heights and nearby.");
    for (const name of ["San Antonio", "Boerne", "Alamo Heights"]) assert.equal(SERVICE_AREAS.includes(name as typeof SERVICE_AREAS[number]), true);
    assert.doesNotMatch(line, /insured|guaranteed|below market|save \d|from \$|starting at|waterfall/i);
    const page = readFileSync("src/routes/estimate.tsx", "utf8");
    const ui = readFileSync("src/components/public-project-estimator.tsx", "utf8");
    assert.doesNotMatch(page, /Preliminary estimate only/);
    assert.equal([...ui.matchAll(/\{PRELIMINARY_ESTIMATE_WORDING\}/g)].length, 1);
    assert.match(ui, /history\.replaceState/);
    assert.match(ui, /areasFromLanding/);
    assert.doesNotMatch(ui, /\/estimator|\/login/);
  });

  it("opens a flooring planner link on the same preliminary total", () => {
    const landing = estimateLandingFromSearch({ service: "flooring", floor: "LVP", roomSqft: "400" });
    assert.equal(landing.service, "flooring");
    assert.equal(landing.size, "Medium");
    assert.equal(landing.explicitSize, false);
    assert.equal(landing.floor, "lvp");
    assert.equal(landing.roomSqft, 400);
    assert.equal(areasFromLanding(landing).room, "400");
    const linked = projectPlanningEstimate(inputsFromLanding(landing))!;
    const preset = projectPlanningEstimate(inputsFromLanding(estimateLandingFromSearch({ service: "flooring", size: "medium" })))!;
    assert.equal(Math.round(linked.total / 100) * 100, Math.round(preset.total / 100) * 100);
    assert.equal(publicPlannerPath(inputsFromLanding(landing)), "/estimate?service=flooring&size=medium&floor=lvp&roomSqft=400");
    const search = estimateRouteSearch({ service: "flooring", floor: "LVP", roomSqft: "400", gclid: "keep" });
    assert.equal(search.service, "flooring");
    assert.equal(search.floor, "lvp");
    assert.equal(search.roomSqft, 400);
    assert.equal(search.gclid, "keep");
    const dropped = estimateRouteSearch({ service: "flooring", roomSqft: "10", floor: "marble" });
    assert.equal(dropped.roomSqft, undefined);
    assert.equal(dropped.floor, undefined);
    const next = estimateLandingUrl("https://theflipfixer.com/estimate?service=flooring&floor=lvp&roomSqft=400&gclid=keep", "flooring", "Large");
    const url = new URL(next, "https://theflipfixer.com");
    assert.equal(url.searchParams.get("size"), "large");
    assert.equal(url.searchParams.get("roomSqft"), null);
    assert.equal(url.searchParams.get("floor"), "lvp");
    assert.equal(url.searchParams.get("gclid"), "keep");
  });
});
