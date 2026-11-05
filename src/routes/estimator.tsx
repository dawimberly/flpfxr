import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadEmployeeAccess } from "@/lib/employee-access";
import { authEnabled } from "@/lib/auth/client";

export const Route = createFileRoute("/estimator")({
  beforeLoad: async () => { await loadEmployeeAccess(); },
  component: EstimatorLayout,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function EstimatorLayout() {
  const { user, isPending } = useCurrentUserState();

  if (authEnabled) {
    if (isPending) return null;
    // The public planner lives at /estimate. This URL stays the crew tool after sign-in.
    if (!user) return <Navigate to="/estimate" replace />;
  }

  return <Outlet />;
}
