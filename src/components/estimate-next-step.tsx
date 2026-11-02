import { useEffect, useRef, useState, type FormEvent } from "react";
import { CallLink, CallNumber } from "@/components/call-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { captureAdClickIds } from "@/lib/formsubmit";
import { buildLaborDocument } from "@/lib/labor-estimate";
import { isValidSubmissionId, parseLeadApiResponse } from "@/lib/lead-delivery";
import { trackContactFormSubmit } from "@/lib/google-ads";
import {
  DECISION_OPTIONS,
  OCCUPANCY_OPTIONS,
  TIMING_OPTIONS,
  type StoredPlanner,
} from "@/lib/planner-form";
import { PROJECT_SERVICES, type ProjectInputs } from "@/lib/public-estimate-options";
import {
  CATALOG_BROWSE_NOTE,
  DESIGNER_MATERIALS_NOTE,
  FEE_CREDIT_NOTE,
  LABOR_ONLY_NOTE,
} from "@/lib/offer-copy";
import { mountEmbeddedCheckout, publishableKey } from "@/lib/stripe-embedded-form";

const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-border bg-bg p-3 text-fg";

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeNext(url: string, kind: string): string | null {
  try {
    const parsed = new URL(url);
    if (kind === "stripe" && parsed.protocol === "https:" && parsed.hostname === "checkout.stripe.com") return parsed.toString();
    if (kind === "success" && parsed.origin === window.location.origin && parsed.pathname === "/estimate/paid") return parsed.toString();
  } catch {
    return null;
  }
  return null;
}

export function EstimateNextStep({
  feeLabel,
  cancelled,
  canBuy,
  blockedReason,
  fields,
  project,
}: {
  feeLabel: string | null;
  cancelled: boolean;
  canBuy: boolean;
  blockedReason: string | null;
  fields: Record<string, string>;
  project: ProjectInputs | null;
}) {
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<"buy" | "inquiry" | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const checkoutHost = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const submissionId = useRef<string | null>(null);
  const label = project ? PROJECT_SERVICES.find((row) => row.id === project.service)?.label : "Your project";
  const preview = project && canBuy && project.service !== "custom"
    ? buildLaborDocument({ v: 1, project, address: "", note: "", occupancy: "", timing: "", decision: "" } satisfies StoredPlanner, false)
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const choice = submitter?.value === "buy" ? "buy" : "inquiry";
    if (choice === "buy" && (!canBuy || !feeLabel)) return;
    if (choice === "buy" && !publishableKey()) {
      setError("The paid estimate is not available right now. Send a free inquiry or call.");
      return;
    }
    setError("");
    if (!submissionId.current || !isValidSubmissionId(submissionId.current)) submissionId.current = newSubmissionId();
    const data = new FormData(event.currentTarget);
    data.set("submissionId", submissionId.current);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    for (const [key, value] of Object.entries(captureAdClickIds())) if (value) data.set(key, value);
    setSubmitting(choice);
    try {
      const res = await fetch(choice === "buy" ? "/api/estimate-checkout" : "/api/estimate-inquiry", { method: "POST", body: data });
      const body = await res.json().catch(() => null);
      if (choice === "buy") {
        const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
        if (record?.ok === true && record.discarded === true) {
          setError("Could not start checkout. Call or text instead.");
          return;
        }
        if (record?.ok === true && typeof record.client_secret === "string" && record.client_secret) {
          setClientSecret(record.client_secret);
          return;
        }
        const next = safeNext(String(record?.url ?? ""), String(record?.kind ?? ""));
        if (record?.ok === true && next) {
          window.location.assign(next);
          return;
        }
        setError(typeof record?.message === "string" ? record.message : "Could not start checkout. Call or text instead.");
        return;
      }
      const parsed = parseLeadApiResponse(res.status, body);
      if (!parsed.ok || parsed.discarded) {
        setError(parsed.ok ? "Could not send the inquiry. Call or text instead." : parsed.message);
        return;
      }
      trackContactFormSubmit({ name, email, phone });
      setSent(true);
    } catch {
      setError(choice === "buy" ? "Could not start checkout. Call or text instead." : "Could not send the inquiry. Call or text instead.");
    } finally {
      setSubmitting(null);
    }
  };

  useEffect(() => {
    const host = checkoutHost.current;
    const key = publishableKey();
    if (!clientSecret || !host || !key) return;
    let cancel = () => {};
    let stopped = false;
    mountEmbeddedCheckout({ publishableKey: key, clientSecret, container: host }).then((unmount) => {
      if (stopped) unmount();
      else cancel = unmount;
    }).catch(() => {
      if (!stopped) setError("The paid estimate is not available right now. Send a free inquiry or call.");
    });
    return () => {
      stopped = true;
      cancel();
    };
  }, [clientSecret]);

  if (sent) {
    return (
      <section className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] md:p-8" data-testid="estimate-inquiry-sent">
        <h2 className="font-display text-3xl text-fg">Sent.</h2>
        <p className="mt-2 text-muted">We saved your inquiry and will call you back. A confirmation email is on its way if our mail is up. Nothing is owed for this inquiry.</p>
        <CallLink className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary">Call <CallNumber /></CallLink>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] md:p-8" data-testid="estimate-next">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step {step + 1} of 4</p>
      <h2 className="mt-2 font-display text-2xl text-fg">
        {step === 0 ? "Your job estimate, or a free call" : step === 1 ? "A few details" : step === 2 ? "How do we reach you?" : "Choose one"}
      </h2>
      {cancelled ? <p className="mt-2 text-sm text-fg">Checkout closed before payment. The planning range is still free.</p> : null}
      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
          <div className={step === 0 ? "space-y-3 text-sm leading-relaxed text-muted" : "hidden"}>
            <p>The range above stays free. For {feeLabel ?? "$35"} you can buy an itemized job estimate for the whole job, on that same range. Or send a free inquiry and we call you back.</p>
            <ul className="list-disc space-y-1 pl-5 text-fg">
              <li>{LABOR_ONLY_NOTE}</li>
              <li>Other sizes and an on-site timeline are in the PDF.</li>
              <li>{DESIGNER_MATERIALS_NOTE}</li>
              <li>{CATALOG_BROWSE_NOTE}</li>
              <li>{FEE_CREDIT_NOTE}</li>
            </ul>
            <SampleEstimate feeLabel={feeLabel} />
            <button type="button" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="next-company">Company</label>
            <input id="next-company" name="_honey" tabIndex={-1} autoComplete="off" />
          </div>
          <div className={step === 1 ? "space-y-4" : "hidden"}>
              <p className="text-sm text-muted">{label}. These answers show up in the estimate and in the note we keep.</p>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-address">Property address
                <input id="next-address" name="address" autoComplete="street-address" className={fieldClass} />
              </label>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-occupancy">Who is in the home
                <select id="next-occupancy" name="occupancy" className={fieldClass} defaultValue="">
                  <option value="">Skip for now</option>
                  {OCCUPANCY_OPTIONS.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-timing">When do you want to start
                <select id="next-timing" name="timing" className={fieldClass} defaultValue="">
                  <option value="">Skip for now</option>
                  {TIMING_OPTIONS.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-decision">Who decides
                <select id="next-decision" name="decision" className={fieldClass} defaultValue="">
                  <option value="">Skip for now</option>
                  {DECISION_OPTIONS.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-note">Anything we should know
                <Textarea id="next-note" name="note" rows={3} className="mt-2 min-h-24" placeholder="Access, pets, what is not working." />
              </label>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-photo">Photo of the space
                <input id="next-photo" name="attachment" type="file" accept="image/*" className={`${fieldClass} h-auto py-3`} />
              </label>
              <p className="text-xs text-subtle">Optional. One photo up to 3 MB. It goes to the person who calls you.</p>
          </div>
          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <div className="space-y-2">
              <Label htmlFor="next-name">Name *</Label>
              <Input id="next-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-phone">Phone *</Label>
              <Input id="next-phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-email">Email *</Label>
              <Input id="next-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11" />
            </div>
          </div>
          <div hidden={step !== 3} className={step === 3 ? "space-y-4" : "hidden"}>
              <p className="text-sm text-muted">{LABOR_ONLY_NOTE} {FEE_CREDIT_NOTE}</p>
              {preview && preview.kind === "itemized" ? (
                <div className="rounded-xl border border-border bg-bg p-3 text-sm text-fg">
                  <p className="font-semibold">{preview.projectLabel} · {preview.size}</p>
                  <p className="mt-1 text-muted">{preview.timeline}</p>
                  <ul className="mt-2 space-y-1">
                    {preview.lines.slice(0, 6).map((line) => (
                      <li key={line.label}>{line.label}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-muted">The itemized job estimate is in the PDF, after payment. This preview is the scope, not the price.</p>
                </div>
              ) : (
                <p className="text-sm text-fg">For a project outside the planner, the PDF explains the walkthrough. The designer measures it and writes the job estimate. No guessed total.</p>
              )}
              {blockedReason ? <p className="text-sm text-fg">{blockedReason} You can still send a free inquiry.</p> : null}
              {clientSecret ? (
                <div>
                  <p className="text-sm text-muted">Pay {feeLabel} here. When it clears, we email the estimate and bring you back to this site.</p>
                  <div ref={checkoutHost} id="estimate-checkout-form" className="mt-3 min-h-48 rounded-xl bg-bg p-2" />
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  name="choice"
                  value="buy"
                  disabled={!canBuy || !feeLabel || submitting !== null || Boolean(clientSecret)}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-3 text-center font-semibold text-primary-fg disabled:opacity-60"
                >
                  {submitting === "buy" ? "Starting checkout…" : `Buy the itemized estimate${feeLabel ? ` — ${feeLabel}` : ""}`}
                </button>
                <button
                  type="submit"
                  name="choice"
                  value="inquiry"
                  disabled={submitting !== null}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary/70 px-4 py-3 text-center font-semibold text-primary disabled:opacity-60"
                >
                  {submitting === "inquiry" ? "Sending…" : "Send a free inquiry"}
                </button>
              </div>
              <p className="text-xs text-subtle">Free inquiry: we save the project, email you a confirmation, and call you back. Paid estimate: Stripe checkout, then the PDF arrives by email. {CATALOG_BROWSE_NOTE}</p>
          </div>
          {error ? (
            <p className="text-sm text-destructive">
              {error}{" "}
              <CallLink className="font-medium underline">Call <CallNumber /></CallLink>
            </p>
          ) : null}
          <div className={step === 0 ? "hidden" : "flex gap-3"}>
            <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-semibold text-fg" onClick={() => setStep((value) => Math.max(0, value - 1))}>
              Back
            </button>
            {step > 0 && step < 3 ? (
              <button
                type="button"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
                onClick={() => {
                  if (step === 2 && (name.trim().length < 2 || phone.replace(/\D/g, "").length < 10 || !email.includes("@"))) {
                    setError("Add your name, a 10-digit phone, and an email.");
                    return;
                  }
                  setError("");
                  setStep((value) => value + 1);
                }}
              >
                Continue
              </button>
            ) : null}
          </div>
        </form>
    </section>
  );
}

function SampleEstimate({ feeLabel }: { feeLabel: string | null }) {
  const price = feeLabel ?? "$35";
  return (
    <div data-testid="sample-estimate" className="flex gap-4 rounded-xl border border-border bg-bg p-3">
      <a
        href="/sample-estimate.pdf"
        target="_blank"
        rel="noreferrer"
        className="relative block shrink-0"
        aria-label="Open the sample estimate PDF"
      >
        <img
          src="/sample-estimate.png"
          alt="First page of a sample Flip Fixer job estimate"
          className="h-40 w-auto rounded-md border border-border bg-white"
        />
        <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-fg">
          SAMPLE
        </span>
      </a>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">See a sample estimate</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          For {price} you get an itemized job estimate like this: what is included, what is not, and the estimated total for the whole job.
        </p>
      </div>
    </div>
  );
}
