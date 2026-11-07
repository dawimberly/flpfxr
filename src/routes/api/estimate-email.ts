import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estimate-email")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { handleEstimateEmailAvailability } = await import("@/lib/estimate-email.server");
          return await handleEstimateEmailAvailability();
        } catch (err) {
          console.error("[estimate-email] availability failed", err instanceof Error ? err.message : "error");
          return Response.json({
            ok: false,
            state: "unavailable",
            available: false,
            message: "Emailing a personalized estimate PDF is not available right now. Call or text instead.",
          }, { status: 503 });
        }
      },
      POST: async ({ request }: { request: Request }) => {
        try {
          const { handleEstimateEmailRequest } = await import("@/lib/estimate-email.server");
          return await handleEstimateEmailRequest(request);
        } catch (err) {
          console.error("[estimate-email] handler failed", err instanceof Error ? err.message : "error");
          return Response.json({
            ok: false,
            state: "server_error",
            message: "Could not process the estimate request. Call or text instead.",
          }, { status: 500 });
        }
      },
    },
  },
});
