import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/leads")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
            return Response.json(
              {
                ok: false,
                code: "validation",
                message: "Could not send the form. Call or text instead.",
              },
              { status: 415 },
            );
          }
          const form = await request.formData();
          const { handleLeadFormData } = await import("@/lib/lead-submit.server");
          return await handleLeadFormData(form, request);
        } catch (err) {
          console.error("[leads] handler failed:", err);
          return Response.json(
            {
              ok: false,
              code: "server_error",
              message: "Could not send the form. Call or text instead.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
