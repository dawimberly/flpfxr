import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CallLink } from "@/components/call-link";
import { QuoteEstimator, type QuoteSelection } from "@/components/quote-estimator";
import { PageIntro } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackContactFormSubmit } from "@/lib/google-ads";
import {
  AREA_LINE,
  ESTIMATE_TYPES,
  SCOPE_LABELS,
  SITE,
  loadLeadDraft,
  saveLeadDraft,
  type RoomScope,
  type ServiceId,
} from "@/lib/site";
import { formatUsdRange } from "@/lib/utils";

type Search = {
  service?: ServiceId;
  sent?: boolean;
};

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const service =
      typeof search.service === "string"
        ? (search.service as ServiceId)
        : undefined;
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { service, sent: true } : { service };
  },
  head: () => ({
    meta: [
      { title: `Contact | ${SITE.legalName}` },
      {
        name: "description",
        content: `Call ${SITE.name} at ${SITE.phoneDisplay}. ${AREA_LINE}`,
      },
    ],
  }),
});

function ContactPage() {
  const { service: serviceFromUrl, sent: sentFromUrl } = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState<string>("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [nextUrl, setNextUrl] = useState(`${SITE.url}/contact?sent=1`);
  const [kitchen, setKitchen] = useState<RoomScope>("medium");
  const [bathroom, setBathroom] = useState<RoomScope>("none");
  const [quote, setQuote] = useState<QuoteSelection | null>(null);

  const estimateService =
    serviceFromUrl === "kitchen-bath"
      ? "kitchen"
      : ESTIMATE_TYPES.some((t) => t.id === serviceFromUrl)
        ? serviceFromUrl
        : undefined;

  useEffect(() => {
    const draft = loadLeadDraft();
    setName(draft.name ?? "");
    setEmail(draft.email ?? "");
    setPhone(draft.phone ?? "");
    setService(serviceFromUrl || draft.service || "");
    setMessage(draft.message ?? "");
    setNextUrl(`${window.location.origin}/contact?sent=1`);
  }, [serviceFromUrl]);

  useEffect(() => {
    if (sentFromUrl) trackContactFormSubmit();
  }, [sentFromUrl]);

  const serviceLabel =
    ESTIMATE_TYPES.find((t) => t.id === service)?.label || service;

  const sizeLabel = quote ? SCOPE_LABELS[quote.scope] : "";
  const kitchenLabel =
    (quote?.service || service) === "kitchen" ? sizeLabel : "n/a";
  const bathroomLabel =
    (quote?.service || service) === "bathroom" ? sizeLabel : "n/a";
  const ballpark =
    quote?.range ? formatUsdRange(quote.range[0], quote.range[1]) : "";

  const quoteBlock = [
    "Ballpark from the website:",
    serviceLabel ? `Job: ${serviceLabel}` : null,
    sizeLabel ? `Size: ${sizeLabel}` : null,
    kitchenLabel !== "n/a" ? `Kitchen size: ${kitchenLabel}` : null,
    bathroomLabel !== "n/a" ? `Bathroom size: ${bathroomLabel}` : null,
    ballpark ? `Planning range: ${ballpark}` : null,
    quote?.includes ? quote.includes : null,
  ]
    .filter(Boolean)
    .join("\n");

  const subjectLine = `The Flip Fixer — ${serviceLabel || "job"}${sizeLabel ? `, ${sizeLabel}` : ""}${ballpark ? ` (${ballpark})` : ""}`;

  const onQuoteChange = (next: QuoteSelection) => {
    setQuote(next);
    if (next.service) setService(next.service);
    setKitchen(next.kitchen);
    setBathroom(next.bathroom);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const setField = (field: string, value: string) => {
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${field}"]`,
      );
      if (el) el.value = value;
    };

    setField("_subject", subjectLine);
    setField("Job", serviceLabel || "n/a");
    setField("Kitchen_size", kitchenLabel);
    setField("Bathroom_size", bathroomLabel);
    setField("Planning_range", ballpark || "n/a");
    setField("Size", sizeLabel || serviceLabel || "n/a");

    const body = message.trim();
    setField("message", quote?.range && body ? `${body}\n\n${quoteBlock}` : body || quoteBlock);

    saveLeadDraft({
      name,
      email,
      phone,
      service: (service as ServiceId) || "",
      kitchenScope: kitchen,
      bathroomScope: bathroom,
      scope: quote?.scope ?? "",
      message,
    });
    if (honeypot) {
      e.preventDefault();
      setBlocked(true);
    }
  };

  const sent = sentFromUrl || blocked;

  return (
    <div>
      <PageIntro eyebrow="Contact" title="Tell us about the job.">
        <p>Call or send photos of the job.</p>
      </PageIntro>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 md:grid-cols-5">
        <aside className="space-y-6 md:col-span-2">
          <CallLink className="block font-display text-4xl text-primary hover:text-primary-hover md:text-5xl">
            {SITE.phoneDisplay}
          </CallLink>
          <a
            href={`mailto:${SITE.email}`}
            className="block text-muted hover:text-primary"
          >
            {SITE.email}
          </a>
          <p className="text-muted">{AREA_LINE}</p>
          <p className="text-sm leading-relaxed text-subtle">
            Military, CASA, or a group home?{" "}
            <Link to="/community" className="font-medium text-primary">
              Use the Community form
            </Link>{" "}
            so those notes are labeled.
          </p>
        </aside>

        <div className="rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] md:col-span-3">
          {sent ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <h2 className="font-display text-3xl text-fg">Sent.</h2>
              <p className="mt-2 max-w-sm text-muted">
                We got your message and will get back to you.
              </p>
              <CallLink className="mt-6 text-primary hover:text-primary-hover">
                Call {SITE.phoneDisplay}
              </CallLink>
            </div>
          ) : (
            <form
              action={`https://formsubmit.co/${encodeURIComponent(SITE.email)}`}
              method="POST"
              onSubmit={onSubmit}
              className="space-y-5"
            >
              <input type="hidden" name="_subject" value={subjectLine} />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value={nextUrl} />
              <input type="hidden" name="Job" value={serviceLabel || "n/a"} />
              <input type="hidden" name="Kitchen_size" value={kitchenLabel} />
              <input type="hidden" name="Bathroom_size" value={bathroomLabel} />
              <input type="hidden" name="Planning_range" value={ballpark || "n/a"} />
              <input type="hidden" name="Size" value={sizeLabel || "n/a"} />
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
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {ballpark ? (
                <p className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">
                  <span className="font-medium text-fg">
                    {serviceLabel}
                    {sizeLabel ? ` · ${sizeLabel}` : ""}
                  </span>
                  <span className="mt-1 block tabular-nums">Ballpark {ballpark}</span>
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="message">What's going on *</Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Neighborhood, the room, when you want to start."
                />
              </div>
              <Button type="submit" size="lg">
                Send it over
              </Button>
              <p className="text-center text-xs text-subtle">
                We reply by phone or email after you send.
              </p>
            </form>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <QuoteEstimator
          initialService={estimateService}
          hideCta
          onServiceChange={(id) => setService(id)}
          onQuoteChange={onQuoteChange}
        />
      </section>
    </div>
  );
}
