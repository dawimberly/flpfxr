import { createFileRoute, Link } from "@tanstack/react-router";
import { PencilRuler, Phone, Wrench } from "lucide-react";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FAQS,
  HOME_SERVICES,
  PROCESS,
  SERVICES,
  SITE,
  AREA_LINE,
  TESTIMONIALS,
} from "@/lib/site";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: `${SITE.name} | San Antonio & Kerrville` },
      {
        name: "description",
        content:
          `Flip Fixer. ${SITE.tagline} ${AREA_LINE} 30+ years on the tools. Design in-house. Call (210) 436-9117.`,
      },
    ],
  }),
});

const WHY = [
  {
    icon: Wrench,
    title: "30+ years of jobsite work",
    body: "",
  },
  {
    icon: PencilRuler,
    title: "Design handled in-house",
    body: "",
  },
  {
    icon: Phone,
    title: "Straight quotes. We answer the phone.",
    body: "",
  },
];

function Home() {
  const homeServices = HOME_SERVICES.map(
    (id) => SERVICES.find((s) => s.id === id)!,
  );

  return (
    <div>
      <section className="relative isolate min-h-[78vh] overflow-hidden">
        <Photo
          src="/images/gallery-01-a.webp"
          alt="Farmhouse kitchen remodel by Flip Fixer"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/35" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 md:pb-20">
          <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl md:text-7xl">
            {SITE.name}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-fg/85 md:text-xl">
            {SITE.tagline}
          </p>
          <p className="mt-3 text-fg/75">{AREA_LINE}</p>
          <p className="mt-2 text-sm text-fg/70">
            30+ years on the tools. Design in-house.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/contact">Contact</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
          What we do
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {homeServices.map((service) => (
            <Link
              key={service.id}
              to="/gallery"
              search={{ service: service.id }}
              className="group overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <Photo
                src={service.image}
                alt=""
                loading="lazy"
                className="photo-frame h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="p-5">
                <h3 className="font-display text-xl text-fg">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {service.short}
                </p>
                <p className="mt-3 text-sm font-medium text-primary">
                  See the work
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

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
