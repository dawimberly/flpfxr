import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/insurance-claims")({
  beforeLoad: () => {
    throw redirect({ to: "/services", statusCode: 301 });
  },
});
