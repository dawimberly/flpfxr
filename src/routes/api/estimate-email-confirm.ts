import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estimate-email-confirm")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const { handleEstimateCustomerEmailConfirm } = await import("@/lib/estimate-email.server");
          return await handleEstimateCustomerEmailConfirm(request);
        } catch (err) {
          console.error("[estimate-email-confirm] failed", err instanceof Error ? err.message : "error");
          return new Response("Could not confirm the estimate email request.", {
            status: 500,
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
