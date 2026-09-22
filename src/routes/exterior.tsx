import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/exterior")({
  beforeLoad: () => {
    throw redirect({ to: "/roof" });
  },
  component: () => null,
});
