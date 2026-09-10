import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { QuoteEstimator, type QuoteSelection } from "@/components/quote-estimator";
import { PageIntro } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackContactFormSubmit } from "@/lib/google-ads";
import {
  ESTIMATE_TYPES,
  ROOM_SCOPE_LABELS,
  SCOPE_LABELS,
  SERVICE_AREAS,
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
        content:
          "Call The Flip Fixer for a free estimate. (210) 436-9117 · Jon@TheFlipFixer.com. Alamo Heights, The Dominion, Kerrville, Boerne, and San Antonio.",
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

  const estimateService = ESTIMATE_TYPES.some((t) => t.id === serviceFromUrl)
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

  const kitchenBath = (quote?.service || service) === "kitchen-bath";
  const kitchenLabel = kitchenBath ? ROOM_SCOPE_LABELS[quote?.kitchen ?? kitchen] : "";
  const bathroomLabel = kitchenBath ? ROOM_SCOPE_LABELS[quote?.bathroom ?? bathroom] : "";
  const sizeLabel = kitchenBath
    ? ""
    : quote
      ? SCOPE_LABELS[quote.scope]
      : "";
  const ballpark =
    quote?.range ? formatUsdRange(quote.range[0], quote.range[1]) : "";
  const quoteLine = kitchenBath
    ? [kitchenLabel !== "Skip" ? `Kitchen: ${kitchenLabel}` : null, bathroomLabel !== "Skip" ? `Bathroom: ${bathroomLabel}` : null]
        .filter(Boolean)
        .join(" · ")
    : [serviceLabel, sizeLabel].filter(Boolean).join(" · ");

  const quoteBlock = [
    "Ballpark from the website:",
    serviceLabel ? `Job: ${serviceLabel}` : null,
    kitchenBath && kitchenLabel ? `Kitchen size: ${kitchenLabel}` : null,
    kitchenBath && bathroomLabel ? `Bathroom size: ${bathroomLabel}` : null,
    !kitchenBath && sizeLabel ? `Size: ${sizeLabel}` : null,
    ballpark ? `Planning range: ${ballpark}` : null,
    quote?.includes ? quote.includes : null,
  ]
    .filter(Boolean)
    .join("\n");

  const subjectLine = kitchenBath
    ? `Flip Fixer — ${[
        kitchenLabel && kitchenLabel !== "Skip" ? `Kitchen ${kitchenLabel}` : null,
        bathroomLabel && bathroomLabel !== "Skip" ? `Bath ${bathroomLabel}` : null,
      ]
        .filter(Boolean)
        .join(", ")}${ballpark ? ` (${ballpark})` : ""}`
    : `Flip Fixer — ${serviceLabel || "job"}${sizeLabel ? `, ${sizeLabel}` : ""}${ballpark ? ` (${ballpark})` : ""}`;

  const onQuoteChange = (next: QuoteSelection) => {
    setQuote(next);
    if (next.service) setService(next.service);
    setKitchen(next.kitchen);
    setBathroom(next.bathroom);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const setField = (name: string, value: string) => {
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (el) el.value = value;
    };

    setField("_subject", subjectLine);
    setField("Job", serviceLabel || "n/a");
    setField("Kitchen_size", kitchenBath ? kitchenLabel || "None" : "n/a");
    setField("Bathroom_size", kitchenBath ? bathroomLabel || "None" : "n/a");
    setField("Planning_range", ballpark || "n/a");
    if (!kitchenBath) setField("Size", sizeLabel || serviceLabel || "n/a");

    const body = message.trim();
    setField("message", body ? `${body}\n\n${quoteBlock}` : quoteBlock);

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
        <p>{SITE.phoneDisplay}. Or send pictures of the job.</p>
      </PageIntro>

      <section className="mx-auto max-w-6xl space-y-8 px-4 pb-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <QuoteEstimator
            initialService={estimateService}
            hideCta
            onServiceChange={(id) => setService(id)}
            onQuoteChange={onQuoteChange}
          />

          <div className="rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)]">
          {sent ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <CheckCircle2 className="size-12 text-primary" />
              <h2 className="mt-4 font-display text-2xl text-fg">Sent.</h2>
              <p className="mt-2 max-w-sm text-sm text-muted">
                It went to {SITE.email}. We'll get back to you.
              </p>
              <div className="mt-6">
                <Button asChild variant="outline">
                  <CallLink>Call {SITE.phoneDisplay}</CallLink>
                </Button>
              </div>
            </div>
          ) : (
            <form
              action={`https://formsubmit.co/${encodeURIComponent(SITE.email)}`}
              method="POST"
              onSubmit={onSubmit}
              className="space-y-5"
            >
              <h2 className="font-display text-2xl text-fg">
                Tell us about the job
              </h2>
              <input type="hidden" name="_subject" value={subjectLine} />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value={nextUrl} />
              <input type="hidden" name="Job" value={serviceLabel || "n/a"} />
              <input type="hidden" name="Kitchen_size" value={kitchenBath ? kitchenLabel || "None" : "n/a"} />
              <input type="hidden" name="Bathroom_size" value={kitchenBath ? bathroomLabel || "None" : "n/a"} />
              <input type="hidden" name="Planning_range" value={ballpark || "n/a"} />
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
              <div className="space-y-2">
                <Label htmlFor="service">What kind of job</Label>
                <select
                  id="service"
                  name="service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select one</option>
                  {ESTIMATE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                  <option value="other">Something else</option>
                </select>
              </div>
              {quoteLine || ballpark ? (
                <p className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">
                  <span className="font-medium text-fg">{quoteLine || serviceLabel}</span>
                  {ballpark ? <span className="mt-1 block tabular-nums">Ballpark {ballpark}</span> : null}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="message">What's going on *</Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Neighborhood, what needs doing, when you need it done."
                />
              </div>
              <Button type="submit" size="lg" className="w-full">
                Send it over
              </Button>
              <p className="text-center text-xs text-subtle">
                Goes to {SITE.email}. We'll get back to you.
              </p>
            </form>
          )}
          </div>
        </div>

        <aside className="mx-auto w-full max-w-md rounded-2xl bg-surface px-6 py-6 text-center shadow-[var(--shadow-border)] lg:max-w-none lg:px-10 lg:py-5">
          <h2 className="font-display text-2xl text-fg lg:text-xl">
            Call or write
          </h2>
          <ul className="mt-4 space-y-4 lg:mt-3 lg:flex lg:flex-row lg:flex-wrap lg:items-start lg:justify-center lg:gap-x-12 lg:gap-y-3 lg:space-y-0 lg:text-left">
            <li className="flex flex-col items-center gap-1 lg:flex-row lg:items-start lg:gap-3">
              <Phone className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-fg">Phone</p>
                <CallLink className="text-muted hover:text-primary">
                  {SITE.phoneDisplay}
                </CallLink>
              </div>
            </li>
            <li className="flex flex-col items-center gap-1 lg:flex-row lg:items-start lg:gap-3">
              <Mail className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-fg">Email</p>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-muted hover:text-primary"
                >
                  {SITE.email}
                </a>
              </div>
            </li>
            <li className="flex flex-col items-center gap-1 lg:flex-row lg:items-start lg:gap-3 lg:max-w-xl">
              <MapPin className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-fg">Service area</p>
                <p className="text-muted">{SERVICE_AREAS.join(" · ")}</p>
              </div>
            </li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
