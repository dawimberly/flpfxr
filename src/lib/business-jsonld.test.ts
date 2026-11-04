import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUSINESS_GEO, GOOGLE_BUSINESS_URL, GOOGLE_MAPS_CID, businessJsonLd } from "./business-jsonld.ts";
import { SERVICE_AREAS } from "./site.ts";

describe("businessJsonLd", () => {
  it("publishes San Antonio locality without a street, hours, or reviews", () => {
    const data = businessJsonLd();
    const address = data.address as {
      addressLocality: string;
      addressRegion: string;
      streetAddress?: string;
    };
    assert.equal(data["@type"], "GeneralContractor");
    assert.equal(address.addressLocality, "San Antonio");
    assert.equal(address.addressRegion, "TX");
    assert.equal("streetAddress" in address, false);
    assert.equal("openingHours" in data, false);
    assert.equal("openingHoursSpecification" in data, false);
    assert.equal("aggregateRating" in data, false);
    assert.equal("review" in data, false);
    assert.equal(BigInt(`0xe62dc3c84e756249`).toString(), GOOGLE_MAPS_CID);
    assert.notEqual(GOOGLE_MAPS_CID, "16586208226577359433");
    assert.deepEqual(data.sameAs, [GOOGLE_BUSINESS_URL]);
    const geo = data.geo as { "@type": string; latitude: number; longitude: number };
    assert.equal(geo["@type"], "GeoCoordinates");
    assert.equal(geo.latitude, BUSINESS_GEO.latitude);
    assert.equal(geo.longitude, BUSINESS_GEO.longitude);
    assert.equal(geo.latitude, 29.4581826);
    assert.equal(geo.longitude, -98.518079);
    const areas = data.areaServed as Array<{ name: string; address: { addressRegion: string } }>;
    assert.deepEqual(
      areas.map((area) => area.name),
      [...SERVICE_AREAS],
    );
    assert.equal(areas.every((area) => area.address.addressRegion === "TX"), true);
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /streetAddress|openingHours|aggregateRating|reviewCount|insured/i);
  });
});
