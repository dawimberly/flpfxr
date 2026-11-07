import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";
import { formatEstimateRange, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { DEFAULT_PUBLIC_RANGE, liveEstimateGaps } from "../../scripts/verify-public-estimator-live.mjs";

const oldDisclaimer = "Preliminary estimate only — not a quote. Final prices set after onsite inspection.";

describe("public estimate live contract", () => {
  it("shows the established combined range and shared disclaimer", () => {
    const result = publicEstimateResult(DEFAULT_PROJECT_INPUTS);
    assert.ok(result);
    assert.equal(formatEstimateRange(result), DEFAULT_PUBLIC_RANGE);
    assert.equal(result.low, 12000);
    assert.equal(result.high, 15000);
    assert.equal(result.leadMessage.includes(PRELIMINARY_ESTIMATE_WORDING), true);
    assert.equal(result.leadMessage.includes(`Preliminary estimate: ${DEFAULT_PUBLIC_RANGE}.`), true);
    assert.match(result.leadMessage, /between \$/);
    assert.equal(result.leadMessage.includes(oldDisclaimer), false);
  });

  it("accepts the restored range page and rejects a single-total-only stale page", () => {
    const current = [
      "Plan your next project.",
      PRELIMINARY_ESTIMATE_WORDING,
      DEFAULT_PUBLIC_RANGE,
      "Request an on-site estimate",
    ].join(" ");
    assert.deepEqual(liveEstimateGaps(current), []);
    const stale = [
      "Plan your next project.",
      PRELIMINARY_ESTIMATE_WORDING,
      "$12,000",
      "Request an on-site estimate",
    ].join(" ");
    assert.deepEqual(liveEstimateGaps(stale), ["default range " + DEFAULT_PUBLIC_RANGE, "published range"]);
  });
});
