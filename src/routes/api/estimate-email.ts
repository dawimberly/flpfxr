import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estimate-email")({
  server: {
    handlers: {
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
