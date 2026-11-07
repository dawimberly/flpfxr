import { publicPageMeta } from "@/lib/public-page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { CallLink, CallNumber } from "@/components/call-link";
import { loadPaidEstimate } from "@/lib/estimate-offer";
import { CATALOG_BROWSE_NOTE, DESIGNER_MATERIALS_NOTE, FEE_CREDIT_NOTE } from "@/lib/offer-copy";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimate/paid")({
  component: PaidEstimatePage,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : "",
  }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id }),
  loader: ({ deps }) => loadPaidEstimate({ data: deps }),
  head: () => ({
    meta: publicPageMeta([
      { title: `Estimate payment | ${SITE.name}` },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Payment status for a Flip Fixer job estimate." },
    ]),
  }),
});

function PaidEstimatePage() {
  const result = Route.useLoaderData();
  const paid = result.status === "paid";
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your job estimate</p>
      <h1 className="mt-3 font-display text-4xl text-fg">{paid ? "Payment received." : "We're confirming the payment."}</h1>
      <p className="mt-4 text-muted">
        {paid
          ? "Your itemized job estimate is on its way by email. It is the whole job, on the same range you saw on the site."
          : "If Stripe sent you here, the email goes out when the payment clears."}
      </p>
      <p className="mt-3 text-sm text-muted">{FEE_CREDIT_NOTE} {DESIGNER_MATERIALS_NOTE}</p>
      {paid && result.catalogUrl ? (
        <p className="mt-4 text-sm text-fg">
          {CATALOG_BROWSE_NOTE}{" "}
          <a className="font-semibold text-primary underline" href={result.catalogUrl}>Browse the cabinet catalog</a>
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">The catalog link is in the estimate email after payment clears.</p>
      )}
      <CallLink className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary">
        Call <CallNumber />
      </CallLink>
    </div>
  );
}
