import { createServerFn } from "@tanstack/react-start";
import type { ProjectInputs } from "./public-estimate-options";

export const loadPublicEstimate = createServerFn({ method: "POST" })
  .validator((data: ProjectInputs) => data)
  .handler(async ({ data }) => {
    // Costs and calculations stay on the server. Only the combined price is returned.
    const { publicEstimateResult } = await import("./public-estimate-result.server.ts");
    return publicEstimateResult(data);
  });
