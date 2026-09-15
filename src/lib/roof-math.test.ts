import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyWasteFactor,
  classifyEdges,
  feetRing,
  ftPerPxFromScale,
  geodesicRingAreaSqft,
  geodesicRingPerimeterFt,
  gableRoofFt,
  inchesToFt,
  photoEdges,
  polygonAreaPx,
  slopedAreaSqft,
  summarizeFacets,
  summarizePhotoFacets,
  type RoofFacet,
} from "./roof-math.ts";

function facet(partial: Omit<RoofFacet, "id"> & { id?: string }): RoofFacet {
  return { id: partial.id ?? "f", ...partial };
}

describe("roof-math", () => {
  it("uses the 6/12 multiplier", () => {
    assert.equal(Math.round(slopedAreaSqft(1000, "6/12") * 10) / 10, 1118);
  });

  it("applies 12% waste", () => {
    assert.equal(applyWasteFactor(1000), 1120);
  });

  it("measures a 100 ft square in San Antonio", () => {
    const lat0 = 29.4241;
    const lng0 = -98.4936;
    const ring = feetRing(
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      lat0,
      lng0,
    );
    const area = geodesicRingAreaSqft(ring);
    const peri = geodesicRingPerimeterFt(ring);
    assert.ok(area > 9900 && area < 10100, String(area));
    assert.ok(peri > 395 && peri < 405, String(peri));
  });

  it("names gable eaves, ridge, and rakes", () => {
    const facets = [
      facet({
        pitch: "4/12",
        slopeDeg: 180,
        latlngs: feetRing([
          [0, 0],
          [40, 0],
          [40, 12],
          [0, 12],
        ]),
      }),
      facet({
        pitch: "4/12",
        slopeDeg: 0,
        latlngs: feetRing([
          [0, 12],
          [40, 12],
          [40, 24],
          [0, 24],
        ]),
      }),
    ];
    const summary = summarizeFacets(facets, 0);
    assert.equal(summary.facet_count, 2);
    assert.ok(Math.abs((summary.eaves_ft ?? 0) - 80) < 0.8);
    assert.ok(Math.abs((summary.ridges_ft ?? 0) - 40) < 0.8);
    assert.equal(summary.hips_ft, 0);
    assert.equal(summary.valleys_ft, 0);
    const rake = 4 * Math.sqrt(12 ** 2 + 4 ** 2);
    assert.ok(Math.abs((summary.rakes_ft ?? 0) - rake) < 1);
    assert.equal(summary.shared_edges, 1);
  });

  it("treats a shed high edge as step, not ridge", () => {
    const facets = [
      facet({
        pitch: "4/12",
        slopeDeg: 180,
        latlngs: feetRing([
          [0, 0],
          [40, 0],
          [40, 12],
          [0, 12],
        ]),
      }),
    ];
    const summary = summarizeFacets(facets, 0);
    assert.ok(Math.abs((summary.eaves_ft ?? 0) - 40) < 0.8);
    assert.equal(summary.ridges_ft, 0);
    assert.ok(Math.abs((summary.steps_ft ?? 0) - 40) < 0.8);
  });

  it("does not classify edges without drain", () => {
    const facets = [
      facet({
        pitch: "6/12",
        slopeDeg: null,
        latlngs: feetRing([
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
        ]),
      }),
    ];
    const edges = classifyEdges(facets);
    assert.equal(edges.classified, false);
    const summary = summarizeFacets(facets);
    assert.equal(summary.incomplete, null);
    assert.ok(summary.total_squares > 0);
  });

  it("flags missing pitch as incomplete", () => {
    const facets = [
      facet({
        pitch: "",
        slopeDeg: null,
        latlngs: feetRing([
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
        ]),
      }),
    ];
    assert.equal(summarizeFacets(facets).incomplete, "Every facet needs a pitch.");
  });

  it("scales a photo square from a labeled length", () => {
    const square: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    assert.equal(polygonAreaPx(square), 10000);
    const ftPerPx = ftPerPxFromScale([0, 0], [100, 0], 40);
    assert.ok(ftPerPx);
    assert.equal(Math.round(ftPerPx * 1000) / 1000, 0.4);
    const summary = summarizePhotoFacets([{ id: "a", points: square, pitch: "6/12" }], ftPerPx, 0);
    assert.equal(summary.total_flat_area_sqft, 1600);
    assert.equal(summary.total_area_with_pitch_multiplier_sqft, 1788.8);
  });

  it("adds rake overhang on both gables", () => {
    assert.equal(gableRoofFt(22.2, 12), 24.2);
    assert.equal(gableRoofFt(22.2, 0), 22.2);
    assert.equal(inchesToFt(18), 1.5);
  });

  it("names photo eaves and rakes when drain is set", () => {
    const north: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 12],
      [0, 12],
    ];
    const south: [number, number][] = [
      [0, 12],
      [40, 12],
      [40, 24],
      [0, 24],
    ];
    const facets = [
      { id: "n", points: north, pitch: "4/12", slopeDeg: 0 },
      { id: "s", points: south, pitch: "4/12", slopeDeg: 180 },
    ];
    const edges = photoEdges(facets, 1);
    const kinds = edges.map((edge) => edge.kind).sort();
    assert.ok(kinds.includes("eave"));
    assert.ok(kinds.includes("rake"));
    assert.ok(kinds.includes("ridge"));
    const summary = summarizePhotoFacets(facets, 1, 0);
    assert.ok(Math.abs((summary.eaves_ft ?? 0) - 80) < 1.2);
    assert.ok(Math.abs((summary.ridges_ft ?? 0) - 40) < 1.2);
  });

  it("asks for a scale before photo squares", () => {
    const summary = summarizePhotoFacets(
      [{ id: "a", points: [[0, 0], [10, 0], [10, 10]], pitch: "4/12" }],
      null,
    );
    assert.equal(summary.incomplete, "Label a known length so the picture has a scale.");
  });
});
