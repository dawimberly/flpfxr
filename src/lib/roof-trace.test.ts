import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeFacets, feetRing } from "./roof-math.ts";
import {
  ROOF_CAP_NAILS,
  ROOF_CAULK,
  ROOF_COIL_NAILS,
  ROOF_CREW,
  ROOF_DELIVERY,
  ROOF_OAKRIDGE,
  ROOF_PENETRATION_OPTIONS,
  ROOF_SHINGLE,
  ROOF_SOLAR_HARDWARE,
  ROOF_SOLAR_PANEL,
  ROOF_STARTER,
  ROOF_TEAROFF,
  ROOF_VENT_PAINT,
  iceAndWaterRolls,
  iceAndWaterSf,
  mergeRoofPenetrations,
  roofWorkOrderMaterials,
  roofingSelectionsFromSummary,
} from "./roof-line-items.ts";
import { actUnitCost } from "./line-act.ts";
import catalogJson from "../data/catalog.json" with { type: "json" };

describe("roof-trace", () => {
  it("writes squares, drip, and ridge cap from a classified gable", () => {
    const summary = summarizeFacets([
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
    ]);
    const items = roofingSelectionsFromSummary(summary);
    const names = items.map((item) => item.name);
    assert.ok(names.includes("Owens Corning Oakridge"));
    assert.ok(names.includes("3-tab composition shingles \u2014 25 yr"));
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
    const shingles = items.find((item) => item.name === "Owens Corning Oakridge");
    assert.equal(shingles?.quantity, summary.squares_with_waste);
    assert.equal(shingles?.act, "plus");
    assert.equal(
      items.find((item) => item.name === "Synthetic underlayment")?.name,
      "Synthetic underlayment",
    );
    const felt = items.find((item) => item.name === "Synthetic underlayment");
    assert.equal(felt?.quantity, Math.round(summary.total_squares * 100) / 100);
    if (summary.waste_factor_pct > 0) {
      assert.notEqual(felt?.quantity, summary.squares_with_waste);
    }
    const rake = items.find((item) => item.name === "Drip edge");
    assert.equal(rake?.act, "rr");
    assert.ok(
      (items.find((item) => item.name === "Coil nails \u2014 1 1/4 in (20 SQ/box)")?.quantity ??
        0) >= 1,
    );
    assert.ok(
      (items.find((item) => item.name === "Plastic cap nails \u2014 1 in (20 SQ/box)")?.quantity ??
        0) >= 1,
    );
    assert.ok((items.find((item) => item.name === "Roofing caulk \u2014 NP1")?.quantity ?? 0) >= 1);
  });

  it("keeps laminated tear-off when the existing roof is laminated", () => {
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
    const items = roofingSelectionsFromSummary(summary, { existingShingle: "laminated" });
    assert.ok(items.some((item) => item.name === ROOF_TEAROFF));
    assert.ok(items.some((item) => item.name === ROOF_SHINGLE));
    assert.equal(
      items.some((item) => item.name === "Owens Corning Oakridge"),
      false,
    );
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
    assert.equal(
      items.find((item) => item.name === "High roof charge — 2 stories or greater")?.quantity,
      25,
    );
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

  it("puts 3 ft ice and water on valley LF only", () => {
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
    const withValleys = { ...summary, valleys_ft: 40 };
    const items = roofingSelectionsFromSummary(withValleys);
    assert.equal(items.find((item) => item.name === "Valley metal")?.quantity, 40);
    assert.equal(items.find((item) => item.name === "Ice & water barrier")?.quantity, 120);
    assert.equal(items.find((item) => item.name === "Ice & water barrier")?.act, "plus");
    const wo = roofWorkOrderMaterials(items, 10000);
    assert.equal(wo?.iceSf, 120);
    assert.equal(wo?.iceRolls, 1);
    assert.equal(iceAndWaterSf(40), 120);
    assert.equal(iceAndWaterSf(75), 225);
    assert.equal(iceAndWaterRolls(225), 1);
    assert.equal(iceAndWaterRolls(226), 2);
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
      catalogJson as {
        roofing: {
          options: Array<{ name: string; cost_per_unit: number; remove_cost_per_unit?: number }>;
        };
      }
    ).roofing.options;
    const panel = options.find((row) => row.name === ROOF_SOLAR_PANEL);
    assert.ok(panel);
    assert.equal(panel?.remove_cost_per_unit, 0);
    assert.equal(actUnitCost(panel!, "rr"), panel!.cost_per_unit);
  });

  it("orders felt rolls and price per SQ from WO rules", () => {
    const wo = roofWorkOrderMaterials(
      [
        { name: ROOF_TEAROFF, quantity: 35.78 },
        { name: ROOF_SHINGLE, quantity: 39 },
        { name: "Synthetic underlayment", quantity: 35.78 },
      ],
      16776,
    );
    assert.equal(wo?.underlaymentSquares, 35.78);
    assert.equal(wo?.underlaymentRolls, 4);
    assert.equal(wo?.pricePerSq, 430.15);
  });

  it("sends Home Depot reroof lines including Oakridge, fasteners, and crew", () => {
    const summary = summarizeFacets(
      [
        {
          id: "a",
          pitch: "4/12",
          slopeDeg: null,
          latlngs: feetRing([
            [0, 0],
            [67, 0],
            [67, 33.66],
            [0, 33.66],
          ]),
        },
      ],
      12,
    );
    const items = roofingSelectionsFromSummary(summary, { existingShingle: "3-tab" });
    const names = items.map((item) => item.name);
    assert.ok(names.includes(ROOF_OAKRIDGE));
    assert.ok(names.includes("Synthetic underlayment"));
    assert.ok(names.includes(ROOF_STARTER));
    assert.ok(names.includes("Hip / ridge cap \u2014 composition"));
    assert.ok(names.includes("Drip edge"));
    assert.ok(names.includes(ROOF_COIL_NAILS));
    assert.ok(names.includes(ROOF_CAP_NAILS));
    assert.ok(names.includes(ROOF_CAULK));
    assert.ok(names.includes(ROOF_DELIVERY));
    assert.ok(names.includes(ROOF_CREW));
  });
});
