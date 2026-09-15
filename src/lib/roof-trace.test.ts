import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeFacets, feetRing } from "./roof-math.ts";
import {
  ROOF_SHINGLE,
  ROOF_TEAROFF,
  roofingSelectionsFromSummary,
} from "./roof-line-items.ts";

describe("roof-trace", () => {
  it("writes squares, drip, and ridge cap from a classified gable", () => {
    const summary = summarizeFacets(
      [
        {
          id: "a",
          pitch: "4/12",
          slopeDeg: 180,
          latlngs: feetRing([
            [0, 0],
            [40, 0],
            [40, 12],
            [0, 12],
          ]),
        },
        {
          id: "b",
          pitch: "4/12",
          slopeDeg: 0,
          latlngs: feetRing([
            [0, 12],
            [40, 12],
            [40, 24],
            [0, 24],
          ]),
        },
      ],
      12,
    );
    const items = roofingSelectionsFromSummary(summary);
    const names = items.map((item) => item.name);
    assert.ok(names.includes(ROOF_SHINGLE));
    assert.ok(names.includes(ROOF_TEAROFF));
    assert.ok(names.includes("Drip edge / gutter apron"));
    assert.ok(names.includes("Hip / ridge cap \u2014 composition"));
    const shingles = items.find((item) => item.name === ROOF_SHINGLE);
    assert.equal(shingles?.quantity, summary.squares_with_waste);
    assert.ok((shingles?.quantity ?? 0) > 0);
  });
});
