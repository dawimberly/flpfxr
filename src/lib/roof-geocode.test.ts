import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickHouseGeocode } from "./roof-geocode.ts";

describe("roof-geocode", () => {
  it("picks a rooftop hit over a street-center guess", () => {
    const hit = pickHouseGeocode([
      {
        formatted_address: "Street center",
        geometry: { location: { lat: 29.58, lng: -98.45 }, location_type: "GEOMETRIC_CENTER" },
      },
      {
        formatted_address: "2519 Blue Quail St, San Antonio, TX 78232, USA",
        geometry: {
          location: { lat: () => 29.5803375, lng: () => -98.4516699 },
          location_type: "ROOFTOP",
        },
      },
    ]);
    assert.equal(hit?.lat, 29.5803375);
    assert.equal(hit?.lng, -98.4516699);
    assert.match(hit?.label || "", /Blue Quail/);
  });

  it("returns null when Google sent no points", () => {
    assert.equal(pickHouseGeocode([]), null);
    assert.equal(pickHouseGeocode([{ formatted_address: "nowhere" }]), null);
  });
});
