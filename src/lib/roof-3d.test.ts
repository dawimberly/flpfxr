import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BLUE_QUAIL } from "./blue-quail.ts";
import {
  extraMap3dPinElements,
  parseGmpClick,
  roof3dHouseCamera,
  roof3dMovedMeters,
  writeRoof3dCamera,
} from "./roof-3d.ts";

describe("roof-3d", () => {
  it("frames Blue Quail as a turnable 3D house, not nadir", () => {
    const cam = roof3dHouseCamera(BLUE_QUAIL.center.lat, BLUE_QUAIL.center.lng);
    assert.equal(cam.center.lat, BLUE_QUAIL.center.lat);
    assert.ok(cam.tilt > 40);
    assert.ok(cam.range > 80);
    assert.ok(cam.range < 700);
  });

  it("Top starts pulled back so the whole house is in view", () => {
    const cam = roof3dHouseCamera(29.5, -98.4, { top: true });
    assert.ok(cam.range >= 400);
    assert.ok(cam.tilt < 15);
  });

  it("Top drops tilt so the roof is almost straight down", () => {
    const cam = roof3dHouseCamera(29.5, -98.4, { top: true, heading: 90 });
    assert.ok(cam.tilt < 15);
    assert.equal(cam.heading, 90);
  });

  it("writes range last so Map3D does not leave the camera inside the mesh", () => {
    const order: string[] = [];
    const map = {
      _range: 0 as unknown,
      set center(_value: unknown) {
        order.push("center");
      },
      set heading(_value: unknown) {
        order.push("heading");
      },
      set tilt(_value: unknown) {
        order.push("tilt");
      },
      set range(value: unknown) {
        order.push("range");
        this._range = value;
      },
      get range() {
        return this._range;
      },
    };
    writeRoof3dCamera(map, roof3dHouseCamera(29.5, -98.4));
    assert.equal(map.range, 480);
    assert.equal(order.at(-1), "range");
  });

  it("treats a few meters as the same roof", () => {
    assert.ok(
      roof3dMovedMeters({ lat: 29.58033, lng: -98.45167 }, { lat: 29.58034, lng: -98.45167 }) < 8,
    );
    assert.ok(roof3dMovedMeters({ lat: 29.58033, lng: -98.45167 }, { lat: 29.59, lng: -98.45 }) > 100);
  });

  it("reads a 3D map tap as lat/lng", () => {
    assert.deepEqual(parseGmpClick({ position: { lat: 29.58, lng: -98.45 } }), [29.58, -98.45]);
    assert.deepEqual(
      parseGmpClick({ position: { lat: () => 29.58, lng: () => -98.45 } }),
      [29.58, -98.45],
    );
    assert.deepEqual(parseGmpClick({ latLng: { lat: 29.58, lng: -98.45 } }), [29.58, -98.45]);
    assert.equal(parseGmpClick({}), null);
  });

  it("keeps the house pin and drops Google click pins", () => {
    const house = { dataset: { ffPin: "1" } } as unknown as Element;
    const click = { dataset: {} } as unknown as Element;
    const shadow = { dataset: {} } as unknown as Element;
    const root = {
      querySelectorAll: () => [house, click],
      shadowRoot: { querySelectorAll: () => [shadow] },
    };
    assert.deepEqual(extraMap3dPinElements(root), [click, shadow]);
  });
});
