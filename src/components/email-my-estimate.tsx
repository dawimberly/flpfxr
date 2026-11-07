import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { ProjectInputs } from "@/lib/public-estimate-options";
import { formatEstimateRange } from "@/lib/public-estimate-display";

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
  low?: number;
  high?: number;
  available?: boolean;
  leadSaved?: boolean;
  staffNotified?: boolean;
  customerEmailOffered?: boolean;
  customerEmailRequested?: boolean;
  customerEmailStatus?: string;
  customerEmailed?: boolean;
};

function newSubmissionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000";
}

/** Download personalized PDF + request shop follow-up; optional customer email when offered. */
export function EmailMyEstimate({
  selections,
  displayedLow,
  displayedHigh,
  plannerPath,
  disabled,
}: {
  selections: ProjectInputs;
  displayedLow: number;
  displayedHigh: number;
  plannerPath: string;
  disabled?: boolean;
}) {
  const formId = useId();
  const [state, setState] = useState<DeliveryState>("checking");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [emailMeCopy, setEmailMeCopy] = useState(false);
  const [customerEmailOffered, setCustomerEmailOffered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [acceptedLow, setAcceptedLow] = useState<number | null>(null);
  const [acceptedHigh, setAcceptedHigh] = useState<number | null>(null);
  const [staffNotified, setStaffNotified] = useState(false);
  const [customerEmailStatus, setCustomerEmailStatus] = useState<string | null>(null);
  const [customerEmailed, setCustomerEmailed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => newSubmissionId());
  const [unavailableMessage, setUnavailableMessage] = useState(
    "Estimate download and follow-up are temporarily unavailable. Call or text — we still want the job.",
  );
  const rangeLabel = formatEstimateRange({
    low: acceptedLow ?? displayedLow,
    high: acceptedHigh ?? displayedHigh,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/estimate-email", { method: "GET" });
        const body = (await response.json()) as ApiResult;
        if (cancelled) return;
        if (body.available === true) {
          setCustomerEmailOffered(Boolean(body.customerEmailOffered));
          setState("idle");
        } else {
          setUnavailableMessage(
            body.message
              || "Estimate download and follow-up are temporarily unavailable. Call or text — we still want the job.",
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

  const applyAccepted = (body: ApiResult) => {
    setState("accepted");
    setAcceptedLow(typeof body.low === "number" ? body.low : displayedLow);
    setAcceptedHigh(typeof body.high === "number" ? body.high : displayedHigh);
    setStaffNotified(Boolean(body.staffNotified));
    setCustomerEmailStatus(body.customerEmailStatus ?? null);
    setCustomerEmailed(Boolean(body.customerEmailed));
    setStatusMessage(body.message ?? null);
    if (body.downloadToken) {
      setDownloadHref(`/api/estimate-pdf/${encodeURIComponent(body.downloadToken)}`);
    } else {
      setDownloadHref(null);
    }
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
    form.set("phone", phone);
    form.set("zip", zip);
    form.set("emailMeCopy", emailMeCopy && customerEmailOffered ? "1" : "0");
    form.set("selections", JSON.stringify(selections));
    form.set("displayedTotal", String(displayedLow));
    form.set("displayedLow", String(displayedLow));
    form.set("displayedHigh", String(displayedHigh));
    form.set("plannerPath", plannerPath);
    form.set("company", "");
    try {
      const response = await fetch("/api/estimate-email", { method: "POST", body: form });
      const body = (await response.json()) as ApiResult;
      if (body.state === "unavailable" || body.available === false || response.status === 503) {
        if (body.leadSaved && body.downloadToken) {
          applyAccepted(body);
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
      applyAccepted(body);
    } catch {
      setState("failed");
      setError("Could not reach the server. Your selections are still here — try again.");
      setSubmissionId(newSubmissionId());
    }
  };

  if (state === "checking") {
    return (
      <p className="text-sm text-muted" data-testid="email-my-estimate-checking" role="status">
        Checking whether estimate download is available…
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
        <p className="font-semibold">Estimate download unavailable</p>
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
        Download estimate &amp; request follow-up
      </button>
    );
  }

  if (state === "accepted") {
    const customerLine = customerEmailed || customerEmailStatus === "sent"
      ? "Customer email: sent after you confirmed."
      : customerEmailStatus === "confirm_sent"
        ? "Customer email: confirmation sent — check your inbox to receive the PDF copy."
        : customerEmailStatus === "failed"
          ? "Customer email: could not start. Your PDF download below still works."
          : "Customer email: not requested.";
    return (
      <div
        className="w-full rounded-lg border border-border bg-bg p-3 text-sm text-fg"
        data-testid="email-my-estimate-accepted"
        role="status"
      >
        <p className="font-semibold">Request saved</p>
        <p className="mt-1 text-muted" data-testid="email-my-estimate-staff-status">
          {staffNotified
            ? "Shop notification: The Flip Fixer was notified to follow up."
            : "Shop notification: still pending."}
        </p>
        <p className="mt-1 text-muted" data-testid="email-my-estimate-customer-status">{customerLine}</p>
        {statusMessage ? <p className="mt-1 text-muted">{statusMessage}</p> : null}
        <p className="mt-1 text-muted">
          Combined preliminary range: {rangeLabel}.
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
          This is your personalized preliminary estimate — not the example sample PDF below. No marketing subscription.
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
      <p className="text-sm font-semibold text-fg">Download estimate &amp; request follow-up</p>
      <p className="mt-1 text-sm text-muted">
        Download your preliminary estimate and send your project details to The Flip Fixer so we can contact you about your project.
        Phone-only works for download and shop follow-up.
        {customerEmailOffered
          ? " If you also want a PDF emailed to you, add your email and choose “Email me a copy” — we will ask you to confirm that address first."
          : " We do not email the PDF to you unless that option is enabled."}{" "}
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
        {customerEmailOffered ? (
          <label className="flex min-h-11 items-start gap-3 text-sm text-fg" htmlFor={`${formId}-email-copy`}>
            <input
              id={`${formId}-email-copy`}
              name="emailMeCopy"
              type="checkbox"
              checked={emailMeCopy}
              onChange={e => setEmailMeCopy(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
              data-testid="email-my-estimate-email-copy"
            />
            <span>
              <span className="font-semibold">Email me a copy</span>
              <span className="mt-1 block font-normal text-muted">
                Optional. Sends a confirmation link first, then your personalized PDF with the same saved range.
                Not a marketing subscription.
              </span>
            </span>
          </label>
        ) : null}
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
        {state === "submitting" ? "Saving…" : "Download estimate & request follow-up"}
      </button>
      {state === "failed" ? (
        <p className="mt-2 text-xs text-muted">Your project selections are still on this page for another try.</p>
      ) : null}
    </form>
  );
}
