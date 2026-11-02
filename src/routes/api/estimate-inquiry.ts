import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estimate-inquiry")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const form = await request.formData();
          const { handleFreeInquiry } = await import("@/lib/estimate-next.server");
          return await handleFreeInquiry(form, request);
        } catch (err) {
          console.error("[inquiry] handler failed", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false, code: "server_error", message: "Could not send the inquiry. Call or text instead." }, { status: 500 });
        }
      },
    },
  },
});
