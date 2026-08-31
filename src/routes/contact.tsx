import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { QuoteEstimator } from "@/components/quote-estimator";
import { PageIntro } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ESTIMATE_TYPES,
  SERVICE_AREAS,
  SITE,
  loadLeadDraft,
  saveLeadDraft,
  type ServiceId,
} from "@/lib/site";

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
          "Call Flip Fixer for a free estimate. (210) 436-9117 · Jon@TheFlipFixer.com. Alamo Heights, The Dominion, Kerrville, Boerne, and San Antonio.",
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

  const serviceLabel =
    ESTIMATE_TYPES.find((t) => t.id === service)?.label || service;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    saveLeadDraft({
      name,
      email,
      phone,
      service: (service as ServiceId) || "",
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

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 lg:grid-cols-2 lg:items-start">
        <QuoteEstimator
          initialService={estimateService}
          hideCta
          onServiceChange={(id) => setService(id)}
        />

        <div className="space-y-6">
          <div className="rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl text-fg">Call or write</h2>
            <ul className="mt-6 space-y-5">
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-fg">Phone</p>
                  <CallLink className="text-muted hover:text-primary">
                    {SITE.phoneDisplay}
                  </CallLink>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-5 text-primary" />
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
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-fg">Service area</p>
                  <p className="text-muted">{SERVICE_AREAS.join(" · ")}</p>
                </div>
              </li>
            </ul>
          </div>

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
              <input type="hidden" name="_subject" value="Flip Fixer job" />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value={nextUrl} />
              <input type="hidden" name="job" value={serviceLabel} />
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
      </section>
    </div>
  );
}
