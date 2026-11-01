import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adjustedCrewDays, planningEstimate, projectPlanningEstimate, projectEstimateLeadMessage } from "../lib/public-pricing.ts";
import { DEFAULT_PROJECT_INPUTS, PROJECT_SIZES, PROJECT_SERVICES } from "../lib/public-estimate-options.ts";

describe("planning calculation", () => {
  it("adds the owner allowance once per four full rounded crew days", () => {
    for (const [base, expected] of [[1,1],[3,3],[3.5,5],[4,5],[5,6],[8,10],[12,15]]) {
      assert.equal(adjustedCrewDays(base), expected);
    }
    assert.equal(planningEstimate({baseCrewDays:4, materialsAtCost:2000}),5250);
    assert.equal(planningEstimate({baseCrewDays:8, materialsAtCost:2000,otherProjectCosts:500}),9000);
  });
  it("derives medium bathroom quantities and crew effort instead of asking the visitor for days", () => {
    const result = projectPlanningEstimate(DEFAULT_PROJECT_INPUTS)!;
    // Independent reference: floor 80*4.25, trim 36*2.85, paint 270*.45,
    // primer 270*.22, vanity 289, surround 80*5.50.
    assert.equal(result.materials,1352.5);
    assert.ok(Math.abs(result.baseCrewDays - 62.9/16) < 1e-10);
    assert.equal(result.adjustedDays,5);
    assert.equal(result.total,4603);
  });
  it("changes costs with size and chosen materials", () => {
    const totals = PROJECT_SIZES.map(size => projectPlanningEstimate({...DEFAULT_PROJECT_INPUTS,size})!.total);
    assert.ok(totals[0] < totals[1] && totals[1] < totals[2]);
    const standard = projectPlanningEstimate(DEFAULT_PROJECT_INPUTS)!;
    const stone = projectPlanningEstimate({...DEFAULT_PROJECT_INPUTS, shower:"stone"})!;
    assert.equal(stone.total - standard.total,1000); // 80*(18-5.5), no material markup
    assert.equal(stone.adjustedDays,standard.adjustedDays); // catalog's generic unit-hour defaults
  });
  it("adds entered shipping and specialist amounts once, without markup", () => {
    const plain = projectPlanningEstimate(DEFAULT_PROJECT_INPUTS)!;
    const withCosts = projectPlanningEstimate({...DEFAULT_PROJECT_INPUTS,delivery:300,specialist:750})!;
    assert.equal(withCosts.total - plain.total,1050);
    assert.equal(withCosts.adjustedDays,plain.adjustedDays);
  });
  it("calculates all supported sizes and routes custom jobs to assessment", () => {
    for (const service of PROJECT_SERVICES) for (const size of PROJECT_SIZES) {
      const value = projectPlanningEstimate({...DEFAULT_PROJECT_INPUTS,service:service.id,size});
      if (service.id === "custom") assert.equal(value,null);
      else assert.ok(value!.total > 0 && Number.isFinite(value!.total));
    }
  });
  it("rejects unknown options, invalid sizes and negative or nonfinite allowances", () => {
    for (const bad of [{delivery:-1},{delivery:NaN},{specialist:Infinity},{specialist:1000001},{floor:"__proto__"},{size:"Tiny"},{service:"roof"},{prime:"yes"}]) {
      assert.throws(() => projectPlanningEstimate({...DEFAULT_PROJECT_INPUTS,...bad} as typeof DEFAULT_PROJECT_INPUTS));
    }
  });
});
describe("customer estimate and lead handoff", () => {
  it("preserves selected scope, materials, total, allowances and estimate status", () => {
    const message = projectEstimateLeadMessage({...DEFAULT_PROJECT_INPUTS,delivery:300});
    assert.match(message,/bathroom remodeling \(medium scope\)/);
    assert.match(message,/Ceramic tile/);
    assert.match(message,/\$4,903/);
    assert.match(message,/Delivery\/shipping allowance: \$300/);
    assert.match(message,/estimate, not a quote/);
    assert.doesNotMatch(message,/650|crew day|per day|\/day/);
  });
  it("keeps daily rates and contractor-day inputs out of the public UI", () => {
    const ui = readFileSync("src/components/public-project-estimator.tsx","utf8");
    assert.doesNotMatch(ui,/Base crew days|CREW_DAY_RATE|adjustedCrewDays|\$650|crew days|Typical San Antonio retail/);
    assert.match(ui,/This is an estimate, not a quote/);
    assert.match(ui,/project support/);
    assert.match(ui,/saveLeadDraft/);
    assert.match(ui,/to="\/contact"/);
  });
});
