import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adjustedCrewDays, planningEstimate, publicEstimateLeadMessage } from "../lib/public-pricing.ts";

describe("public estimator crew day allowance", () => {
  it("does not add a day before four full base days", () => {
    assert.equal(adjustedCrewDays(1), 1);
    assert.equal(adjustedCrewDays(2), 2);
    assert.equal(adjustedCrewDays(3), 3);
  });
  it("adds one day for every four base days", () => {
    assert.equal(adjustedCrewDays(4), 5);
    assert.equal(adjustedCrewDays(5), 6);
    assert.equal(adjustedCrewDays(8), 10);
    assert.equal(adjustedCrewDays(12), 15);
  });
  it("prices a two-person crew and passes materials at cost", () => {
    assert.equal(planningEstimate({baseCrewDays: 4, materialsAtCost: 2000}), 5250);
    assert.equal(planningEstimate({baseCrewDays: 8, materialsAtCost: 2000, otherProjectCosts: 500}), 9000);
  });
  it("rejects invalid amounts", () => {
    assert.throws(() => planningEstimate({baseCrewDays: -1, materialsAtCost: 0}));
  });
  it("rounds partial working days up before allowance", () => {
    assert.equal(adjustedCrewDays(3.5), 5);
    assert.equal(adjustedCrewDays(-1), 0);
  });
});

describe("public estimator lead handoff and pricing safety", () => {
  it("carries service, size and owner-defined inputs into the contact message", () => {
    const message = publicEstimateLeadMessage({
      service: "Bathroom remodeling", size: "Medium", baseCrewDays: 4,
      materialsAtCost: 2000, otherProjectCosts: 0,
    });
    assert.match(message, /bathroom remodeling \(medium scope\)/);
    assert.match(message, /5 adjusted crew days at \$650\/day/);
    assert.match(message, /\$2,000/);
    assert.match(message, /\$5,250/);
    assert.match(message, /not a quote/);
  });
  it("does not invent a comparison when costs are unknown", () => {
    assert.throws(() => planningEstimate({ baseCrewDays: 2, materialsAtCost: Number.NaN }));
    assert.throws(() => planningEstimate({ baseCrewDays: 2, materialsAtCost: Number.POSITIVE_INFINITY }));
    assert.throws(() => planningEstimate({ baseCrewDays: 2, materialsAtCost: 0, otherProjectCosts: -1 }));
  });
});
