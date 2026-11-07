import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { ProjectInputs } from "@/lib/public-estimate-options";
import { formatPublicEstimate } from "@/lib/public-estimate-display";

type DeliveryState =
  | "checking"
  | "unavailable"
  | "idle"
  | "open"
  | "submitting"
  | "accepted"
  | "failed";

type ApiResult = {
  ok: boolean;
  state?: string;
  message?: string;
  submissionId?: string;
  downloadToken?: string;
  downloadExpiresAt?: string;
  total?: number;
  available?: boolean;
};

function newSubmissionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000";
}

export function EmailMyEstimate({
  selections,
  displayedTotal,
  plannerPath,
  disabled,
}: {
  selections: ProjectInputs;
  displayedTotal: number;
  plannerPath: string;
  disabled?: boolean;
}) {
  const formId = useId();
  const [state, setState] = useState<DeliveryState>("checking");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [acceptedTotal, setAcceptedTotal] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState(() => newSubmissionId());
  const [unavailableMessage, setUnavailableMessage] = useState(
    "Emailing a personalized estimate PDF is not available right now. Call or text — we still want the job.",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/estimate-email", { method: "GET" });
        const body = (await response.json()) as ApiResult;
        if (cancelled) return;
        if (body.available === true) {
          setState("idle");
        } else {
          setUnavailableMessage(
            body.message
              || "Emailing a personalized estimate PDF is not available right now. Call or text — we still want the job.",
          );
          setState("unavailable");
        }
      } catch {
        if (cancelled) return;
        setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = () => {
    if (state !== "idle") return;
    setState("open");
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setError(null);
    const form = new FormData();
    form.set("submissionId", submissionId);
    form.set("name", name);
    form.set("email", email);
    form.set("selections", JSON.stringify(selections));
    form.set("displayedTotal", String(displayedTotal));
    form.set("plannerPath", plannerPath);
    if (marketingConsent) form.set("marketingConsent", "1");
    form.set("company", ""); // honeypot stays empty for humans
    try {
      const response = await fetch("/api/estimate-email", { method: "POST", body: form });
      const body = (await response.json()) as ApiResult;
      if (body.state === "unavailable" || body.available === false || response.status === 503) {
        setState("unavailable");
        setUnavailableMessage(body.message || unavailableMessage);
        return;
      }
      if (!body.ok && body.state !== "duplicate") {
        setState("failed");
        setError(body.message ?? "Could not send the estimate. Try again or call.");
        // Keep the same submission id for conflict/rate-limit retries that must match;
        // mint a new one after validation/delivery failure so visitors can correct and retry.
        if (body.state !== "rate_limited" && body.state !== "conflict") {
          setSubmissionId(newSubmissionId());
        }
        return;
      }
      setState("accepted");
      setAcceptedTotal(typeof body.total === "number" ? body.total : displayedTotal);
      if (body.downloadToken) {
        setDownloadHref(`/api/estimate-pdf/${encodeURIComponent(body.downloadToken)}`);
      } else {
        setDownloadHref(null);
      }
    } catch {
      setState("failed");
      setError("Could not reach the server. Your selections are still here — try again.");
      setSubmissionId(newSubmissionId());
    }
  };

  if (state === "checking") {
    return (
      <p className="text-sm text-muted" data-testid="email-my-estimate-checking" role="status">
        Checking whether estimate email is available…
      </p>
    );
  }

  if (state === "unavailable") {
    return (
      <div
        className="w-full rounded-lg border border-border bg-bg p-3 text-sm text-fg"
        data-testid="email-my-estimate-unavailable"
        role="status"
      >
        <p className="font-semibold">Estimate email unavailable</p>
        <p className="mt-1 text-muted">{unavailableMessage}</p>
        <p className="mt-2 text-xs text-muted">Your on-screen preliminary estimate is unchanged.</p>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        data-testid="email-my-estimate-open"
        disabled={disabled}
        onClick={open}
        className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-bg px-5 py-2.5 font-semibold text-fg md:py-3 ${disabled ? "opacity-60" : ""}`}
      >
        Email me my estimate
      </button>
    );
  }

  if (state === "accepted") {
    return (
      <div
        className="w-full rounded-lg border border-border bg-bg p-3 text-sm text-fg"
        data-testid="email-my-estimate-accepted"
        role="status"
      >
        <p className="font-semibold">Accepted for email delivery</p>
        <p className="mt-1 text-muted">
          Provider acceptance is not proof the message reached your inbox. Combined preliminary total:{" "}
          {formatPublicEstimate(acceptedTotal ?? displayedTotal)}.
        </p>
        {downloadHref ? (
          <a
            href={downloadHref}
            rel="noreferrer"
            referrerPolicy="no-referrer"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline"
            data-testid="email-my-estimate-download"
          >
            Download your personalized estimate PDF
          </a>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          This download is your personalized preliminary estimate — not the example sample PDF below.
        </p>
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="w-full rounded-lg border border-border bg-bg p-3"
      data-testid="email-my-estimate-form"
      noValidate
    >
      <p className="text-sm font-semibold text-fg">Email me my estimate</p>
      <p className="mt-1 text-sm text-muted">
        Submitting requests this preliminary estimate PDF and permits contact about this project.
        Phone number is not required.{" "}
        <Link to="/privacy" className="underline">How we use your information</Link>.
      </p>
      <div className="mt-3 grid gap-3">
        <label className="text-sm font-semibold text-fg" htmlFor={`${formId}-name`}>
          Name
          <input
            id={`${formId}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface p-3 text-fg"
          />
        </label>
        <label className="text-sm font-semibold text-fg" htmlFor={`${formId}-email`}>
          Email
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface p-3 text-fg"
          />
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm text-fg" htmlFor={`${formId}-marketing`}>
          <input
            id={`${formId}-marketing`}
            type="checkbox"
            className="mt-0.5 size-11 shrink-0 rounded border-border"
            checked={marketingConsent}
            onChange={e => setMarketingConsent(e.target.checked)}
            data-testid="email-my-estimate-marketing"
          />
          <span>
            Optional: send me occasional project tips and offers.
            <span className="mt-1 block text-muted">Unchecked by default. Not required for your estimate PDF.</span>
          </span>
        </label>
        <div className="hidden" aria-hidden="true">
          <label htmlFor={`${formId}-company`}>Company
            <input id={`${formId}-company`} name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-fg" data-testid="email-my-estimate-error">{error}</p> : null}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg disabled:opacity-60"
        data-testid="email-my-estimate-submit"
      >
        {state === "submitting" ? "Submitting…" : "Send my estimate PDF"}
      </button>
      {state === "failed" ? (
        <p className="mt-2 text-xs text-muted">Your project selections are still on this page for another try.</p>
      ) : null}
    </form>
  );
}
