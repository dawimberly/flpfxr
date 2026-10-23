import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CallLink, CallNumber } from "@/components/call-link";
import { TextLink } from "@/components/text-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { captureAdClickIds } from "@/lib/formsubmit";
import {
  LEAD_API_PATH,
  claimAcceptedLeadConversion,
  isValidSubmissionId,
  parseLeadApiResponse,
  shouldTrackAcceptedLead,
} from "@/lib/lead-delivery";
import { trackContactFormSubmit, trackFormStart } from "@/lib/google-ads";
import {
  CONTACT_AFFILIATIONS,
  DISCOUNT_ACCEPTED,
  JOB_DISCOUNT,
  SITE,
  loadLeadDraft,
  saveLeadDraft,
  type ServiceId,
} from "@/lib/site";

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function LeadForm({
  sent = false,
  nextPath = "/contact",
  service: initialService = "",
  source = "contact",
  messagePlaceholder,
  compact = false,
  showAffiliation = !compact,
  showPhoto = !compact,
  showEmail = !compact,
  children,
}: {
  sent?: boolean;
  nextPath?: string;
  service?: string;
  source?: string;
  messagePlaceholder: string;
  compact?: boolean;
  showAffiliation?: boolean;
  showPhoto?: boolean;
  showEmail?: boolean;
  children?: ReactNode;
}) {
  const [selectedService, setSelectedService] = useState(initialService);
  const showJobType = source === "contact" || source === "homepage";
  const service = showJobType ? selectedService : initialService;

  useEffect(() => {
    setSelectedService(initialService);
  }, [initialService]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [done, setDone] = useState(sent);
  const [phoneError, setPhoneError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adIds, setAdIds] = useState<Record<string, string>>({});
  const sending = useRef(false);
  const trackedThisSubmit = useRef(false);
  const submissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const draft = loadLeadDraft();
    setName(draft.name ?? "");
    setEmail(draft.email ?? "");
    setPhone(draft.phone ?? "");
    setAffiliation(draft.affiliation ?? "");
    setMessage(draft.message ?? "");
    if (draft.submissionId && isValidSubmissionId(draft.submissionId)) {
      submissionIdRef.current = draft.submissionId;
    }
    setAdIds(captureAdClickIds());
  }, [nextPath]);

  // ?sent=1 restores the thank-you UI after a reload. It is not a new lead.
  useEffect(() => {
    if (sent) setDone(true);
  }, [sent]);

  const subject = `The Flip Fixer - ${service || "job"} (${source})`;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Add a 10-digit phone so we can call you back.");
      return;
    }
    setPhoneError("");
    setSubmitError("");

    if (honeypot) {
      setBlocked(true);
      return;
    }

    if (sending.current) return;
    sending.current = true;
    trackedThisSubmit.current = false;
    setSubmitting(true);

    if (!submissionIdRef.current) {
      submissionIdRef.current = newSubmissionId();
    }

    saveLeadDraft({
      name,
      email,
      phone,
      service: (service as ServiceId) || "",
      affiliation,
      message,
      submissionId: submissionIdRef.current,
    });

    const data = new FormData(form);
    data.set("submissionId", submissionIdRef.current);
    data.set("_subject", subject);
    data.set("Job", service || "n/a");
    data.set("Affiliation", affiliation || "n/a");
    data.set("Source", source);
    data.set("Phone_digits", digits);
    for (const [key, value] of Object.entries(adIds)) {
      if (value) data.set(key, value);
    }

    try {
      const res = await fetch(LEAD_API_PATH, {
        method: "POST",
        body: data,
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const parsed = parseLeadApiResponse(res.status, body);
      if (parsed.ok && parsed.discarded) {
        setBlocked(true);
        return;
      }
      if (shouldTrackAcceptedLead(parsed)) {
        const trackedId = parsed.submissionId || submissionIdRef.current || "";
        if (
          !trackedThisSubmit.current &&
          claimAcceptedLeadConversion(trackedId)
        ) {
          trackedThisSubmit.current = true;
          trackContactFormSubmit({ name, email, phone });
        }
        setDone(true);
        submissionIdRef.current = null;
        saveLeadDraft({
          name,
          email,
          phone,
          service: (service as ServiceId) || "",
          affiliation,
          message,
          submissionId: "",
        });
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("sent", "1");
          url.hash = "";
          window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        } catch {
          // ignore
        }
        return;
      }
      setSubmitError(
        parsed.ok
          ? "Could not send the form. Call or text instead."
          : parsed.message,
      );
    } catch {
      setSubmitError("Could not send the form. Call or text instead.");
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  };

  if (done || blocked) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center text-center">
        <h2 className="font-display text-3xl text-fg">Sent.</h2>
        <p className="mt-2 max-w-sm text-muted">
          We got your message. If you do not hear back today, call.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <CallLink className="text-lg font-semibold text-primary hover:text-primary-hover">
            Call <CallNumber />
          </CallLink>
          <TextLink className="text-lg font-semibold text-primary hover:text-primary-hover">
            Text {SITE.phoneDisplay}
          </TextLink>
        </div>
      </div>
    );
  }

  return (
    <form
      method="POST"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      onFocusCapture={trackFormStart}
      className={compact ? "space-y-3" : "space-y-5"}
      noValidate
    >
      <input type="hidden" name="_subject" value={subject} />
      <input type="hidden" name="Job" value={service || "n/a"} />
      <input type="hidden" name="Source" value={source} />
      <div className="hidden" aria-hidden="true">
        <Label htmlFor={`${source}-company`}>Company</Label>
        <Input
          id={`${source}-company`}
          name="_honey"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${source}-name`}>Name *</Label>
        <Input
          id={`${source}-name`}
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${source}-phone`}>Phone *</Label>
        <Input
          id={`${source}-phone`}
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          aria-invalid={phoneError ? true : undefined}
          onChange={(e) => {
            setPhone(e.target.value);
            if (phoneError) setPhoneError("");
          }}
        />
        {phoneError ? (
          <p className="text-sm text-destructive">{phoneError}</p>
        ) : null}
      </div>
      {showEmail ? (
      <div className="space-y-2">
        <Label htmlFor={`${source}-email`}>Email</Label>
        <Input
          id={`${source}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-xs text-subtle">Optional. Phone is enough.</p>
      </div>
      ) : (
        <input type="hidden" name="email" value={email} />
      )}
      {children}
      {showJobType ? (
        <div className="space-y-2">
          <Label htmlFor={`${source}-job-type`}>Job type</Label>
          <select
            id={`${source}-job-type`}
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-bg px-3 text-base text-fg shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          >
            <option value="">Select a job type (optional)</option>
            <option value="kitchen">Kitchen remodel</option>
            <option value="bathroom">Bathroom remodel</option>
            <option value="kitchen-bath">Kitchen and bathroom</option>
            <option value="flooring">Flooring</option>
            <option value="paint">Painting</option>
            <option value="make-ready">Make-ready</option>
            <option value="handyman">Repairs / handyman</option>
            <option value="outdoor">Outdoor work</option>
            <option value="roofing">Roofing</option>
            <option value="insurance-claims">Insurance rebuild</option>
            <option value="consulting">Walkthrough / other</option>
          </select>
        </div>
      ) : null}
      {showAffiliation ? (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-muted">
            {JOB_DISCOUNT} {DISCOUNT_ACCEPTED}
          </p>
          <Label htmlFor={`${source}-affiliation`}>
            Senior (65+), military, first responder, or educator
          </Label>
          <select
            id={`${source}-affiliation`}
            name="Affiliation"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-bg px-3 text-base text-fg shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          >
            {CONTACT_AFFILIATIONS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${source}-message`}>What's going on *</Label>
        <Textarea
          id={`${source}-message`}
          name="message"
          required
          rows={compact ? 3 : 5}
          className={compact ? "min-h-20" : undefined}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
        />
      </div>
      {showPhoto ? (
        <div className="space-y-2">
          <Label htmlFor={`${source}-attachment`}>Photo of the job</Label>
          <Input
            id={`${source}-attachment`}
            name="attachment"
            type="file"
            accept="image/*"
            className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg"
          />
          <p className="text-xs text-subtle">Optional. One photo up to 3 MB.</p>
        </div>
      ) : null}
      {submitError ? (
        <p className="rounded-xl bg-bg px-4 py-3 text-sm text-destructive">
          {submitError}{" "}
          <CallLink className="font-medium underline">
            Call <CallNumber />
          </CallLink>
          {" � "}
          <TextLink className="font-medium underline">
            Text {SITE.phoneDisplay}
          </TextLink>
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        {submitting ? "Sending." : "Send it over"}
      </Button>
      <p className="text-center text-xs text-subtle sm:text-left">
        We call or text you back.
        {" "}
        <Link to="/privacy" className="underline">How we use your information</Link>.
      </p>
    </form>
  );
}
