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
  leadSaved?: boolean;
  staffNotified?: boolean;
};

function newSubmissionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000";
}

/** Download personalized PDF + request shop follow-up (no customer email). */
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
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [acceptedTotal, setAcceptedTotal] = useState<number | null>(null);
  const [staffNotified, setStaffNotified] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => newSubmissionId());
  const [unavailableMessage, setUnavailableMessage] = useState(
    "Estimate download and follow-up are temporarily unavailable. Call or text — we still want the job.",
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState("checking");
    setAvailabilityFailed(false);
    const fail = () => {
      if (!active) return;
      setAvailabilityFailed(true);
      setUnavailableMessage("Could not check PDF availability. Please try again.");
      setState("unavailable");
    };
    const timeout = setTimeout(() => {
      fail();
      active = false;
      controller.abort();
    }, 10_000);
    (async () => {
      try {
        const response = await fetch("/api/estimate-email", { method: "GET", signal: controller.signal });
        if (!response.ok) throw new Error("Availability check failed");
        const body = (await response.json()) as ApiResult;
        if (!active) return;
        if (body.available === true) {
          setState("idle");
        } else if (body.available === false) {
          setUnavailableMessage(
            body.message
              || "Estimate download and follow-up are temporarily unavailable. Call or text — we still want the job.",
          );
          setState("unavailable");
        } else {
          fail();
        }
      } catch {
        fail();
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [availabilityAttempt]);

  const open = () => {
    if (disabled || state !== "idle") return;
    setState("open");
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || state === "submitting") return;
    setState("submitting");
    setError(null);
    const form = new FormData();
    form.set("submissionId", submissionId);
    form.set("name", name);
    form.set("email", email);
    form.set("phone", phone);
    form.set("zip", zip);
    form.set("selections", JSON.stringify(selections));
    form.set("displayedTotal", String(displayedTotal));
    form.set("plannerPath", plannerPath);
    form.set("company", "");
    try {
      const response = await fetch("/api/estimate-email", { method: "POST", body: form });
      const body = (await response.json()) as ApiResult;
      if (body.state === "unavailable" || body.available === false || response.status === 503) {
        if (body.leadSaved && body.downloadToken) {
          setState("accepted");
          setAcceptedTotal(typeof body.total === "number" ? body.total : displayedTotal);
          setStaffNotified(Boolean(body.staffNotified));
          setStatusMessage(body.message ?? null);
          setDownloadHref(`/api/estimate-pdf/${encodeURIComponent(body.downloadToken)}`);
          return;
        }
        setState("unavailable");
        setUnavailableMessage(body.message || unavailableMessage);
        return;
      }
      if (!body.ok && body.state !== "duplicate" && body.state !== "accepted") {
        setState("failed");
        setError(body.message ?? "Could not save your request. Try again or call.");
        if (body.state !== "rate_limited" && body.state !== "conflict") {
          setSubmissionId(newSubmissionId());
        }
        return;
      }
      setState("accepted");
      setAcceptedTotal(typeof body.total === "number" ? body.total : displayedTotal);
      setStaffNotified(Boolean(body.staffNotified));
      setStatusMessage(body.message ?? null);
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

  if (state === "accepted") {
    return (
      <div
        className="w-full rounded-lg border border-border bg-bg p-3 text-sm text-fg"
        data-testid="email-my-estimate-accepted"
        role="status"
      >
        <p className="font-semibold">Request saved</p>
        <p className="mt-1 text-muted">
          {statusMessage
            || (staffNotified
              ? "The Flip Fixer was notified to follow up."
              : "Your details were saved. Shop email notification is still pending.")}
        </p>
        <p className="mt-1 text-muted">
          Combined preliminary total: {formatPublicEstimate(acceptedTotal ?? displayedTotal)}.
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
        ) : (
          <p className="mt-3 text-sm text-muted">PDF download is not available for this request. Call or text.</p>
        )}
        <p className="mt-2 text-xs text-muted">
          This is your personalized preliminary estimate — not the example sample PDF below. No estimate email was sent to you.
        </p>
      </div>
    );
  }

  const formVisible = state === "open" || state === "submitting" || state === "failed";
  return (
    <div className="mt-3 w-full scroll-mb-28" data-testid="estimate-pdf-action">
      <button
        type="button"
        data-testid="email-my-estimate-open"
        disabled={disabled || state !== "idle"}
        aria-busy={state === "checking"}
        aria-describedby={`${formId}-availability`}
        aria-controls={formVisible ? formId : undefined}
        aria-expanded={formVisible}
        onClick={open}
        className="inline-flex min-h-12 w-full scroll-mb-28 items-center justify-center rounded-lg border-2 border-primary bg-surface px-5 py-3 font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        Download estimate PDF
      </button>
      <div id={`${formId}-availability`} role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-sm text-muted">
        {state === "checking" ? <span data-testid="email-my-estimate-checking">Checking PDF availability…</span> : null}
        {state === "unavailable" ? <div data-testid="email-my-estimate-unavailable">
          <p className="font-semibold text-fg">{availabilityFailed ? "PDF availability check failed" : "Estimate download unavailable"}</p>
          <p>{unavailableMessage}</p>
          <p className="mt-1 text-xs">Your on-screen preliminary estimate is unchanged.</p>
        </div> : null}
        {state === "idle" || formVisible ? <p>Downloading requires your contact details and requests follow-up from The Flip Fixer. No estimate email is sent to you.</p> : null}
      </div>
      {state === "unavailable" ? <button type="button" onClick={() => setAvailabilityAttempt(value => value + 1)} className="mt-2 min-h-11 rounded-md px-2 font-semibold text-primary underline" data-testid="estimate-pdf-retry">Retry PDF availability</button> : null}
      {formVisible ? <form
      id={formId}
      onSubmit={onSubmit}
      className="w-full rounded-lg border border-border bg-bg p-3"
      data-testid="email-my-estimate-form"
      noValidate
    >
      <p className="text-sm font-semibold text-fg">Download estimate &amp; request follow-up</p>
      <p className="mt-1 text-sm text-muted">
        Download your preliminary estimate and send your project details to The Flip Fixer so we can contact you about your project.{" "}
        <Link to="/privacy" className="underline">How we use your information</Link>.
      </p>
      <div className="mt-3 grid gap-3">
        <label className="text-sm font-semibold text-fg" htmlFor={`${formId}-name`}>
          Name <span className="font-normal text-muted">(optional)</span>
          <input
            id={`${formId}-name`}
            name="name"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface p-3 text-fg"
          />
        </label>
        <label className="text-sm font-semibold text-fg" htmlFor={`${formId}-email`}>
          Email <span className="font-normal text-muted">(email or phone required)</span>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface p-3 text-fg"
          />
        </label>
        <label className="text-sm font-semibold text-fg" htmlFor={`${formId}-phone`}>
          Phone <span className="font-normal text-muted">(email or phone required)</span>
          <input
            id={`${formId}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface p-3 text-fg"
          />
        </label>
        <label className="text-sm font-semibold text-fg" htmlFor={`${formId}-zip`}>
          Project ZIP code
          <input
            id={`${formId}-zip`}
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            required
            maxLength={10}
            value={zip}
            onChange={e => setZip(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface p-3 text-fg"
            data-testid="email-my-estimate-zip"
          />
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
        disabled={disabled || state === "submitting"}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg disabled:opacity-60"
        data-testid="email-my-estimate-submit"
      >
        {state === "submitting" ? "Saving…" : "Download estimate & request follow-up"}
      </button>
      {state === "failed" ? (
        <p className="mt-2 text-xs text-muted">Your project selections are still on this page for another try.</p>
      ) : null}
    </form> : null}
    </div>
  );
}
