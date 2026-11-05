import { readFileSync } from "node:fs";
import { AREA_PAGES } from "./areas.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePublicEstimateInput } from "./public-estimate-input.ts";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";
import { serveEmployeeAsset } from "./employee-assets.server.ts";
import { readEstimateMetadata } from "./lead-submit.server.ts";

describe("review regression boundaries", () => {
  it("redirects both legacy paths permanently and presets Kerrville to kitchen", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const source of ["/insurance-claims", "/insurance-claims/"]) assert.ok(config.redirects.some((row: {source: string; destination: string; statusCode: number}) => row.source === source && row.destination === "/services" && row.statusCode === 301));
    const area = AREA_PAGES.find(row => row.slug === "kerrville")!;
    assert.ok(area.links.some(row => row.to === "/contact" && row.service === "kitchen"));
  });
  it("accepts valid inputs without coercing or defaulting malformed input", () => {
    assert.deepEqual(validatePublicEstimateInput(DEFAULT_PROJECT_INPUTS), DEFAULT_PROJECT_INPUTS);
    for (const data of [
      null, {}, [], { ...DEFAULT_PROJECT_INPUTS, service: "roof" },
      { ...DEFAULT_PROJECT_INPUTS, prime: "true" },
      { ...DEFAULT_PROJECT_INPUTS, delivery: Infinity },
      { ...DEFAULT_PROJECT_INPUTS, specialist: -1 },
      { ...DEFAULT_PROJECT_INPUTS, cabinetBoxes: 0.5 },
      { ...DEFAULT_PROJECT_INPUTS, vanity: "unknown" },
      { ...DEFAULT_PROJECT_INPUTS, floorSqft: 1 },
      { ...DEFAULT_PROJECT_INPUTS, extra: 1 },
    ]) assert.throws(() => validatePublicEstimateInput(data), error => error instanceof Response && error.status === 400);
  });
  it("does not read or disclose employee assets without a verified session", async () => {
    let reads = 0;
    const response = await serveEmployeeAsset(new Request("https://example.com/api/employee-assets/tool.js"),
      async () => null, async () => { reads++; return "secret"; });
    assert.equal(response.status, 401);
    assert.equal(reads, 0);
    assert.match(response.headers.get("cache-control")!, /private, no-store/);
  });
  it("serves an allowed employee module only after session verification and never caches it publicly", async () => {
    const response = await serveEmployeeAsset(new Request("https://example.com/api/employee-assets/tool.js"),
      async () => ({ user: { id: "employee" } }), async name => name === "tool.js" ? "export const ready = true" : null);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "export const ready = true");
    assert.match(response.headers.get("cache-control")!, /private, no-store/);
    assert.equal(response.headers.get("vary"), "Cookie, Authorization");
    const missing = await serveEmployeeAsset(new Request("https://example.com/api/employee-assets/unknown.js"),
      async () => ({ user: { id: "employee" } }), async () => null);
    assert.equal(missing.status, 404);
  });
  it("accepts the new price field and retains legacy draft compatibility", () => {
    const form = new FormData();
    form.set("estimate_price", "$12,800");
    assert.deepEqual(readEstimateMetadata(form), { estimate_price: "$12,800" });
    form.delete("estimate_price");
    form.set("estimate_range", "$12,800");
    assert.deepEqual(readEstimateMetadata(form), { estimate_price: "$12,800" });
    form.set("estimate_range", "between $9,000 and $11,200");
    assert.deepEqual(readEstimateMetadata(form), { estimate_range: "between $9,000 and $11,200" });
  });
});
