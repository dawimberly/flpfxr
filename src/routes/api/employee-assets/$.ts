import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/employee-assets/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { employeeAssetResponse } = await import("@/lib/employee-assets.server");
        return employeeAssetResponse(request);
      },
    },
  },
});
