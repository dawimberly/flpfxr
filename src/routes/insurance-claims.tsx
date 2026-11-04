import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/insurance-claims")({
  beforeLoad: () => { throw notFound(); },
});
