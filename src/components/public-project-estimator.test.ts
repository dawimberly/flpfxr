import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adjustedCrewDays, planningEstimate } from "../lib/public-pricing.ts";

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
