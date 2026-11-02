import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estimate-checkout")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const form = await request.formData();
          const { handleEstimateCheckout } = await import("@/lib/estimate-next.server");
          return await handleEstimateCheckout(form, request);
        } catch (err) {
          console.error("[checkout] handler failed", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false, code: "server_error", message: "Could not start checkout. Call or text instead." }, { status: 500 });
        }
      },
    },
  },
});
