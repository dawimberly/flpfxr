import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CallLink } from "@/components/call-link";
import { PageIntro } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMUNITY, SITE } from "@/lib/site";

const selectClass =
  "flex h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
  validateSearch: (search: Record<string, unknown>) => ({
    sent: search.sent === "1" || search.sent === true,
  }),
  head: () => ({
    meta: [
      { title: `Community | ${SITE.legalName}` },
      {
        name: "description",
        content: COMMUNITY.title + " " + COMMUNITY.intro,
      },
    ],
  }),
});

function CommunityPage() {
  const { sent: sentFromUrl } = Route.useSearch();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState("");
  const [funded, setFunded] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [nextUrl, setNextUrl] = useState(`${SITE.url}/community?sent=1`);

  useEffect(() => {
    setNextUrl(`${window.location.origin}/community?sent=1`);
  }, []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (honeypot) {
      e.preventDefault();
      setBlocked(true);
    }
  };

  const sent = sentFromUrl || blocked;

  return (
    <div>
      <PageIntro eyebrow="Community" title={COMMUNITY.title}>
        <p>{COMMUNITY.intro}</p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          {COMMUNITY.lanes.map((lane) => (
            <article
              key={lane.title}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <h2 className="font-display text-xl text-fg">{lane.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {lane.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl font-semibold text-fg">
          If this sounds like your house, here is the split
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {COMMUNITY.split.map((item) => (
            <article
              key={item.who}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {item.who}
              </p>
              <p className="mt-3 font-display text-xl leading-snug text-fg">
                {item.what}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 md:grid-cols-5">
        <aside className="space-y-5 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            If this fits
          </p>
          <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
            If you are ready to start, write us here
          </h2>
          <p className="text-lg leading-relaxed text-muted">
            Homes, CASA programs, donors, grant writers, and vendors. Paid jobs
            still go through{" "}
            <Link to="/contact" className="font-medium text-primary">
              Contact
            </Link>
            .
          </p>
          <CallLink className="block font-display text-3xl text-primary hover:text-primary-hover">
            {SITE.phoneDisplay}
          </CallLink>
          <a
            href={`mailto:${SITE.email}?subject=${encodeURIComponent(COMMUNITY.subject)}`}
            className="block text-muted hover:text-primary"
          >
            {SITE.email}
          </a>
        </aside>

        <div className="rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] md:col-span-3">
          {sent ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <h2 className="font-display text-3xl text-fg">Sent.</h2>
              <p className="mt-2 max-w-sm text-muted">
                We have the note and will get back to you.
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
              <input
                type="hidden"
                name="_subject"
                value={`${SITE.name} community partnership`}
              />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="hidden" name="_next" value={nextUrl} />
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
                <Label htmlFor="name">Your name *</Label>
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
                <Label htmlFor="org">Organization, home, or funder</Label>
                <Input
                  id="org"
                  name="organization"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">If you are reaching out as *</Label>
                <select
                  id="kind"
                  name="kind"
                  required
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className={selectClass}
                >
                  <option disabled value="">
                    Choose one
                  </option>
                  {COMMUNITY.kinds.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funded">If materials are in the picture</Label>
                <select
                  id="funded"
                  name="materials_funded"
                  value={funded}
                  onChange={(e) => setFunded(e.target.value)}
                  className={selectClass}
                >
                  {COMMUNITY.funded.map((item) => (
                    <option key={item.label} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">If you tell us one thing *</Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="The house, the room, the grant or gift, the timing."
                />
              </div>
              <Button type="submit" size="lg">
                Start the partnership
              </Button>
              <p className="text-center text-xs text-subtle">
                Subject line &ldquo;{COMMUNITY.subject}.&rdquo;
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
