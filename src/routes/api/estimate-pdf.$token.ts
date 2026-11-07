import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estimate-pdf/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { token: string } }) => {
        try {
          const { handleEstimatePdfDownload } = await import("@/lib/estimate-email.server");
          return await handleEstimatePdfDownload(request, params.token);
        } catch (err) {
          console.error("[estimate-pdf] download failed", err instanceof Error ? err.message : "error");
          return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});
