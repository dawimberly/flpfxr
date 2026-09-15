import { createFileRoute } from "@tanstack/react-router";
import { EstimatorApp } from "@/components/estimator-app";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimator/")({
  component: EstimatorIndexPage,
  head: () => ({
    meta: [{ title: `Estimator | ${SITE.legalName}`, robots: "noindex" }],
  }),
});

function EstimatorIndexPage() {
  return (
    <div className="estimator-shell min-h-dvh bg-bg">
      <EstimatorApp />
    </div>
  );
}
