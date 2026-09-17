import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  autoRoofSummary,
  pitchLabelFromDegrees,
  quoteFromPlanSqft,
} from "./roof-auto.ts";

describe("roof-auto", () => {
  it("turns 22.6 degrees into 5/12", () => {
    assert.equal(pitchLabelFromDegrees(22.62), "5/12");
    assert.equal(pitchLabelFromDegrees(0), "0/12");
    assert.equal(pitchLabelFromDegrees(45), "12/12");
  });

  it("does not size Search quotes from Google Solar Building Insights", () => {
    const src = readFileSync(new URL("./roof-auto.ts", import.meta.url), "utf8");
    assert.equal(src.includes("solar.googleapis.com"), false);
    assert.equal(src.includes("quoteFromSolarInsights"), false);
    assert.equal(src.includes("google-solar"), false);
  });

  it("builds a 5/12 quote from a plan footprint", () => {
    const quote = quoteFromPlanSqft(2300, "5/12");
    assert.ok(quote);
    assert.equal(quote?.source, "osm-footprint");
    assert.ok((quote?.squares ?? 0) >= 24);
    assert.ok((quote?.squares ?? 0) <= 27);
  });

  it("applies 7/12 and five valleys as 15% waste plus steep", () => {
    const quote = quoteFromPlanSqft(3127, "5/12");
    const summary = autoRoofSummary(quote!, { pitch: "7/12", rakeCount: 2, valleyCount: 5 });
    assert.equal(summary.waste_factor_pct, 15);
    assert.ok(summary.steep_squares > 0);
    assert.ok(summary.total_squares > (quote?.squares ?? 0));
  });

  it("fills unmeasured valley and eave lengths from MRC typicals", () => {
    const quote = quoteFromPlanSqft(2774, "9/12");
    const summary = autoRoofSummary(quote!, { pitch: "9/12", rakeCount: 8, valleyCount: 4 });
    assert.equal(summary.valleys_ft, 50);
    assert.ok((summary.eaves_ft ?? 0) > 200);
    assert.ok((summary.eaves_ft ?? 0) < 250);
    assert.ok((summary.ridges_hips_ft ?? 0) > 200);
  });
});
