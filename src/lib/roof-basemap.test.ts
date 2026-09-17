import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BLUE_QUAIL } from "./blue-quail.ts";
import {
  availableBasemaps,
  esriWaybackAppUrl,
  googleEarthNadirUrl,
  googleMapsSatelliteUrl,
  googleMapsScriptUrl,
  openTopographyUrl,
  parseWaybackConfig,
  pickWinterWayback,
  roofMapBasemap,
  waybackDateLabel,
  waybackTileUrl,
} from "./roof-basemap.ts";

describe("roof-basemap", () => {
  it("parses Wayback dates newest first", () => {
    const rows = parseWaybackConfig({
      "31144": { itemTitle: "World Imagery (Wayback 2014-06-11)" },
      "26334": { itemTitle: "World Imagery (Wayback 2026-08-05)" },
    });
    assert.equal(rows[0].date, "2026-08-05");
    assert.equal(rows[0].release, "26334");
    assert.equal(rows[1].date, "2014-06-11");
  });

  it("builds a Wayback XYZ url from the release number", () => {
    assert.equal(
      waybackTileUrl("26334"),
      "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/26334/{z}/{y}/{x}",
    );
  });

  it("lists Google satellite first", () => {
    assert.equal(availableBasemaps()[0]?.id, "google");
  });

  it("builds the Google Maps JS url", () => {
    assert.match(googleMapsScriptUrl("test-key"), /maps\.googleapis\.com\/maps\/api\/js/);
    assert.match(googleMapsScriptUrl("test-key"), /libraries=maps3d/);
  });

  it("hides MapTiler until a key exists", () => {
    assert.equal(
      availableBasemaps().some((row) => row.id === "maptiler"),
      false,
    );
    assert.equal(
      availableBasemaps("demo").some((row) => row.id === "maptiler"),
      true,
    );
  });

  it("opens Google Earth straight down on Blue Quail", () => {
    const url = googleEarthNadirUrl(BLUE_QUAIL.center.lat, BLUE_QUAIL.center.lng);
    assert.match(url, /earth\.google\.com\/web/);
    assert.match(url, /29\.5803375,-98\.4516699/);
    assert.match(url, /0h,0t,0r/);
    assert.match(
      googleEarthNadirUrl(BLUE_QUAIL.center.lat, BLUE_QUAIL.center.lng, BLUE_QUAIL.address),
      /search\/2519/,
    );
  });

  it("points Maps, Wayback, and OpenTopography at the same house", () => {
    const { lat, lng } = BLUE_QUAIL.center;
    assert.match(googleMapsSatelliteUrl(lat, lng), /google\.com\/maps/);
    assert.match(esriWaybackAppUrl(lat, lng), /livingatlas\.arcgis\.com\/wayback/);
    assert.match(openTopographyUrl(lat, lng), /opentopography\.org/);
    assert.match(roofMapBasemap("usgs").url, /nationalmap\.gov/);
  });

  it("picks the newest DecemberFebruary Wayback for leaf-off roofs", () => {
    const rows = parseWaybackConfig({
      "26334": { itemTitle: "World Imagery (Wayback 2026-08-05)" },
      "64001": { itemTitle: "World Imagery (Wayback 2026-02-26)" },
      "22252": { itemTitle: "World Imagery (Wayback 2026-01-29)" },
      "22869": { itemTitle: "World Imagery (Wayback 2026-03-26)" },
    });
    assert.equal(pickWinterWayback(rows)?.release, "64001");
    assert.equal(pickWinterWayback(rows)?.date, "2026-02-26");
    assert.match(waybackDateLabel("2026-02-26"), /leaf-off/);
    assert.equal(waybackDateLabel("2026-08-05"), "2026-08-05");
  });

  it("falls back to November or March when there is no DecFeb", () => {
    const rows = parseWaybackConfig({
      "1": { itemTitle: "World Imagery (Wayback 2025-08-01)" },
      "2": { itemTitle: "World Imagery (Wayback 2025-11-20)" },
    });
    assert.equal(pickWinterWayback(rows)?.date, "2025-11-20");
  });
});
