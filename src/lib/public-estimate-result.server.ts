import { projectEstimateLeadMessage, projectPlanningEstimate } from "./public-pricing.ts";
import { type ProjectInputs } from "./public-estimate-options.ts";
import { formatPublicEstimate, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";

export function publicEstimateResult(input: ProjectInputs) {
  const estimate = projectPlanningEstimate(input);
  if (!estimate) return null;
  return {
    total: estimate.low,
    leadMessage: `${projectEstimateLeadMessage(input).split("Preliminary estimate:")[0]}Preliminary estimate: ${formatPublicEstimate(estimate.low)}. ${PRELIMINARY_ESTIMATE_WORDING}`,
  };
}
