import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  autoRoofSummary,
  pitchLabelFromDegrees,
  quoteFromPlanSqft,
  quoteFromSolarInsights,
} from "./roof-auto.ts";

describe("roof-auto", () => {
  it("turns 22.6 degrees into 5/12", () => {
    assert.equal(pitchLabelFromDegrees(22.62), "5/12");
    assert.equal(pitchLabelFromDegrees(0), "0/12");
    assert.equal(pitchLabelFromDegrees(45), "12/12");
  });

  it("quotes a house-sized Solar roof near 29 squares", () => {
    const quote = quoteFromSolarInsights({
      solarPotential: {
        wholeRoofStats: { areaMeters2: 232, groundAreaMeters2: 214 },
        buildingStats: { areaMeters2: 240, groundAreaMeters2: 220 },
        roofSegmentStats: [
          { pitchDegrees: 22.6, stats: { areaMeters2: 116 } },
          { pitchDegrees: 22.6, stats: { areaMeters2: 116 } },
        ],
      },
    });
    assert.ok(quote);
    assert.equal(quote?.source, "google-solar");
    assert.equal(quote?.pitch, "5/12");
    assert.ok((quote?.squares ?? 0) >= 24);
    assert.ok((quote?.squares ?? 0) <= 28);
    assert.equal(autoRoofSummary(quote!).incomplete, null);
  });

  it("builds a 5/12 quote from a plan footprint", () => {
    const quote = quoteFromPlanSqft(2300, "5/12");
    assert.ok(quote);
    assert.equal(quote?.source, "osm-footprint");
    assert.ok((quote?.squares ?? 0) >= 24);
    assert.ok((quote?.squares ?? 0) <= 27);
  });
});
