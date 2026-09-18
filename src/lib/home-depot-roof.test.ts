import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_PER_SQ,
  HD_OAKRIDGE_BUNDLE,
  HD_BUNDLES_PER_SQ,
  homeDepotUnitCost,
  roofCrewBid,
} from "./home-depot-roof.ts";

describe("home-depot-roof", () => {
  it("prices Oakridge at 3 bundles per square", () => {
    assert.equal(
      homeDepotUnitCost("+ Owens Corning Oakridge"),
      HD_OAKRIDGE_BUNDLE * HD_BUNDLES_PER_SQ,
    );
  });

  it("prices ProArmor synthetic per square", () => {
    assert.equal(homeDepotUnitCost("+ Synthetic underlayment"), 13.54);
  });

  it("leaves tear-off on labor", () => {
    assert.equal(homeDepotUnitCost("R 3-tab composition shingles \u2014 25 yr"), null);
  });

  it("prices ice and water per sq ft from a 3 ft x 75 ft roll", () => {
    assert.equal(
      homeDepotUnitCost("+ Ice & water barrier"),
      Math.round((208 / 225) * 10000) / 10000,
    );
  });

  it("prices WO fasteners and NP1", () => {
    assert.equal(homeDepotUnitCost("+ Coil nails \u2014 1 1/4 in (20 SQ/box)"), 44.98);
    assert.equal(homeDepotUnitCost("+ Roofing caulk \u2014 NP1"), 8.97);
  });

  it("uses $446.83 market for the customer total and HD plus crew for the contractor", () => {
    const bid = roofCrewBid([
      { description: "+ Owens Corning Oakridge", quantity: 39, lineTotal: 10400.91 },
      { description: "+ Synthetic underlayment", quantity: 35.78, lineTotal: 1750 },
      { description: "R Debris haul-off", quantity: 1, lineTotal: 385 },
      { description: "+ Material delivery", quantity: 1, lineTotal: 79 },
    ]);
    assert.equal(bid?.squares, 39);
    assert.equal(bid?.crew, 3900);
    assert.equal(bid?.customerTotal, Math.round(39 * CUSTOMER_PER_SQ * 100) / 100);
    assert.equal(bid?.customerPerSq, CUSTOMER_PER_SQ);
    assert.equal(bid?.laborPerSq, 100);
  });

  it("prices Stonehaven in the mid-20s, not 39 squares", () => {
    const bid = roofCrewBid([
      { description: "+ Owens Corning Oakridge", quantity: 26.62, lineTotal: 0 },
      { description: "+ Synthetic underlayment", quantity: 23.77, lineTotal: 0 },
      { description: "+ Asphalt starter \u2014 universal", quantity: 133, lineTotal: 0 },
      { description: "+ Hip / ridge cap \u2014 composition", quantity: 67, lineTotal: 0 },
      { description: "+ Drip edge", quantity: 67, lineTotal: 0 },
      { description: "+ Coil nails \u2014 1 1/4 in (20 SQ/box)", quantity: 2, lineTotal: 0 },
      { description: "+ Plastic cap nails \u2014 1 in (20 SQ/box)", quantity: 2, lineTotal: 0 },
      { description: "+ Roofing caulk \u2014 NP1", quantity: 3, lineTotal: 0 },
      { description: "+ Material delivery", quantity: 1, lineTotal: 0 },
      { description: "R Debris haul-off", quantity: 1, lineTotal: 385 },
      { description: "+ Roofing crew install", quantity: 26.62, lineTotal: 2662 },
    ]);
    assert.ok(bid);
    assert.equal(bid.squares, 26.62);
    assert.equal(bid.crew, 2662);
    assert.ok(Math.abs(bid.materials - 4329.58) < 1.5);
    assert.ok(Math.abs(bid.total - 6991.58) < 1.5);
    assert.equal(bid.customerTotal, 11894.61);
  });
});
