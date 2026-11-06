import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import {
  handlePublicEstimateOptions, handlePublicEstimatePost,
} from "./public-estimate-api.server.ts";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";
import { projectPlanningEstimate } from "./public-pricing.ts";

const VISITOR_KEYS = [
  "ok", "preliminary", "total", "low", "high", "leadMessage", "disclaimer",
  "exclusions", "removalNote", "nextStep", "plannerUrl",
];

function post(body: unknown) {
  return handlePublicEstimatePost(new Request("https://theflipfixer.com/api/public-estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

describe("public estimate API", () => {
  it("returns the same rounded 400 sq ft LVP total as the public planner", async () => {
    const response = await post({ service: "flooring", floor: "lvp", roomSqft: 400 });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    const built = projectPlanningEstimate({
      ...DEFAULT_PROJECT_INPUTS,
      service: "flooring",
      size: "Medium",
      floor: "lvp",
      roomSqft: 400,
      vanity: undefined,
    })!;
    const rounded = Math.round(built.total / 100) * 100;
    assert.equal(rounded, built.low);
    assert.equal(body.total, rounded);
    assert.equal(body.total, 3600);
    assert.equal(body.low, 3600);
    assert.equal(body.high, 4500);
    assert.equal(body.ok, true);
    assert.equal(body.preliminary, true);
    assert.deepEqual(Object.keys(body).sort(), [...VISITOR_KEYS].sort());
    assert.equal(body.disclaimer, PRELIMINARY_ESTIMATE_WORDING);
    assert.match(body.leadMessage, /Preliminary estimate: \$3,600\./);
    assert.match(body.leadMessage, /Preliminary estimate only — not a quote/);
    assert.match(body.exclusions, /Floor demolition/);
    assert.match(body.removalNote, /snap-together/);
    assert.match(body.removalNote, /extra/);
    assert.match(body.removalNote, /on site/);
    assert.match(body.nextStep, /^We can schedule a free walkthrough with Jon/);
    assert.equal(body.plannerUrl, "https://theflipfixer.com/estimate?service=flooring&size=medium&floor=lvp&roomSqft=400");
    const raw = JSON.stringify(body);
    assert.doesNotMatch(raw, /personHours|materialsAtCost|CREW_DAY_RATE|unitCost|lines|adjustedDays|"support"|"labor"/);
    assert.doesNotMatch(raw, /\binsured\b|licensed and insured/i);
    assert.equal(body.leadMessage, "Project: Flooring. Size: Medium. Materials: Luxury vinyl plank. Preliminary estimate: $3,600. Preliminary estimate only — not a quote. Final price is confirmed after an on-site review.");
  });

  it("accepts PepoChat text inputs and derives Medium for 400 sq ft", async () => {
    const text = await (await post({
      service: "flooring",
      size: "",
      floor: "luxury vinyl plank",
      roomSqft: "400 sq ft",
    })).json();
    const sized = await (await post({
      service: "flooring",
      size: "medium",
      floor: "LVP",
      room_sqft: "400",
      counter: "quartz",
      shower: "ceramic",
      prime: "true",
      newToilet: "yes",
      exteriorCoats: "1",
      delivery: "0",
      specialist: "0",
    })).json();
    assert.equal(text.total, 3600);
    assert.equal(sized.total, text.total);
    assert.equal(sized.plannerUrl, text.plannerUrl);
    const small = await (await post({ service: "flooring", size: "Small", floor: "lvp", roomSqft: 400 })).json();
    assert.notEqual(small.total, 3600);
    assert.equal(typeof small.total, "number");
  });

  it("rejects invalid input with 400 and keeps a custom project free of a price", async () => {
    for (const body of [
      "not-json",
      {},
      { service: "roof" },
      { service: "flooring", roomSqft: 10 },
      { service: "flooring", floor: "lvp", roomSqft: "lots" },
      { service: "flooring", roomSqft: 9000 },
    ]) {
      const response = await post(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      const payload = await response.json();
      assert.equal(payload.error, "invalid_estimate_input");
      assert.equal(response.headers.get("access-control-allow-origin"), "*");
      assert.doesNotMatch(JSON.stringify(payload), /\$\d/);
    }
    const custom = await (await post({ service: "other", room_sqft: "n/a" })).json();
    assert.equal(custom.total, null);
    assert.equal(custom.removalNote, null);
    assert.doesNotMatch(JSON.stringify(custom), /\$\d/);
    assert.match(custom.nextStep, /walkthrough with Jon/);
    const kitchen = await (await post({ service: "kitchen", room_sqft: "n/a", floor: "n/a" })).json();
    assert.equal(kitchen.total, 12800);
    assert.equal(kitchen.removalNote, null);
    assert.match(kitchen.exclusions, /Appliances/);
  });

  it("answers a browser preflight and does not import pricing into the route module", async () => {
    const options = handlePublicEstimateOptions();
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("access-control-allow-origin"), "*");
    assert.match(options.headers.get("access-control-allow-methods") || "", /POST/);
    const route = readFileSync("src/routes/api/public-estimate.ts", "utf8");
    assert.match(route, /handlePublicEstimatePost/);
    assert.doesNotMatch(route, /public-pricing|public-estimate-costs|CREW_DAY_RATE/);
    const doc = readFileSync("docs/pepochat.md", "utf8");
    assert.match(doc, /Help me build an estimate/);
    assert.match(doc, /How much is 400 sq ft of LVP\?/);
    assert.match(doc, /How much is a kitchen or bath\?/);
    assert.match(doc, /\/api\/public-estimate/);
    assert.match(doc, /never invent|Never invent/);
    assert.match(doc, /snap-together/);
    assert.match(doc, /on site/);
    assert.match(doc, /\b[Ww]e\b/);
    assert.doesNotMatch(doc, /insured/i);
    assert.doesNotMatch(doc, /licensed and insured/i);
  });
});
