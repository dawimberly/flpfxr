import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  footprintValleyCandidates,
  geojsonRingToLatLngs,
  outlineFromMsbFp2,
  pickContainingBuilding,
  ringContainsLngLat,
} from "./roof-outline.ts";
import { feetRing } from "./roof-math.ts";

const HOUSE: number[][] = [
  [-98.551, 29.5288],
  [-98.551, 29.5292],
  [-98.5507, 29.5292],
  [-98.5507, 29.5288],
  [-98.551, 29.5288],
];

const NEIGHBOR: number[][] = [
  [-98.55065, 29.52895],
  [-98.55065, 29.52915],
  [-98.5505, 29.52915],
  [-98.5505, 29.52895],
  [-98.55065, 29.52895],
];

const PIN = { lat: 29.528992, lng: -98.550916 };

describe("roof-outline", () => {
  it("treats GeoJSON as [lng, lat] and facets as [lat, lng]", () => {
    const ring = geojsonRingToLatLngs(HOUSE);
    assert.equal(ring[0][0], 29.5288);
    assert.equal(ring[0][1], -98.551);
    assert.equal(ring.length, 4);
  });

  it("says the rooftop is inside the house ring", () => {
    assert.equal(ringContainsLngLat(HOUSE, PIN.lng, PIN.lat), true);
    assert.equal(ringContainsLngLat(NEIGHBOR, PIN.lng, PIN.lat), false);
  });

  it("picks the polygon that contains the rooftop, not the closest neighbor", () => {
    const picked = pickContainingBuilding(
      [
        { geometry: { type: "Polygon", coordinates: [NEIGHBOR] } },
        { geometry: { type: "Polygon", coordinates: [HOUSE] } },
      ],
      PIN.lat,
      PIN.lng,
    );
    assert.ok(picked);
    assert.ok(picked.planSqft > 1000);
    const neighbor = pickContainingBuilding(
      [{ geometry: { type: "Polygon", coordinates: [NEIGHBOR] } }],
      PIN.lat,
      PIN.lng,
    );
    assert.equal(neighbor, null);
  });

  it("returns null when the pin is not on a building", () => {
    const miss = outlineFromMsbFp2(
      { features: [{ geometry: { type: "Polygon", coordinates: [NEIGHBOR] } }] },
      PIN.lat,
      PIN.lng,
    );
    assert.equal(miss, null);
  });

  it("flags concave footprint corners for valley review without inventing any on a rectangle", () => {
    const rectangle = feetRing([
      [0, 0],
      [40, 0],
      [40, 25],
      [0, 25],
    ]);
    const ell = feetRing([
      [0, 0],
      [40, 0],
      [40, 15],
      [20, 15],
      [20, 35],
      [0, 35],
    ]);
    assert.deepEqual(footprintValleyCandidates(rectangle), []);
    assert.equal(footprintValleyCandidates(ell).length, 1);
    assert.equal(footprintValleyCandidates([...ell].reverse()).length, 1);
  });
});
