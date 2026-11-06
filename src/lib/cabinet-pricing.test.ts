import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../data/northville.json" with { type: "json" };
import { CABINET_FINISHES, cabinetTier, resolveCabinetFinish } from "./cabinets.ts";
import { cabinetCatalog, quoteCabinets } from "./cabinet-pricing.server.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";

test("owner finish rules return one installed price for standard and oversized units", () => {
  for (const finish of CABINET_FINISHES) {
    const standard = catalog.items.find(item => item.sku === "B30")!;
    const oversized = catalog.items.find(item => item.oversized && Object.hasOwn(item.prices, finish.id))!;
    const multiplier = finish.id === "ve" ? 0.75 : 0.80;
    const expected = (item: typeof standard, install: number) =>
      Math.round((item.prices as Record<string, number>)[finish.id] * 100 * multiplier) + install * 100;
    const quote = quoteCabinets(finish.id, [
      { sku: standard.sku, quantity: 2 },
      { sku: oversized.sku, quantity: 1 },
    ]);
    assert.deepEqual(quote, { total: (2 * expected(standard, 75) + expected(oversized, 125)) / 100, warnings: [] });
    assert.equal(cabinetTier(finish.id).label, finish.id === "ve" ? "Builder Grade" : "Premium");
  }
});

test("Essential, Prime, and closet selections use the Premium multiplier", () => {
  for (const [finish, sku, expected] of [
    ["ess", "B30", 468.12],
    ["prime", "B30", 537],
    ["cl", "CB3024", 381.40],
  ] as const) {
    assert.deepEqual(quoteCabinets(finish, [{ sku, quantity: 1 }]), {
      total: expected,
      warnings: [],
    }, finish);
  }
});

test("catalog metadata omits pricing and removed finishes, and invalid picks never return partial totals", () => {
  const visible = cabinetCatalog();
  assert.doesNotMatch(JSON.stringify(visible), /MSRP|laborPer|prices|multiplier|honey/i);
  assert.equal(resolveCabinetFinish("honey", "kitchen"), "ew");
  assert.equal(quoteCabinets("honey", [{ sku: "B30", quantity: 1 }]).total, null);
  assert.equal(quoteCabinets("ew", [{ sku: "B30", quantity: 1 }, { sku: "unknown", quantity: 1 }]).total, null);
});

test("the public estimator returns only its combined price and handoff message", () => {
  const premium = publicEstimateResult({ ...DEFAULT_PROJECT_INPUTS, cabinetFinish: "ew" })!;
  const builder = publicEstimateResult({ ...DEFAULT_PROJECT_INPUTS, cabinetFinish: "ve" })!;
  assert.deepEqual(Object.keys(builder).sort(), ["leadMessage", "total"]);
  assert.equal(builder.total, 12900);
  assert.ok(builder.total < premium.total);
  assert.match(builder.leadMessage, /Value Espresso/);
});
