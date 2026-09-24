import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CallLink } from "@/components/call-link";
import { TextLink } from "@/components/text-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FORMSUBMIT_AJAX_URL,
  FORMSUBMIT_POST_URL,
  captureAdClickIds,
  parseFormSubmitResponse,
} from "@/lib/formsubmit";
import { trackContactFormSubmit, trackFormStart } from "@/lib/google-ads";
import {
  CONTACT_AFFILIATIONS,
  JOB_DISCOUNT,
  SITE,
  loadLeadDraft,
  saveLeadDraft,
  type ServiceId,
} from "@/lib/site";

export function LeadForm({
  sent = false,
  nextPath = "/contact",
  service = "",
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
  const [nextUrl, setNextUrl] = useState(`${SITE.url}${nextPath}?sent=1`);
  const [adIds, setAdIds] = useState<Record<string, string>>({});

  useEffect(() => {
    const draft = loadLeadDraft();
    setName(draft.name ?? "");
    setEmail(draft.email ?? "");
    setPhone(draft.phone ?? "");
    setAffiliation(draft.affiliation ?? "");
    setMessage(draft.message ?? "");
    setNextUrl(`${window.location.origin}${nextPath}?sent=1`);
    setAdIds(captureAdClickIds());
  }, [nextPath]);

  useEffect(() => {
    if (sent) setDone(true);
  }, [sent]);

  useEffect(() => {
    if (done) trackContactFormSubmit();
  }, [done]);

  const subject = `The Flip Fixer — ${service || "job"} (${source})`;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      e.preventDefault();
      setPhoneError("Add a 10-digit phone so we can call you back.");
      return;
    }
    setPhoneError("");
    setSubmitError("");

    if (honeypot) {
      e.preventDefault();
      setBlocked(true);
      return;
    }

    saveLeadDraft({
      name,
      email,
      phone,
      service: (service as ServiceId) || "",
      affiliation,
      message,
    });

    e.preventDefault();
    setSubmitting(true);

    const data = new FormData(form);
    data.set("_subject", subject);
    data.set("Job", service || "n/a");
    data.set("Affiliation", affiliation || "n/a");
    data.set("Source", source);
    data.set("Phone_digits", digits);
    for (const [key, value] of Object.entries(adIds)) {
      if (value) data.set(key, value);
    }

    try {
      const res = await fetch(FORMSUBMIT_AJAX_URL, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const parsed = parseFormSubmitResponse(res.status, body);
      if (parsed.ok) {
        setDone(true);
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
      if (parsed.needsConfirm) {
        setSubmitError(parsed.message);
        return;
      }
      form.submit();
    } catch {
      form.submit();
    } finally {
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
            Call {SITE.phoneDisplay}
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
      action={FORMSUBMIT_POST_URL}
      method="POST"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      onFocusCapture={trackFormStart}
      className={compact ? "space-y-3" : "space-y-5"}
    >
      <input type="hidden" name="_subject" value={subject} />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_next" value={nextUrl} />
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
      {showAffiliation ? (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-muted">{JOB_DISCOUNT}</p>
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
          <p className="text-xs text-subtle">Optional. One photo is enough.</p>
        </div>
      ) : null}
      {submitError ? (
        <p className="rounded-xl bg-bg px-4 py-3 text-sm text-destructive">
          {submitError}{" "}
          <CallLink className="font-medium underline">
            Call {SITE.phoneDisplay}
          </CallLink>
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        {submitting ? "Sending…" : "Send it over"}
      </Button>
      <p className="text-center text-xs text-subtle sm:text-left">
        We call or text you back.
      </p>
    </form>
  );
}
