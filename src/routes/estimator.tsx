import { createFileRoute } from "@tanstack/react-router";
import { EstimatorApp } from "@/components/estimator-app";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimator")({
  component: EstimatorPage,
  head: () => ({
    meta: [{ title: `Estimator | ${SITE.legalName}`, robots: "noindex" }],
  }),
});

function EstimatorPage() {
  const { user, isPending } = useCurrentUserState();

  if (authEnabled) {
    if (isPending) return null;
    if (!user) return <RedirectToSignIn />;
  }

  return (
    <div className="estimator-shell min-h-dvh bg-bg">
      <EstimatorApp />
    </div>
  );
}
