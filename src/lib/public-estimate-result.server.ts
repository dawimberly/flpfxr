import { projectEstimateLeadMessage, projectPlanningEstimate } from "./public-pricing.ts";
import { type ProjectInputs } from "./public-estimate-options.ts";
import { formatEstimateRange, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";

export function publicEstimateResult(input: ProjectInputs) {
  const estimate = projectPlanningEstimate(input);
  if (!estimate) return null;
  // low/high already rounded in finalize(); total is the combined low for handoff compatibility.
  const low = estimate.low;
  const high = estimate.high;
  const range = formatEstimateRange({ low, high });
  return {
    total: low,
    low,
    high,
    leadMessage: `${projectEstimateLeadMessage(input).split("Preliminary estimate:")[0]}Preliminary estimate: ${range}. ${PRELIMINARY_ESTIMATE_WORDING}`,
  };
}
