import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jobHasRoofing, roofCodeNote, zipFromAddress } from "./roof-code.ts";

describe("roof-code", () => {
  it("reads a San Antonio zip from an address", () => {
    assert.equal(zipFromAddress("804 Eventide, San Antonio, TX 78254"), "78254");
    assert.equal(zipFromAddress("no zip"), null);
  });

  it("cites drip-edge lap and prices valley metal, not ice-and-water", () => {
    const note = roofCodeNote("78254");
    assert.match(note, /R905\.2\.8\.5/);
    assert.match(note, /Valley metal/);
    assert.match(note, /Ice & water/);
    assert.match(note, /7\/12 to 9\/12/);
  });

  it("treats a Roof room as roofing work", () => {
    assert.equal(jobHasRoofing({ rooms: [{ room: { label: "Kitchen", extraCategories: [] } }] }), false);
    assert.equal(jobHasRoofing({ rooms: [{ room: { label: "Roof", extraCategories: ["roofing"] } }] }), true);
  });
});
