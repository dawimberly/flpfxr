import { SampleEstimate } from "@/components/sample-estimate";
import { useRef, useState, type FormEvent } from "react";
import { CallLink, CallNumber } from "@/components/call-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { captureAdClickIds } from "@/lib/formsubmit";
import { buildLaborDocument } from "@/lib/labor-estimate";
import { isValidSubmissionId, leadEmailProblem, parseLeadApiResponse } from "@/lib/lead-delivery";
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
} from "@/lib/offer-copy";
import { paidEstimateEnabled } from "@/lib/paid-estimate-flag";

const paidEstimateOn = paidEstimateEnabled(import.meta.env.VITE_PAID_ESTIMATE_ENABLED);

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const submissionId = useRef<string | null>(null);
  const sending = useRef(false);
  const label = project ? PROJECT_SERVICES.find((row) => row.id === project.service)?.label : "Your project";
  const preview = project && canBuy && project.service !== "custom"
    ? buildLaborDocument({ v: 1, project, address: "", note: "", occupancy: "", timing: "", decision: "" } satisfies StoredPlanner, false)
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3 || sent || sending.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const choice = submitter?.value === "buy" ? "buy" : "inquiry";
    if (choice === "buy" && (!paidEstimateOn || !canBuy || !feeLabel)) return;
    setError("");
    if (!submissionId.current || !isValidSubmissionId(submissionId.current)) submissionId.current = newSubmissionId();
    const data = new FormData(event.currentTarget);
    data.set("submissionId", submissionId.current);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    for (const [key, value] of Object.entries(captureAdClickIds())) if (value) data.set(key, value);
    sending.current = true;
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
      trackContactFormSubmit({ name, email, phone }, parsed.submissionId || submissionId.current);
      setSent(true);
    } catch {
      setError(choice === "buy" ? "Could not start checkout. Call or text instead." : "Could not send the inquiry. Call or text instead.");
    } finally {
      sending.current = false;
      setSubmitting(null);
    }
  };

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
        {step === 0
          ? (paidEstimateOn ? "Your job estimate, or a free call" : "Get your free estimate")
          : step === 1 ? "A few details" : step === 2 ? "How do we reach you?" : (paidEstimateOn ? "Choose one" : "Get your free estimate")}
      </h2>
      {paidEstimateOn && cancelled ? <p className="mt-2 text-sm text-fg">Checkout closed before payment. You can still use the online planner.</p> : null}
      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
          <div className={step === 0 ? "space-y-3 text-sm leading-relaxed text-muted" : "hidden"}>
            {paidEstimateOn ? (
              <>
                <p>You can view the combined preliminary total above. For {feeLabel ?? "$35"} you can buy a detailed job estimate, or send an inquiry and we’ll call you back.</p>
                <ul className="list-disc space-y-1 pl-5 text-fg">
                  <li>Other sizes and an on-site timeline are in the PDF.</li>
                  <li>{DESIGNER_MATERIALS_NOTE}</li>
                  <li>{CATALOG_BROWSE_NOTE}</li>
                  <li>{FEE_CREDIT_NOTE}</li>
                </ul>
              </>
            ) : (
              <p>Tell us how to reach you and we’ll call you back about your project.</p>
            )}
            <SampleEstimate />
            <button type="button" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg" onClick={() => setStep(1)}>
              {paidEstimateOn ? "Continue" : "Get your free estimate"}
            </button>
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="next-company">Company</label>
            <input id="next-company" name="_honey" tabIndex={-1} autoComplete="off" />
          </div>
          <div className={step === 1 ? "space-y-4" : "hidden"}>
              <p className="text-sm text-muted">{label}. These answers show up in the estimate and in the note we keep.</p>
              <label className="block text-sm font-semibold text-fg" htmlFor="next-address">Address or ZIP (optional)
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
              <Input id="next-name" name="name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-phone">Phone *</Label>
              <Input id="next-phone" name="phone" type="tel" required autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-email">Email *</Label>
              <Input id="next-email" name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11" />
            </div>
          </div>
          <div hidden={step !== 3} className={step === 3 ? "space-y-4" : "hidden"}>
              {paidEstimateOn ? <p className="text-sm text-muted">The detailed estimate covers the whole job. {FEE_CREDIT_NOTE}</p> : (
                <p className="text-sm text-muted">We will save the project you built above and call you back.</p>
              )}
              {preview && preview.kind === "itemized" ? (
                <div className="rounded-xl border border-border bg-bg p-3 text-sm text-fg">
                  <p className="font-semibold">{preview.projectLabel} · {preview.size}</p>
                  <p className="mt-1 text-muted">{preview.timeline}</p>
                  <ul className="mt-2 space-y-1">
                    {preview.lines.slice(0, 6).map((line) => (
                      <li key={line.label}>{line.label}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-muted">{paidEstimateOn ? "The itemized job estimate is in the PDF, after payment. This preview is the scope, not the price." : "This is the scope we will talk through with you."}</p>
                </div>
              ) : (
                <p className="text-sm text-fg">For a project outside the planner, the PDF explains the walkthrough. The designer measures it and writes the job estimate. No guessed total.</p>
              )}
              {blockedReason ? <p className="text-sm text-fg">{blockedReason} You can still send an inquiry.</p> : null}
              {paidEstimateOn ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="submit"
                    name="choice"
                    value="buy"
                    disabled={!canBuy || !feeLabel || submitting !== null}
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
                    {submitting === "inquiry" ? "Sending…" : "Send an inquiry"}
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  name="choice"
                  value="inquiry"
                  disabled={submitting !== null}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-center font-semibold text-primary-fg disabled:opacity-60"
                >
                  {submitting === "inquiry" ? "Sending…" : "Get your free estimate"}
                </button>
              )}
              <p className="text-xs text-subtle">
                {paidEstimateOn
                  ? `Free inquiry: we save the project, email you a confirmation, and call you back. Paid estimate: Stripe checkout, then the PDF arrives by email. ${CATALOG_BROWSE_NOTE}`
                  : "We save this project, email you a confirmation, and call you back."}
              </p>
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
                  if (step === 2) {
                    if (name.trim().length < 2) {
                      setError("Add your name so we know who to call back.");
                      return;
                    }
                    if (phone.replace(/\D/g, "").length < 10) {
                      setError("Add a 10-digit phone so we can call you back.");
                      return;
                    }
                    const emailProblem = leadEmailProblem(email);
                    if (emailProblem) {
                      setError(emailProblem);
                      return;
                    }
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
