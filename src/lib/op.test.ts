import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineTakesOp, opBaseFromLines } from "./op.ts";

describe("no O&P on roofing", () => {
  it("skips the roofing category", () => {
    assert.equal(lineTakesOp("roofing"), false);
    assert.equal(lineTakesOp("Roofing"), false);
    assert.equal(lineTakesOp("walls/paint"), true);
    assert.equal(lineTakesOp("cabinets"), true);
  });

  it("keeps roofing out of the O&P base", () => {
    const base = opBaseFromLines([
      { category: "roofing", lineTotal: 16715.57 },
      { category: "walls/paint", lineTotal: 1000 },
      { category: "flooring", lineTotal: 2500 },
    ]);
    assert.equal(base, 3500);
  });
});
