import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pagePathFromLocation } from "./google-ads.ts";

describe("pagePathFromLocation", () => {
  it("keeps the homepage as / so ads landing sessions do not collapse into (not set)", () => {
    assert.equal(pagePathFromLocation("/"), "/");
    assert.equal(pagePathFromLocation("", ""), "/");
  });

  it("keeps contact search on the path so kitchen vs roofing landings stay split in GA", () => {
    assert.equal(
      pagePathFromLocation("/contact", "?service=kitchen&side=interior"),
      "/contact?service=kitchen&side=interior",
    );
    assert.equal(pagePathFromLocation("/contact", ""), "/contact");
  });
});
