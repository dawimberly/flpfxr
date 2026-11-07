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
  "exclusions", "removalNote", "detachNote", "nextStep", "plannerUrl",
  "tier", "tierLabel", "act", "actLabel", "pricedAct", "existing",
  "removalPriced", "detachPriced",
];

function post(body: unknown) {
  return handlePublicEstimatePost(new Request("https://theflipfixer.com/api/public-estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

describe("public estimate API", () => {
  it("returns one cabinet selection price and preserves the finish in its planner link", async () => {
    const response = await post({ service: "kitchen", cabinetFinish: "VE" });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 11600);
    assert.equal(body.low, body.total);
    assert.equal(body.high, body.total);
    assert.equal(new URL(body.plannerUrl).searchParams.get("cabinetFinish"), "ve");
    assert.equal((await post({ service: "kitchen", cabinetFinish: "honey" })).status, 400);
  });
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
    assert.equal(body.tier, null);
    assert.equal(body.tierLabel, null);
    assert.equal(body.pricedAct, "install-only");
    assert.equal(body.removalPriced, false);
    assert.equal(body.detachPriced, false);
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
    assert.equal(kitchen.total, 12000);
    assert.equal(kitchen.removalNote, null);
    assert.equal(kitchen.removalPriced, null);
    assert.match(kitchen.exclusions, /Appliances/);
  });

  it("prices flooring tiers as install only and does not add removal dollars", async () => {
    const materials = [
      ["carpet", "Good carpet", 3100],
      ["lvp", "Best luxury vinyl plank", 3600],
      ["tile", "Best tile", 9300],
      ["wood", "Best engineered hardwood", 4700],
    ] as const;
    for (const [floor, label, total] of materials) {
      const grade = floor === "carpet" ? "good" : "best";
      const body = await (await post({ service: "flooring", floor, tier: grade, roomSqft: 400 })).json();
      const built = projectPlanningEstimate({
        ...DEFAULT_PROJECT_INPUTS,
        service: "flooring",
        size: "Medium",
        floor,
        roomSqft: 400,
        vanity: undefined,
      })!;
      assert.equal(body.total, Math.round(built.total / 100) * 100, floor);
      assert.equal(body.total, total, floor);
      assert.equal(body.tier, grade);
      assert.equal(body.tierLabel, label);
      assert.equal(body.pricedAct, "install-only");
      assert.equal(body.plannerUrl.includes(`floor=${floor}`), true, floor);
    }
    for (const tier of ["good", "better", "best"] as const) {
      const body = await (await post({ service: "flooring", floor: "tile", tier, roomSqft: 400 })).json();
      assert.equal(body.total, 9300, tier);
      assert.equal(body.tier, tier);
      assert.match(body.tierLabel, /tile$/);
      assert.equal(body.plannerUrl.includes("floor=tile"), true);
    }
    const gradeDoesNotSwap = await (await post({ service: "flooring", tier: "best", roomSqft: 400 })).json();
    assert.equal(gradeDoesNotSwap.total, 3600);
    assert.equal(gradeDoesNotSwap.tierLabel, "Best luxury vinyl plank");
    const named = await (await post({
      service: "flooring",
      tier: "best",
      floor: "tile",
      roomSqft: "400",
      existing: "old snap-together flooring",
      act: "remove & replace",
    })).json();
    const installOnly = await (await post({
      service: "flooring",
      floor: "tile",
      roomSqft: 400,
      existing: "prepared surface",
      act: "install-only",
    })).json();
    assert.equal(named.total, 9300);
    assert.equal(installOnly.total, named.total);
    assert.equal(named.tier, "best");
    assert.equal(named.tierLabel, "Best tile");
    assert.equal(named.act, "rr");
    assert.equal(named.actLabel, "Remove & replace");
    assert.equal(named.existing, "snap-together");
    assert.equal(named.pricedAct, "install-only");
    assert.equal(named.removalPriced, false);
    assert.match(named.removalNote, /install only/);
    assert.match(named.removalNote, /snap-together/);
    assert.match(named.removalNote, /extra/);
    assert.match(named.leadMessage, /Materials: Tile/);
    assert.match(named.leadMessage, /\$9,300/);
    assert.equal(installOnly.act, "install-only");
    assert.equal(installOnly.actLabel, "Install only");
    assert.match(installOnly.removalNote, /prepared surface/);
    const detach = await (await post({
      service: "flooring",
      floor: "tile",
      roomSqft: 400,
      existing: "baseboards come off and go back",
    })).json();
    assert.equal(detach.total, 9300);
    assert.equal(detach.act, "detach");
    assert.equal(detach.actLabel, "Detach & reattach");
    assert.equal(detach.detachPriced, false);
    assert.match(detach.detachNote, /extra/);
    assert.match(detach.detachNote, /on site/);
    const wood = await (await post({ service: "flooring", floor: "engineered hardwood", tier: "good", roomSqft: 400 })).json();
    assert.equal(wood.total, 4700);
    assert.equal(wood.tier, "good");
    assert.equal(wood.tierLabel, "Good engineered hardwood");
    const mismatched = await (await post({ service: "flooring", floor: "tile", tier: "good", roomSqft: 400 })).json();
    assert.equal(mismatched.total, 9300);
    assert.equal(mismatched.tierLabel, "Good tile");
    const raw = JSON.stringify(named);
    assert.doesNotMatch(raw, /7\.85|1\.28|3\.85|remove_cost|cost_per_unit|insured/i);
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
    assert.match(doc, /How much is tile floor\?/);
    assert.match(doc, /Good, Better, and Best grades of that material/);
    assert.doesNotMatch(doc, /Good is carpet/);
    assert.match(doc, /\/api\/public-estimate/);
    assert.match(doc, /never invent|Never invent/);
    assert.match(doc, /snap-together/);
    assert.match(doc, /on site/);
    assert.match(doc, /\b[Ww]e\b/);
    assert.doesNotMatch(doc, /insured/i);
    assert.doesNotMatch(doc, /licensed and insured/i);
  });
});
