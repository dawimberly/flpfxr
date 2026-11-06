import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public-estimate")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { handlePublicEstimateOptions } = await import("@/lib/public-estimate-api.server");
        return handlePublicEstimateOptions();
      },
      POST: async ({ request }: { request: Request }) => {
        try {
          const { handlePublicEstimatePost } = await import("@/lib/public-estimate-api.server");
          return await handlePublicEstimatePost(request);
        } catch (err) {
          console.error("[public-estimate] handler failed", err instanceof Error ? err.message : "error");
          return Response.json(
            { ok: false, error: "server_error", message: "Could not prepare a preliminary estimate." },
            {
              status: 500,
              headers: {
                "access-control-allow-origin": "*",
                "access-control-allow-methods": "POST, OPTIONS",
                "access-control-allow-headers": "content-type, accept",
              },
            },
          );
        }
      },
    },
  },
});
