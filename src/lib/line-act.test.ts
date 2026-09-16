import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  actDescription,
  actUnitCost,
  defaultLineAct,
  normalizeLineAct,
} from "./line-act.ts";

const shingles = {
  name: "Laminated composition shingles",
  cost_per_unit: 325,
  remove_cost_per_unit: 72,
};

const tearoff = {
  name: "Tear-off composition shingles — haul off",
  cost_per_unit: 72,
};

describe("line act R&R / R / +", () => {
  it("defaults tear-off to remove only and shingles to install", () => {
    assert.equal(defaultLineAct(tearoff.name), "r");
    assert.equal(defaultLineAct(shingles.name), "plus");
    assert.equal(normalizeLineAct("plus", tearoff.name), "r");
  });

  it("prices + install, R remove, and R&R as both", () => {
    assert.equal(actUnitCost(shingles, "plus"), 325);
    assert.equal(actUnitCost(shingles, "r"), 72);
    assert.equal(actUnitCost(shingles, "rr"), 397);
    assert.equal(actUnitCost(tearoff, "r"), 72);
    assert.equal(actUnitCost(tearoff, "plus"), 0);
  });

  it("prefixes the catalog name with the code", () => {
    assert.equal(actDescription(shingles.name, "rr"), "R&R Laminated composition shingles");
    assert.equal(actDescription(tearoff.name, "r"), "R Tear-off composition shingles — haul off");
    assert.equal(actDescription(shingles.name, "plus"), "+ Laminated composition shingles");
  });
});
