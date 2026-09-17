import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeFacets, feetRing } from "./roof-math.ts";
import {
  ROOF_PENETRATION_OPTIONS,
  ROOF_SHINGLE,
  ROOF_SOLAR_HARDWARE,
  ROOF_SOLAR_PANEL,
  ROOF_TEAROFF,
  ROOF_VENT_PAINT,
  mergeRoofPenetrations,
  roofingSelectionsFromSummary,
} from "./roof-line-items.ts";
import { actUnitCost } from "./line-act.ts";
import catalogJson from "../data/catalog.json" with { type: "json" };

describe("roof-trace", () => {
  it("writes squares, drip, and ridge cap from a classified gable", () => {
    const summary = summarizeFacets(
      [
        {
          id: "a",
          pitch: "4/12",
          slopeDeg: 180,
          latlngs: feetRing([
            [0, 0],
            [40, 0],
            [40, 12],
            [0, 12],
          ]),
        },
        {
          id: "b",
          pitch: "4/12",
          slopeDeg: 0,
          latlngs: feetRing([
            [0, 12],
            [40, 12],
            [40, 24],
            [0, 24],
          ]),
        },
      ],
    );
    const items = roofingSelectionsFromSummary(summary);
    const names = items.map((item) => item.name);
    assert.ok(names.includes(ROOF_SHINGLE));
    assert.ok(names.includes(ROOF_TEAROFF));
    assert.ok(names.includes("Drip edge"));
    assert.equal(
      items.some((item) => item.name === "Gutter apron"),
      false,
    );
    assert.ok(names.includes("Hip / ridge cap \u2014 composition"));
    assert.equal(
      items.some((item) => item.name === "Step flashing / roof-to-wall"),
      false,
    );
    const shingles = items.find((item) => item.name === ROOF_SHINGLE);
    assert.equal(shingles?.quantity, summary.squares_with_waste);
    assert.equal(shingles?.act, "plus");
    const rake = items.find((item) => item.name === "Drip edge");
    assert.equal(rake?.act, "rr");
  });

  it("adds starter, turtle vents, and solar from extras", () => {
    const summary = summarizeFacets(
      [
        {
          id: "a",
          pitch: "4/12",
          slopeDeg: 180,
          latlngs: feetRing([
            [0, 0],
            [40, 0],
            [40, 12],
            [0, 12],
          ]),
        },
      ],
      0,
    );
    const items = roofingSelectionsFromSummary(summary, {
      turtleVents: 8,
      solarPanels: 22,
      highRoofSquares: 25,
      penetrations: [{ name: "Exhaust cap — through roof", quantity: 2, act: "rr" }],
    });
    assert.equal(items.find((item) => item.name === "Roof vent — turtle type")?.quantity, 8);
    assert.equal(items.find((item) => item.name === "Prime & paint roof vent")?.quantity, 8);
    assert.equal(items.find((item) => item.name === "Exhaust cap — through roof")?.quantity, 2);
    assert.equal(items.find((item) => item.name === "Solar electric panel")?.quantity, 22);
    assert.equal(items.find((item) => item.name === "Solar panel mounting hardware")?.quantity, 22);
    assert.equal(items.find((item) => item.name === "High roof charge — 2 stories or greater")?.quantity, 25);
  });

  it("keeps Xact hardware qty when it differs from panel count", () => {
    const summary = summarizeFacets(
      [
        {
          id: "a",
          pitch: "4/12",
          slopeDeg: 180,
          latlngs: feetRing([
            [0, 0],
            [40, 0],
            [40, 12],
            [0, 12],
          ]),
        },
      ],
      0,
    );
    const items = roofingSelectionsFromSummary(summary, {
      penetrations: [
        { name: ROOF_SOLAR_PANEL, quantity: 22, act: "rr" },
        { name: ROOF_SOLAR_HARDWARE, quantity: 10, act: "plus" },
      ],
    });
    assert.equal(items.find((item) => item.name === ROOF_SOLAR_PANEL)?.quantity, 22);
    assert.equal(items.find((item) => item.name === ROOF_SOLAR_HARDWARE)?.quantity, 10);
    assert.equal(items.find((item) => item.name === ROOF_SOLAR_HARDWARE)?.act, "plus");
  });

  it("adds Luna-style gable cornice strip and Cruz-style return", () => {
    const summary = summarizeFacets(
      [
        {
          id: "a",
          pitch: "5/12",
          slopeDeg: 180,
          latlngs: feetRing([
            [0, 0],
            [40, 0],
            [40, 12],
            [0, 12],
          ]),
        },
      ],
      0,
    );
    const items = roofingSelectionsFromSummary(summary, {
      corniceStripLf: 24,
      corniceReturnEa: 1,
    });
    const strip = items.find((item) => item.name === "Gable cornice strip");
    const corniceReturn = items.find((item) => item.name === "Gable cornice return");
    assert.equal(strip?.quantity, 24);
    assert.equal(strip?.act, "plus");
    assert.equal(corniceReturn?.quantity, 1);
  });

  it("writes step flashing when a roof dies into a wall", () => {
    const summary = summarizeFacets(
      [
        {
          id: "shed",
          pitch: "4/12",
          slopeDeg: 180,
          latlngs: feetRing([
            [0, 0],
            [40, 0],
            [40, 12],
            [0, 12],
          ]),
        },
      ],
      0,
    );
    const items = roofingSelectionsFromSummary(summary);
    const wall = items.find((item) => item.name === "Step flashing / roof-to-wall");
    assert.ok(wall);
    assert.equal(wall?.act, "plus");
    assert.ok(Math.abs((wall?.quantity ?? 0) - 40) < 0.8);
    assert.equal(
      items.some((item) => item.name === "Hip / ridge cap \u2014 composition"),
      false,
    );
  });

  it("keeps solar and paint off the generic penetration picker", () => {
    assert.equal(ROOF_PENETRATION_OPTIONS.includes(ROOF_SOLAR_PANEL), true);
    assert.equal(ROOF_PENETRATION_OPTIONS.includes(ROOF_SOLAR_HARDWARE), false);
    assert.equal(ROOF_PENETRATION_OPTIONS.includes(ROOF_VENT_PAINT), false);
  });

  it("merges Xact extras onto hand-counted penetrations", () => {
    const merged = mergeRoofPenetrations(
      [{ name: "Chimney flashing", quantity: 1, act: "rr" }],
      [{ name: ROOF_SOLAR_PANEL, quantity: 22, act: "rr" }],
    );
    assert.equal(merged.length, 2);
    assert.ok(merged.some((row) => row.name === "Chimney flashing"));
    assert.equal(merged.find((row) => row.name === ROOF_SOLAR_PANEL)?.quantity, 22);
  });

  it("prices solar panel R&R at TXSA detach $0 plus install", () => {
    const options = (
      catalogJson as { roofing: { options: Array<{ name: string; cost_per_unit: number; remove_cost_per_unit?: number }> } }
    ).roofing.options;
    const panel = options.find((row) => row.name === ROOF_SOLAR_PANEL);
    assert.ok(panel);
    assert.equal(panel?.remove_cost_per_unit, 0);
    assert.equal(actUnitCost(panel!, "rr"), panel!.cost_per_unit);
  });
});
