import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessJsonLd } from "./business-jsonld.ts";
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
    assert.equal("sameAs" in data, false);
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
