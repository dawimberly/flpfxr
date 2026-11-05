import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PUBLICATION_FLAGS } from "./publication-flags.ts";
import { EXTRA_NAV, NAV, SERVICES, SITE, CREW } from "./site.ts";
import { PUBLIC_PAGE_PATHS } from "./seo-config.ts";
import { DEFAULT_PROJECT_INPUTS, PROJECT_SERVICES, PROJECT_SIZES, VANITY_SIZES } from "./public-estimate-options.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { projectPlanningEstimate } from "./public-pricing.ts";

describe("publication and public pricing boundaries", () => {
  it("keeps financing and certification off and financing out of navigation and sitemap", () => {
    assert.equal(PUBLICATION_FLAGS.financingApproved, false);
    assert.equal(PUBLICATION_FLAGS.northvilleCertificationVerified, false);
    assert.ok(EXTRA_NAV.some(row => row.to === "/northville"));
    assert.ok(![...NAV, ...EXTRA_NAV].some(row => row.to === "/financing"));
    assert.ok(!PUBLIC_PAGE_PATHS.some(path => String(path) === "/financing"));
    assert.ok(PUBLIC_PAGE_PATHS.includes("/northville"));
  });
  it("returns only a single combined preliminary price and safe lead text across project sizes", () => {
    for (const service of PROJECT_SERVICES) for (const size of PROJECT_SIZES) {
      const input = { ...DEFAULT_PROJECT_INPUTS, service: service.id, size };
      const response = publicEstimateResult(input);
      if (service.id === "custom") { assert.equal(response, null); continue; }
      assert.ok(response);
      assert.deepEqual(Object.keys(response).sort(), ["leadMessage", "total"]);
      assert.equal(response.total, projectPlanningEstimate(input)!.low);
      assert.equal((response.leadMessage.match(/\$/g) ?? []).length, 1);
      assert.doesNotMatch(response.leadMessage, /crew|days|hours|MSRP|per day|allowance|between/i);
      assert.match(response.leadMessage, /Preliminary estimate only/);
    }
  });
  it("keeps list prices out of public vanity choices and restricted claims out of shared copy", () => {
    assert.ok(VANITY_SIZES.every(row => !Object.hasOwn(row, "list")));
    assert.doesNotMatch(JSON.stringify([SITE, CREW, SERVICES]), /insurance claims?|insured|guaranteed|starting at|free quote|\$\d/i);
  });
});
