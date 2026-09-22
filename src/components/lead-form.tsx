import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CallLink } from "@/components/call-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackContactFormSubmit } from "@/lib/google-ads";
import {
  CONTACT_AFFILIATIONS,
  JOB_DISCOUNT,
  SITE,
  loadLeadDraft,
  saveLeadDraft,
  type ServiceId,
} from "@/lib/site";

export type LeadFormExtras = {
  job?: string;
  kitchenSize?: string;
  bathroomSize?: string;
  planningRange?: string;
  address?: string;
  size?: string;
  pitch?: string;
  quoteBlock?: string;
  subjectLine?: string;
};

export function LeadForm({
  sent,
  nextPath = "/contact",
  service = "",
  messagePlaceholder,
  extras,
  showAffiliation = true,
  children,
}: {
  sent?: boolean;
  nextPath?: string;
  service?: string;
  messagePlaceholder: string;
  extras?: LeadFormExtras;
  showAffiliation?: boolean;
  children?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [nextUrl, setNextUrl] = useState(`${SITE.url}${nextPath}?sent=1`);

  useEffect(() => {
    const draft = loadLeadDraft();
    setName(draft.name ?? "");
    setEmail(draft.email ?? "");
    setPhone(draft.phone ?? "");
    setAffiliation(draft.affiliation ?? "");
    setMessage(draft.message ?? "");
    setNextUrl(`${window.location.origin}${nextPath}?sent=1`);
    // Hydrate once so parent extras can change without wiping the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sent) trackContactFormSubmit();
  }, [sent]);

  const subject =
    extras?.subjectLine ||
    `The Flip Fixer — ${extras?.job || service || "job"}`;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      e.preventDefault();
      setPhoneError("Add a 10-digit phone so we can call you back.");
      return;
    }
    setPhoneError("");

    const form = e.currentTarget;
    const setField = (field: string, value: string) => {
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${field}"]`,
      );
      if (el) el.value = value;
    };

    const quoteBlock = extras?.quoteBlock?.trim() ?? "";
    const body = message.trim();
    setField("_subject", subject);
    setField("Job", extras?.job || service || "n/a");
    setField("Kitchen_size", extras?.kitchenSize || "n/a");
    setField("Bathroom_size", extras?.bathroomSize || "n/a");
    setField("Planning_range", extras?.planningRange || "n/a");
    setField("Address", extras?.address || "n/a");
    setField("Size", extras?.size || "n/a");
    setField("Pitch", extras?.pitch || "n/a");
    setField("Affiliation", affiliation || "n/a");
    setField(
      "message",
      quoteBlock && body ? `${body}\n\n${quoteBlock}` : body || quoteBlock,
    );

    saveLeadDraft({
      name,
      email,
      phone,
      service: (service as ServiceId) || "",
      affiliation,
      address: extras?.address,
      pitch: extras?.pitch,
      roofSize: extras?.size,
      message,
    });

    if (honeypot) {
      e.preventDefault();
      setBlocked(true);
    }
  };

  if (sent || blocked) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center text-center">
        <h2 className="font-display text-3xl text-fg">Sent.</h2>
        <p className="mt-2 max-w-sm text-muted">
          We got your message and will get back to you.
        </p>
        <CallLink className="mt-6 text-primary hover:text-primary-hover">
          Call {SITE.phoneDisplay}
        </CallLink>
      </div>
    );
  }

  return (
    <form
      action={`https://formsubmit.co/${encodeURIComponent(SITE.email)}`}
      method="POST"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="_subject" value={subject} />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_next" value={nextUrl} />
      <input type="hidden" name="Job" value={extras?.job || service || "n/a"} />
      <input type="hidden" name="Kitchen_size" value={extras?.kitchenSize || "n/a"} />
      <input type="hidden" name="Bathroom_size" value={extras?.bathroomSize || "n/a"} />
      <input type="hidden" name="Planning_range" value={extras?.planningRange || "n/a"} />
      <input type="hidden" name="Address" value={extras?.address || "n/a"} />
      <input type="hidden" name="Size" value={extras?.size || "n/a"} />
      <input type="hidden" name="Pitch" value={extras?.pitch || "n/a"} />
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="_honey"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone *</Label>
        <Input
          id="phone"
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
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {children}
      {showAffiliation ? (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-muted">{JOB_DISCOUNT}</p>
          <Label htmlFor="affiliation">
            Senior (65+), military, first responder, or educator
          </Label>
          <select
            id="affiliation"
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
      {extras?.planningRange || extras?.address || extras?.pitch || extras?.size ? (
        <p className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">
          <span className="font-medium text-fg">
            {extras.job}
            {extras.size ? ` · ${extras.size}` : ""}
            {extras.pitch ? ` · ${extras.pitch}` : ""}
          </span>
          {extras.address ? (
            <span className="mt-1 block">{extras.address}</span>
          ) : null}
          {extras.planningRange ? (
            <span className="mt-1 block tabular-nums">
              Ballpark {extras.planningRange}
            </span>
          ) : null}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="message">What's going on *</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="attachment">Photo of the job</Label>
        <Input
          id="attachment"
          name="attachment"
          type="file"
          accept="image/*"
          className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg"
        />
        <p className="text-xs text-subtle">Optional. One photo is enough.</p>
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Send it over
      </Button>
      <p className="text-center text-xs text-subtle sm:text-left">
        We reply by phone or email after you send.
      </p>
    </form>
  );
}
