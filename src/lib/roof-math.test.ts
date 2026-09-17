import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BLUE_QUAIL, BLUE_QUAIL_LENGTH_SCALE, blueQuailDiagramTrace, isBlueQuailAddress } from "./blue-quail.ts";
import {
  applyWasteFactor,
  classifyEdges,
  diagnoseMeasuredSquares,
  feetRing,
  ftPerPxFromScale,
  geodesicRingAreaSqft,
  geodesicRingPerimeterFt,
  gableRoofFt,
  inchesToFt,
  measureLengthFt,
  oneStoryExpectedSquares,
  OVERLAP_PLANES_MESSAGE,
  photoEdges,
  polygonAreaPx,
  slopedAreaSqft,
  summarizeFacets,
  summarizePhotoFacets,
  traceSanity,
  withFootprintSanity,
  roofTraceReadyToBid,
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

  it("traces Blue Quail EV diagram in the 28-square range", () => {
    const trace = blueQuailDiagramTrace();
    const ftPerPx = ftPerPxFromScale(trace.scaleA, trace.scaleB, Number(trace.scaleFeet));
    assert.ok(ftPerPx);
    const summary = summarizePhotoFacets(trace.facets, ftPerPx, 0);
    assert.equal(trace.facets.length, 5);
    assert.ok(summary.total_squares > 24);
    assert.ok(summary.total_squares < 32);
    assert.equal(summary.incomplete, null);
  });

  it("scales Blue Quail from the level 41 ft ridge", () => {
    const ftPerPx = ftPerPxFromScale(
      BLUE_QUAIL_LENGTH_SCALE.a,
      BLUE_QUAIL_LENGTH_SCALE.b,
      BLUE_QUAIL_LENGTH_SCALE.feet,
    );
    assert.ok(ftPerPx);
    const ridge = measureLengthFt(
      {
        id: "ridge-41",
        a: BLUE_QUAIL_LENGTH_SCALE.a,
        b: BLUE_QUAIL_LENGTH_SCALE.b,
        name: "Ridges 1",
        kind: "ridge",
      },
      ftPerPx,
      BLUE_QUAIL.ev.pitch,
    );
    assert.equal(ridge, 41);
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

  it("adds tapped EagleView lines into eave and ridge totals", () => {
    const summary = summarizePhotoFacets(
      [],
      1,
      0,
      [
        { id: "e1", a: [0, 0], b: [40, 0], name: "Eave", kind: "eave" },
        { id: "r1", a: [0, 0], b: [0, 12], name: "Ridge", kind: "ridge" },
        { id: "v1", a: [20, 0], b: [20, 10], name: "Valley", kind: "valley" },
      ],
    );
    assert.equal(summary.eaves_ft, 40);
    assert.equal(summary.ridges_ft, 12);
    assert.equal(summary.valleys_ft, 10.4);
    assert.equal(summary.drip_ft, 40);
  });

  it("matches EagleView 3D lengths for rakes and hips", () => {
    const rake = measureLengthFt(
      { id: "r", a: [0, 0], b: [12, 0], name: "Rake", kind: "rake" },
      1,
      "5/12",
    );
    const hip = measureLengthFt(
      { id: "h", a: [0, 0], b: [10, 0], name: "Hip", kind: "hip" },
      1,
      "5/12",
    );
    const eave = measureLengthFt(
      { id: "e", a: [0, 0], b: [20, 0], name: "Eave", kind: "eave" },
      1,
      "5/12",
    );
    assert.equal(rake, 13);
    assert.equal(hip, 10.4);
    assert.equal(eave, 20);
  });

  it("diagnoses 39 as doubled living plus waste, and lets ~28 pass", () => {
    const msg = diagnoseMeasuredSquares(39, 1673, 620, 1, "4/12");
    assert.match(msg, /counted twice/);
    assert.match(msg, /garage/);
    assert.equal(traceSanity(39, 1673, 620, 1, "4/12"), "high");
    assert.equal(traceSanity(28, 1673, 620, 1, "4/12"), "ok");
    assert.equal(traceSanity(31, 1673, 620, 1, "4/12"), "ok");
    const ok = diagnoseMeasuredSquares(28, 1673, 620, 1, "4/12");
    assert.match(ok, /^ok:/);
    const expected = oneStoryExpectedSquares(1673, 620, "4/12");
    assert.ok(expected > 24 && expected < 30, String(expected));
    const livingSloped = slopedAreaSqft(1673, "4/12") / 100;
    assert.ok(Math.abs(livingSloped * 2 * 1.12 - 39.5) < 0.05);
  });

  it("rejects two overlapping full-plan living rectangles that sum to 39", () => {
    const living = feetRing([
      [0, 0],
      [66, 0],
      [66, 1673 / 66],
      [0, 1673 / 66],
    ]);
    const facets: RoofFacet[] = [
      { id: "n", pitch: "4/12", slopeDeg: 180, latlngs: living },
      { id: "s", pitch: "4/12", slopeDeg: 0, latlngs: living },
    ];
    const summary = summarizeFacets(facets);
    assert.equal(summary.incomplete, OVERLAP_PLANES_MESSAGE);
    assert.ok(Math.abs(summary.squares_with_waste - 39.5) < 1.5, String(summary.squares_with_waste));
    const guarded = withFootprintSanity(summary, 1673, 620, 1, "4/12");
    assert.match(guarded.incomplete ?? "", /overlap|counted twice/i);
    assert.equal(roofTraceReadyToBid(guarded), false);
  });

  it("does not reject adjacent gable planes that tile the roof", () => {
    const facets: RoofFacet[] = [
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
    ];
    const summary = summarizeFacets(facets, 0);
    assert.equal(summary.incomplete, null);
    assert.ok(summary.total_squares > 0);
  });

  it("lets a living-plus-garage ranch plane pass", () => {
    const ring = feetRing([
      [0, 0],
      [66, 0],
      [66, 35],
      [0, 35],
    ]);
    const summary = withFootprintSanity(
      summarizeFacets([{ id: "a", pitch: "4/12", slopeDeg: 180, latlngs: ring }]),
      1673,
      620,
      1,
      "4/12",
    );
    assert.equal(summary.incomplete, null);
    assert.equal(roofTraceReadyToBid(summary), true);
    assert.ok(summary.total_squares > 22 && summary.total_squares < 30, String(summary.total_squares));
    assert.ok(summary.squares_with_waste < 35, String(summary.squares_with_waste));
  });

  it("rejects overlapping photo planes", () => {
    const house: [number, number][] = [
      [0, 0],
      [66, 0],
      [66, 25],
      [0, 25],
    ];
    const summary = summarizePhotoFacets(
      [
        { id: "a", points: house, pitch: "4/12" },
        { id: "b", points: house, pitch: "4/12" },
      ],
      1,
      12,
    );
    assert.equal(summary.incomplete, OVERLAP_PLANES_MESSAGE);
  });

  it("treats Blue Quail as the sample address and Stonehaven as not", () => {
    assert.equal(isBlueQuailAddress(BLUE_QUAIL.address), true);
    assert.equal(isBlueQuailAddress("3407 Stonehaven Dr, San Antonio, TX 78230"), false);
  });
});
