import { createServerFn } from "@tanstack/react-start";
import { validatePublicEstimateInput } from "./public-estimate-input";

export const loadPublicEstimate = createServerFn({ method: "POST" })
  .validator(validatePublicEstimateInput)
  .handler(async ({ data }) => {
    // Costs and calculations stay on the server. Only the combined range is returned.
    const { publicEstimateResult } = await import("./public-estimate-result.server.ts");
    return publicEstimateResult(data);
  });
