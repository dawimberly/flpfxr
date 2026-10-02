import { createFileRoute, Link } from "@tanstack/react-router";
import { PencilRuler, Phone, Wrench } from "lucide-react";
import { CallTextActions } from "@/components/call-text-actions";
import { CallLink } from "@/components/call-link";
import { LeadForm } from "@/components/lead-form";
import { Photo } from "@/components/photo";
import { BestWorkBand } from "@/components/best-work-band";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FAQS,
  PROCESS,
  SITE,
  AREA_LINE,
  TESTIMONIALS,
} from "@/lib/site";

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    meta: [
      { title: `Kitchen and bath remodels | ${SITE.name}` },
      {
        name: "description",
        content:
          `Kitchen and bath remodels in San Antonio. Call or text ${SITE.phoneDisplay}. ${SITE.tagline} ${AREA_LINE}`,
      },
    ],
  }),
});

const WHY = [
  {
    icon: Wrench,
    title: "30+ years of jobsite work",
    body: "Real experience on the tools — not just managing the job from an office.",
  },
  {
    icon: PencilRuler,
    title: "Design handled in-house",
    body: "We design it with you so nothing gets lost between the plan and the crew.",
  },
  {
    icon: Phone,
    title: "Straight quotes. We answer the phone.",
    body: "Clear numbers, clear communication, and someone who picks up when you call.",
  },
];

function Home() {
  const { sent } = Route.useSearch();
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <Photo
          src="/images/gallery-01-a.webp"
          alt="Farmhouse kitchen remodel by The Flip Fixer"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/25" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-end px-4 pb-14 pt-28 md:min-h-[32rem] md:pb-20 md:pt-36">
          <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl md:text-6xl">
            Kitchen and bath remodels in San Antonio.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-fg/90 md:text-xl">
            We design it with you, one crew stays start to finish, and we
            actually pick up the phone. Your house stays your house the whole
            time.
          </p>
          <p className="mt-2 text-fg/75">{AREA_LINE}</p>
          <CallTextActions className="mt-8" />
          <a
            href="#send-job"
            className="mt-4 text-sm font-medium text-fg/70 underline-offset-4 hover:text-primary hover:underline"
          >
            Or send the job below
          </a>
        </div>
      </section>

      <section
        id="send-job"
        className="scroll-mt-28 border-b border-border bg-surface px-4 py-12 md:py-16"
      >
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-start md:gap-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Send the job
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-fg md:text-3xl">
              Tell us what you need.
            </h2>
            <p className="mt-3 text-muted">
              Neighborhood, the room, when you want someone out. We call or
              text you back.
            </p>
            <div className="mt-6 hidden md:block">
              <CallLink className="text-lg font-semibold text-primary hover:text-primary-hover">
                Prefer the phone? Call {SITE.phoneDisplay}
              </CallLink>
            </div>
          </div>
          <div className="rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)] md:p-7">
            <LeadForm
              sent={sent}
              nextPath="/"
              source="homepage"
              compact
              messagePlaceholder="Neighborhood, the job, when you want someone out."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
        <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
          What we do
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          Kitchens and baths, flooring, paint, roofs, make-ready, repairs, and
          insurance rebuilds. Design in-house. One crew from walkthrough to
          finish.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Link
            to="/services"
            className="text-sm font-medium text-primary hover:underline"
          >
            Full service list
          </Link>
          <CallLink className="text-sm font-medium text-primary hover:underline">
            Call {SITE.phoneDisplay}
          </CallLink>
          <Link
            to="/gallery"
            className="text-sm font-medium text-muted hover:text-primary hover:underline"
          >
            See the Gallery
          </Link>
        </div>
      </section>

      <BestWorkBand />

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
          Why people hire us
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {WHY.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <item.icon className="size-8 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 font-display text-xl text-fg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
          How a job goes
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((item) => (
            <article
              key={item.step}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <p className="font-display text-5xl font-semibold text-primary">
                {item.step}.
              </p>
              <h3 className="mt-3 font-display text-xl text-fg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-surface px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
            Reviews
          </h2>
          <div className="mt-8 space-y-4">
            {TESTIMONIALS.slice(3, 6).map((t) => (
              <blockquote
                key={t.name}
                className="rounded-2xl bg-bg p-6 shadow-[var(--shadow-border)]"
              >
                <p className="text-fg/90">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-4 text-sm">
                  <span className="font-medium text-fg">{t.name}</span>
                  <span className="text-subtle"> · {t.place}</span>
                </footer>
              </blockquote>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/testimonials">More reviews</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <h2 className="font-display text-3xl font-semibold text-fg">
          Questions
        </h2>
        <Accordion type="single" collapsible className="mt-6">
          {FAQS.map((faq) => (
            <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent>{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
