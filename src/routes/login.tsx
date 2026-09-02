import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { RedirectToEstimatorApp } from "@/lib/auth/redirect-estimator";
import { SignedIn } from "@/lib/auth/gates";
import { PageIntro } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ESTIMATOR_APP_URL, SITE } from "@/lib/site";
import { goToEstimatorApp } from "@/lib/auth/go-to-estimator";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: `Employee login | ${SITE.legalName}` }],
  }),
});

function LoginPage() {
  if (!authEnabled) {
    return <RedirectToEstimatorApp />;
  }

  return (
    <>
      <SignedIn>
        <RedirectToEstimatorApp />
      </SignedIn>
      <LoginForm />
    </>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/estimator",
    });

    if (signInError) {
      setPending(false);
      setError(signInError.message ?? "Sign-in failed. Check email and password.");
      return;
    }

    setRedirecting(true);
    goToEstimatorApp();
  }

  if (redirecting) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 pb-32 text-center sm:pb-20">
        <p className="text-muted">You're signed in. Opening the estimator…</p>
        <Button asChild size="lg" className="mt-6 w-full">
          <a href={ESTIMATOR_APP_URL}>Open estimator</a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageIntro eyebrow="Employees" title="Sign in">
        <p>For Flip Fixer crew only.</p>
      </PageIntro>

      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-md space-y-5 px-4 pb-32 sm:pb-20"
      >
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-11 w-11 text-subtle hover:text-fg"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
