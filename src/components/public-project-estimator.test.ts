import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adjustedCrewDays, planningEstimate, publicEstimateLeadMessage } from "../lib/public-pricing.ts";
import { PROJECTS, PROJECT_SIZES, projectSelection } from "../lib/public-project-options.ts";

describe("internal pricing remains unchanged", () => {
  it("adds one crew day per four base days and does not mark up materials", () => {
    assert.equal(adjustedCrewDays(3), 3);
    assert.equal(adjustedCrewDays(4), 5);
    assert.equal(adjustedCrewDays(8), 10);
    assert.equal(planningEstimate({ baseCrewDays: 4, materialsAtCost: 2000 }), 5250);
    assert.throws(() => planningEstimate({ baseCrewDays: -1, materialsAtCost: 0 }));
  });
  it("does not disclose the day rate in the legacy message", () => {
    const message = publicEstimateLeadMessage({ service: "Bathroom remodeling", size: "Medium", baseCrewDays: 4, materialsAtCost: 2000, otherProjectCosts: 0 });
    assert.doesNotMatch(message, /650|per (?:crew )?day|\/day/);
    assert.match(message, /\$5,250/);
  });
});

describe("social estimator project choices", () => {
  const expected = {
    kitchen: [[4000, 9000], [12000, 25000], [25000, 45000]],
    bathroom: [[3000, 7000], [8000, 16000], [15000, 28000]],
  };
  for (const service of ["kitchen", "bathroom"] as const) {
    for (const [index, size] of PROJECT_SIZES.entries()) {
      it(service + " " + size + " preserves the recovered range and contact context", () => {
        const selection = projectSelection(service, size);
        assert.deepEqual(selection.range, expected[service][index]);
        assert.ok(selection.range[0] > 0 && selection.range[1] > selection.range[0]);
        assert.match(selection.message, new RegExp(service + " remodeling"));
        assert.ok(selection.message.includes("(" + size + " scope)"));
        assert.ok(selection.message.includes(selection.rangeText));
        assert.ok(selection.message.includes(selection.includes));
        assert.match(selection.message, /not a quote/);
        assert.doesNotMatch(selection.message, /650|crew|\/day|retail|savings/i);
      });
    }
  }
  it("rejects invalid selections", () => {
    assert.throws(() => projectSelection("roofing" as never, "medium"));
    assert.throws(() => projectSelection("kitchen", "huge" as never));
    assert.throws(() => projectSelection("__proto__" as never, "medium"));
  });
  it("keeps non-advertised services out of the kitchen and bath funnel", () => {
    assert.deepEqual(Object.keys(PROJECTS), ["kitchen", "bathroom"]);
  });
});

describe("public funnel safeguards", () => {
  const ui = readFileSync("src/components/public-project-estimator.tsx", "utf8");
  const route = readFileSync("src/routes/estimate.tsx", "utf8");
  it("requires no construction calculations or contact details to explore prices", () => {
    assert.doesNotMatch(ui, /<input|Base crew days|Materials at cost|Other costs|CREW_DAY_RATE|650|catalog\.json|estimator-store/);
    assert.match(ui, /aria-pressed/);
    assert.match(ui, /aria-live="polite"/);
    assert.match(ui, /min-h-12/);
  });
  it("keeps the existing contact handoff and replaces stale room selections", () => {
    assert.match(ui, /saveLeadDraft\(/);
    assert.match(ui, /submissionId: undefined/);
    assert.match(ui, /kitchenScope: service === "kitchen" \? size : "none"/);
    assert.match(ui, /bathroomScope: service === "bathroom" \? size : "none"/);
    assert.match(ui, /onClick=\{handOff\}/);
    assert.match(ui, /to="\/contact"/);
    assert.doesNotMatch(ui, /trackContactFormSubmit|gtag\(|fbq\(/);
  });
  it("does not publish unsupported retail comparisons or development notes", () => {
    assert.doesNotMatch(ui, /Benchmark pending|validating|competitor|retail|savings/i);
    assert.match(route, /createFileRoute\("\/estimate"\)/);
    assert.doesNotMatch(route, /enter rough quantities/);
  });
});
