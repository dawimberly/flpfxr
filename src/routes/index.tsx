import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PencilRuler, Phone, Wrench } from "lucide-react";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { QuoteEstimator } from "@/components/quote-estimator";
import { CallLink } from "@/components/call-link";
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
          `Flip Fixer. Kitchen and bath remodels, flooring, paint, and make-ready work. ${AREA_LINE} 30+ years on the tools. Design in-house. Call (210) 436-9117.`,
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
        <img
          src="/images/gallery-01-a.jpg"
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
          <p className="mt-3 text-fg/75">
            {AREA_LINE}
          </p>
          <p className="mt-2 text-sm text-fg/70">
            30+ years on the tools. Design in-house.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <CallLink>
                <Phone className="size-4" />
                Call for a free estimate
              </CallLink>
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
              to="/services"
              hash={service.id}
              className="group overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <img
                src={service.image}
                alt=""
                className="photo-frame h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="p-5">
                <h3 className="font-display text-xl text-fg">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {service.short}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-surface px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <BeforeAfterSlider
            beforeSrc="/images/kitchenbefore.jpg"
            afterSrc="/images/kitchenafter.jpg"
            beforeAlt="Kitchen before"
            afterAlt="Kitchen after"
          />
          <div className="mt-6 text-center">
            <Link
              to="/gallery"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              More work
              <ArrowRight className="size-4" />
            </Link>
          </div>
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

      <section className="bg-surface px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-start">
          <QuoteEstimator />
          <div>
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
