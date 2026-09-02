import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { EstimatorApp } from "@/components/estimator-app";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimator")({
  component: EstimatorPage,
  head: () => ({
    meta: [
      { title: `Estimator | ${SITE.legalName}` },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#12343B" },
    ],
  }),
});

function EstimatorPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="estimator-shell">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-4 py-2 sm:px-6">
        <Link to="/" className="text-sm text-muted underline-offset-4 hover:underline">
          Website
        </Link>
        <UserButton />
      </div>
      <EstimatorApp />
    </div>
  );
}
