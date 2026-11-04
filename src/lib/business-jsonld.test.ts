import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GOOGLE_BUSINESS_URL, GOOGLE_MAPS_CID, businessJsonLd } from "./business-jsonld.ts";
import { SERVICE_AREAS } from "./site.ts";

describe("businessJsonLd", () => {
  it("publishes San Antonio locality, verified hours, and no storefront pin", () => {
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
    assert.equal("geo" in data, false);
    assert.equal("openingHours" in data, false);
    assert.equal("aggregateRating" in data, false);
    assert.equal("review" in data, false);
    assert.equal(BigInt("0x1238d1d38ea1b563").toString(), GOOGLE_MAPS_CID);
    assert.equal(GOOGLE_MAPS_CID, "1313029997939766627");
    assert.notEqual(GOOGLE_MAPS_CID, "16586128267752596041");
    assert.deepEqual(data.sameAs, [GOOGLE_BUSINESS_URL]);
    assert.deepEqual(data.openingHoursSpecification, [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "10:00",
        closes: "16:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Sunday",
        opens: "00:00",
        closes: "00:00",
      },
    ]);
    const areas = data.areaServed as Array<{ name: string; address: { addressRegion: string } }>;
    assert.deepEqual(
      areas.map((area) => area.name),
      [...SERVICE_AREAS],
    );
    assert.equal(areas.some((area) => area.name === "New Braunfels"), true);
    assert.equal(areas.some((area) => area.name === "Fredericksburg"), true);
    assert.equal(areas.every((area) => area.address.addressRegion === "TX"), true);
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /streetAddress|"geo"|aggregateRating|reviewCount|insured/i);
    assert.doesNotMatch(serialized, /29\.4581826|-98\.518079/);
  });
});
