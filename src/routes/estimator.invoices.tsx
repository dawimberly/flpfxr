import { createFileRoute } from "@tanstack/react-router";
import { InvoiceDraftTool } from "@/components/invoice-draft-tool";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimator/invoices")({
  component: InvoiceDraftPage,
  head: () => ({
    meta: [
      { title: `Draft invoice | ${SITE.legalName}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function InvoiceDraftPage() {
  return (
    <div className="estimator-shell min-h-dvh bg-bg">
      <InvoiceDraftTool />
    </div>
  );
}
