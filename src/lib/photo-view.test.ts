import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientToImagePx, imageFit, wrapDeg, coverScale } from "./photo-view.ts";

const view = { left: 0, top: 0, width: 200, height: 200 };

describe("photo-view", () => {
  it("wraps headings into 0..360", () => {
    assert.equal(wrapDeg(-90), 270);
    assert.equal(wrapDeg(370), 10);
  });

  it("maps an unrotated click the same as object-contain", () => {
    const { ox, oy, fit } = imageFit(200, 200, 200, 200);
    assert.equal(ox, 0);
    assert.equal(oy, 0);
    assert.equal(fit, 1);
    const pt = clientToImagePx(150, 100, view, 200, 200, 0);
    assert.deepEqual(pt, [150, 100]);
  });

  it("covers a tall viewport at 90 degrees", () => {
    assert.equal(coverScale(200, 200, 0), 1);
    assert.equal(coverScale(100, 200, 90), 2);
  });

  it("maps a click on the right to the image top after a 90 degree clockwise spin", () => {
    const pt = clientToImagePx(150, 100, view, 200, 200, 90);
    assert.ok(pt);
    assert.equal(Math.round(pt[0]), 100);
    assert.equal(Math.round(pt[1]), 50);
  });
});
