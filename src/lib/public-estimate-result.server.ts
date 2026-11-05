import { projectEstimateLeadMessage, projectPlanningEstimate } from "./public-pricing.ts";
import { type ProjectInputs } from "./public-estimate-options.ts";
import { formatPublicEstimate, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";

export function publicEstimateResult(input: ProjectInputs) {
  const estimate = projectPlanningEstimate(input);
  if (!estimate) return null;
  const price = Math.round(estimate.total / 100) * 100;
  return {
    total: price,
    leadMessage: `${projectEstimateLeadMessage(input).split("Preliminary estimate:")[0]}Preliminary estimate: ${formatPublicEstimate(price)}. ${PRELIMINARY_ESTIMATE_WORDING}`,
  };
}
