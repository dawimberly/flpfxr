import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PageIntro } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
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

  return (
    <div>
      <PageIntro eyebrow="Employees" title="Estimator">
        <p>Signed in as {user.primaryEmail ?? user.displayName ?? "Employee"}.</p>
      </PageIntro>

      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-20 text-center">
        <p className="text-muted">
          The full room-by-room estimator is being moved here from the separate
          app. For now this page confirms your login works.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link to="/">Back to website</Link>
          </Button>
          <UserButton />
        </div>
      </div>
    </div>
  );
}
