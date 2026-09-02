import { createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { RedirectToEstimatorApp } from "@/lib/auth/redirect-estimator";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimator")({
  component: EstimatorPage,
  head: () => ({
    meta: [{ title: `Estimator | ${SITE.legalName}`, robots: "noindex" }],
  }),
});

function EstimatorPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;

  return <RedirectToEstimatorApp />;
}
