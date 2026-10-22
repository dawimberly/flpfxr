import { createFileRoute } from "@tanstack/react-router";
import { RoofTracerApp } from "@/components/roof-tracer-app";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimator/roof")({
  component: RoofTracerPage,
  head: () => ({
    meta: [{ title: `Roof trace | ${SITE.legalName}` }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function RoofTracerPage() {
  return <RoofTracerApp />;
}
