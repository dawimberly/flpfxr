import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";

export const Route = createFileRoute("/estimator")({
  component: EstimatorLayout,
});

function EstimatorLayout() {
  const { user, isPending } = useCurrentUserState();

  if (authEnabled) {
    if (isPending) return null;
    if (!user) return <RedirectToSignIn />;
  }

  return <Outlet />;
}
