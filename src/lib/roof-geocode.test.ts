import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickHouseGeocode } from "./roof-geocode.ts";
import { looksLikeStreetAddress, pickEsriRooftop, pickNominatimHouse } from "./roof-address.ts";

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

  it("requires a house number and street name", () => {
    assert.equal(looksLikeStreetAddress("3407 Stonehaven Dr, San Antonio, TX 78230"), true);
    assert.equal(looksLikeStreetAddress("Stonehaven Dr, San Antonio, TX"), false);
    assert.equal(looksLikeStreetAddress("San Antonio, TX"), false);
  });

  it("rejects Esri street-name centroids and keeps PointAddress rooftops", () => {
    const query = "3407 Stonehaven Dr, San Antonio, TX 78230";
    const centroid = pickEsriRooftop(
      [
        {
          address: "Stonehaven Dr, San Antonio, Texas, 78230",
          location: { x: -98.55, y: 29.53 },
          attributes: { Addr_type: "StreetName", Match_addr: "Stonehaven Dr", AddNum: "" },
        },
      ],
      query,
    );
    assert.equal(centroid, null);
    const rooftop = pickEsriRooftop(
      [
        {
          address: "3407 Stonehaven Dr, San Antonio, Texas, 78230",
          location: { x: -98.550916, y: 29.528992 },
          attributes: {
            Addr_type: "PointAddress",
            Match_addr: "3407 Stonehaven Dr, San Antonio, Texas, 78230",
            AddNum: "3407",
            StAddr: "3407 Stonehaven Dr",
          },
        },
      ],
      query,
    );
    assert.equal(rooftop?.lat, 29.528992);
    assert.equal(rooftop?.lng, -98.550916);
  });

  it("rejects a Nominatim road centroid that dropped the house number", () => {
    const hit = pickNominatimHouse(
      [
        {
          lat: "29.53",
          lon: "-98.55",
          display_name: "Stonehaven Drive, San Antonio, Bexar County, Texas",
          class: "highway",
          type: "residential",
          addresstype: "road",
          address: { road: "Stonehaven Drive" },
        },
      ],
      "3407 Stonehaven Dr, San Antonio, TX 78230",
    );
    assert.equal(hit, null);
  });
});
