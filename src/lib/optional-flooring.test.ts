import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROJECT_INPUTS,
  effectiveIncludeFlooring,
  flooringIsOptional,
  type ProjectInputs,
} from "./public-estimate-options.ts";
import { projectPlanningEstimate, projectEstimateLeadMessage } from "./public-pricing.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { formatPublicEstimate } from "./public-estimate-display.ts";
import {
  estimateLandingFromSearch,
  inputsFromLanding,
  publicPlannerPath,
} from "./estimate-landing.ts";

const kitchen = (changes: Partial<ProjectInputs> = {}): ProjectInputs => ({
  ...DEFAULT_PROJECT_INPUTS,
  service: "kitchen",
  ...changes,
});

describe("optional flooring", () => {
  it("is optional only for kitchen and bathroom remodels", () => {
    assert.equal(flooringIsOptional("kitchen"), true);
    assert.equal(flooringIsOptional("bathroom"), true);
    assert.equal(flooringIsOptional("flooring"), false);
    assert.equal(flooringIsOptional("interior-paint"), false);
    assert.equal(effectiveIncludeFlooring({ service: "flooring", includeFlooring: false }), true);
  });

  it("excludes floor covering and install dollars when unchecked", () => {
    const off = projectPlanningEstimate(kitchen({ includeFlooring: false }))!;
    const on = projectPlanningEstimate(kitchen({ includeFlooring: true }))!;
    assert.equal(off.lines.some(row => row.id === "floor"), false);
    assert.ok(on.lines.some(row => row.id === "floor"));
    assert.ok(on.total > off.total);
    assert.equal(formatPublicEstimate(publicEstimateResult(kitchen({ includeFlooring: false }))!.total), "$12,000");
    assert.equal(formatPublicEstimate(publicEstimateResult(kitchen({ includeFlooring: true }))!.total), "$13,300");
  });

  it("explains the Large bathroom flooring delta without exposing internal rates", () => {
    const without = publicEstimateResult(kitchen({
      service: "bathroom", size: "Large", vanity: "VA60DD", includeFlooring: false,
    }))!;
    // $13,300 is the Large bath combined total when optional flooring is included
    // with ceramic tile (covering + install + tile setting materials on the larger
    // Large preset floor area). Default LVP-with-flooring is a smaller combined bump.
    const withTileFloor = publicEstimateResult(kitchen({
      service: "bathroom", size: "Large", vanity: "VA60DD", includeFlooring: true, floor: "tile",
    }))!;
    const withLvpFloor = publicEstimateResult(kitchen({
      service: "bathroom", size: "Large", vanity: "VA60DD", includeFlooring: true, floor: "lvp",
    }))!;
    assert.equal(formatPublicEstimate(without.total), "$10,300");
    assert.equal(formatPublicEstimate(withTileFloor.total), "$13,300");
    assert.equal(formatPublicEstimate(withLvpFloor.total), "$10,700");
    assert.equal(withTileFloor.total - without.total, 3000);
    const offLines = projectPlanningEstimate(kitchen({
      service: "bathroom", size: "Large", vanity: "VA60DD", includeFlooring: false,
    }))!;
    const onLines = projectPlanningEstimate(kitchen({
      service: "bathroom", size: "Large", vanity: "VA60DD", includeFlooring: true, floor: "tile",
    }))!;
    assert.equal(offLines.lines.some(row => row.id === "floor"), false);
    assert.ok(onLines.lines.some(row => row.id === "floor"));
  });

  it("does not invent a flooring deduction for dedicated flooring projects", () => {
    const project = kitchen({ service: "flooring", includeFlooring: false, roomSqft: 400 });
    const result = projectPlanningEstimate(project)!;
    assert.ok(result.lines.some(row => row.id === "floor"));
    assert.equal(formatPublicEstimate(publicEstimateResult(project)!.total), "$3,600");
  });

  it("removes bathroom tiled-floor setting materials when flooring is excluded", () => {
    const off = projectPlanningEstimate(kitchen({
      service: "bathroom", floor: "tile", includeFlooring: false, vanity: "VA30",
    }))!;
    const on = projectPlanningEstimate(kitchen({
      service: "bathroom", floor: "tile", includeFlooring: true, vanity: "VA30",
    }))!;
    assert.equal(off.lines.some(row => row.id === "floor"), false);
    const offThinset = off.lines.find(row => row.id === "thinset")!.materials;
    const onThinset = on.lines.find(row => row.id === "thinset")!.materials;
    assert.ok(onThinset > offThinset);
  });

  it("preserves includeFlooring in shared planner URLs and treats older links as excluded", () => {
    const older = inputsFromLanding(estimateLandingFromSearch({ service: "kitchen", size: "medium" }));
    assert.equal(older.includeFlooring, false);
    assert.equal(publicPlannerPath(older).includes("includeFlooring"), false);
    const withFloor = kitchen({ includeFlooring: true, floor: "lvp" });
    assert.match(publicPlannerPath(withFloor), /includeFlooring=1/);
    assert.match(publicPlannerPath(withFloor), /floor=lvp/);
    const restored = inputsFromLanding(estimateLandingFromSearch({
      service: "kitchen", size: "medium", includeFlooring: "1", floor: "wood",
    }));
    assert.equal(restored.includeFlooring, true);
    assert.equal(restored.floor, "wood");
  });

  it("states flooring inclusion in the lead message without a separate flooring price", () => {
    const off = projectEstimateLeadMessage(kitchen({ includeFlooring: false }));
    const on = projectEstimateLeadMessage(kitchen({ includeFlooring: true }));
    assert.match(off, /Flooring not included/);
    assert.match(on, /Flooring included/);
    assert.doesNotMatch(off, /Flooring: \$/);
    assert.doesNotMatch(on, /Flooring: \$/);
  });
});
