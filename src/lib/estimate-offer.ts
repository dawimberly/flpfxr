import { createServerFn } from "@tanstack/react-start";

export const loadEstimateOffer = createServerFn({ method: "GET" }).handler(async () => {
  const { publicEstimateOffer } = await import("./estimate-fee.ts");
  return publicEstimateOffer();
});

export const loadPaidEstimate = createServerFn({ method: "GET" })
  .validator((data: { sessionId: string }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId.slice(0, 255) : "",
  }))
  .handler(async ({ data }) => {
    const { lookupEstimatePayment } = await import("./estimate-next.server.ts");
    return lookupEstimatePayment(data.sessionId);
  });
