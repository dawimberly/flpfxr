import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/catalog-signup")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const form = await request.formData();
          const { handleCatalogSignup } = await import("@/lib/catalog-signup.server");
          return await handleCatalogSignup(form, request);
        } catch (err) {
          console.error("[catalog] handler failed", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false, code: "server_error", message: "Could not open the catalog. Call or text instead." }, { status: 500 });
        }
      },
    },
  },
});
