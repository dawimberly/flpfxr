import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER_PER_SQ } from "./home-depot-roof.ts";
import { applyWasteFactor, slopedAreaSqft } from "./roof-math.ts";
import { publicRoofQuote } from "./roof-public-quote.ts";

describe("publicRoofQuote", () => {
  it("sizes one roof from the footprint — stories do not double squares", () => {
    const src = String(publicRoofQuote);
    assert.equal(src.includes("* 2"), false);
    assert.equal(src.includes("stories"), false);
    const oneStory = publicRoofQuote(2255.4, "low", "architectural");
    const samePlanTwiceTheLiving = publicRoofQuote(2255.4, "low", "architectural");
    assert.ok(oneStory);
    assert.equal(oneStory.squaresWithWaste, samePlanTwiceTheLiving?.squaresWithWaste);
    assert.ok(oneStory.squaresWithWaste < 30);
    assert.notEqual(oneStory.squaresWithWaste, 39);
  });

  it("uses 4/12, 12% waste, and $446.83/SQ for a low architectural ranch", () => {
    const quote = publicRoofQuote(2255.4, "low", "architectural");
    assert.ok(quote);
    const sloped = slopedAreaSqft(2255.4, "4/12");
    const waste = applyWasteFactor(sloped, 12);
    assert.equal(quote.pitch, "4/12");
    assert.equal(quote.perSq, CUSTOMER_PER_SQ);
    assert.equal(quote.netSquares, Math.round((sloped / 100) * 100) / 100);
    assert.equal(quote.squaresWithWaste, Math.round((waste / 100) * 100) / 100);
    assert.equal(quote.mid, Math.round(quote.squaresWithWaste * CUSTOMER_PER_SQ));
    assert.ok(quote.low < quote.mid);
    assert.ok(quote.high > quote.mid);
  });

  it("prices 3-tab under architectural and designer over it", () => {
    const tab = publicRoofQuote(2255.4, "low", "3-tab");
    const arch = publicRoofQuote(2255.4, "low", "architectural");
    const designer = publicRoofQuote(2255.4, "low", "designer");
    assert.ok(tab && arch && designer);
    assert.ok(tab.mid < arch.mid);
    assert.ok(designer.mid > arch.mid);
  });

  it("adds steep waste and the 9/12 multiplier", () => {
    const low = publicRoofQuote(2255.4, "low", "architectural");
    const steep = publicRoofQuote(2255.4, "steep", "architectural");
    assert.ok(low && steep);
    assert.equal(steep.pitch, "9/12");
    assert.equal(steep.wastePct, 15);
    assert.ok(steep.squaresWithWaste > low.squaresWithWaste);
  });
});
