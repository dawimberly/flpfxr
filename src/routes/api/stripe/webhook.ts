import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { handleStripeWebhook } = await import("@/lib/estimate-next.server");
          return await handleStripeWebhook(request);
        } catch (err) {
          console.error("[stripe] webhook failed", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
