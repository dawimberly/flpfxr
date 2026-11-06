import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";
import { formatPublicEstimate, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { DEFAULT_PUBLIC_TOTAL, liveEstimateGaps } from "../../scripts/verify-public-estimator-live.mjs";

const oldDisclaimer = "Preliminary estimate only — not a quote. Final prices set after onsite inspection.";

describe("public estimate live contract", () => {
  it("shows one rounded default total and the shared disclaimer, not a published range", () => {
    const result = publicEstimateResult(DEFAULT_PROJECT_INPUTS);
    assert.ok(result);
    assert.equal(formatPublicEstimate(result.total), DEFAULT_PUBLIC_TOTAL);
    assert.equal(result.leadMessage.includes(PRELIMINARY_ESTIMATE_WORDING), true);
    assert.equal(result.leadMessage.includes(`Preliminary estimate: ${DEFAULT_PUBLIC_TOTAL}.`), true);
    assert.doesNotMatch(result.leadMessage, /between \$/);
    assert.equal(result.leadMessage.includes(oldDisclaimer), false);
  });

  it("rejects the pre-November range page and accepts the current single-total page", () => {
    const current = [
      "Plan your next project.",
      PRELIMINARY_ESTIMATE_WORDING,
      DEFAULT_PUBLIC_TOTAL,
      "Request an on-site estimate",
    ].join(" ");
    assert.deepEqual(liveEstimateGaps(current), []);
    const stale = [
      "Plan your next project.",
      oldDisclaimer,
      "between $12,800 and $16,000",
      "Request an on-site estimate",
    ].join(" ");
    // The old range string still contains the low figure, so the range check is what rejects it.
    assert.deepEqual(liveEstimateGaps(stale), ["disclaimer", "published range"]);
  });
});
