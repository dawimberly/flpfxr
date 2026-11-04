import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, ArrowRight } from "lucide-react";
import { CallLink, CallNumber } from "@/components/call-link";
import { PageIntro } from "@/components/site-shell";
import { SITE } from "@/lib/site";
import { PUBLICATION_FLAGS } from "@/lib/publication-flags";
import { NORTHVILLE_PROCESS, NORTHVILLE_SOURCE, NORTHVILLE_STYLES } from "@/lib/northville";

export const Route = createFileRoute("/northville")({
  component: NorthvillePage,
  head: () => ({
    links: [{ rel: "canonical", href: SITE.url + "/northville" }],
    meta: [
      { title: "Northville Cabinet Installation in San Antonio | " + SITE.name },
      { name: "description", content: "Plan your Northville cabinet installation with The Flip Fixer in San Antonio. Explore cabinet styles, our installation process, and your online estimate." },
    ],
  }),
});

function NorthvillePage() {
  return (
    <div>
      <PageIntro eyebrow="Cabinet installation" title="Northville cabinet installation in San Antonio">
        <p>Bring your cabinet plans to Jon. We help you plan the layout, prepare the room, and install your Northville cabinets with the owner on every job.</p>
        {PUBLICATION_FLAGS.northvilleCertificationVerified ? <p className="mt-3 font-semibold text-primary">The Flip Fixer is a certified Northville installer.</p> : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/estimate" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-fg">See your estimate online <ArrowRight className="size-4" /></Link>
          <CallLink className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-semibold text-primary"><Phone className="size-4" />Call <CallNumber /></CallLink>
        </div>
        <p className="mt-3 text-sm">Preliminary estimate only — not a quote. Jon confirms the installation scope after reviewing your space.</p>
      </PageIntro>
      <section className="mx-auto max-w-6xl px-4 pb-12 md:pb-16" aria-labelledby="northville-styles">
        <h2 id="northville-styles" className="font-display text-3xl font-semibold text-fg">Find a cabinet style for your home</h2>
        <p className="mt-3 max-w-2xl text-muted">Northville lists the following cabinet styles. Ask Jon which lines and configurations fit your installation; selections and availability are confirmed before ordering.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NORTHVILLE_STYLES.map(style => <li key={style} className="rounded-xl border border-border bg-surface p-5 font-medium text-fg">{style}</li>)}
        </ul>
        <a href={NORTHVILLE_SOURCE} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Source: Northville cabinet door styles and finishes</a>
      </section>
      <section className="bg-surface px-4 py-12 md:py-16" aria-labelledby="northville-process">
        <div className="mx-auto max-w-6xl">
          <h2 id="northville-process" className="font-display text-3xl font-semibold text-fg">From first conversation to final walkthrough</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {NORTHVILLE_PROCESS.map((step, index) => <li key={step.title} className="rounded-2xl bg-bg p-6">
              <span className="text-sm font-semibold text-primary">Step {index + 1}</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-fg">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>)}
          </ol>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-12 text-center md:py-16">
        <h2 className="font-display text-3xl font-semibold text-fg">Start with your space.</h2>
        <p className="mt-3 text-muted">30+ years experience. No high-pressure sales. Explore a preliminary estimate online, then talk through your installation with Jon.</p>
        <Link to="/estimate" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-fg">Plan your project</Link>
      </section>
    </div>
  );
}
