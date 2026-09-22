import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { LeadForm, type LeadFormExtras } from "@/components/lead-form";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { AREA_LINE, SITE } from "@/lib/site";

export function AdsLanding({
  eyebrow,
  title,
  body,
  image,
  imageAlt,
  service,
  nextPath,
  messagePlaceholder,
  extras,
  proofs,
  children,
  sent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  service: string;
  nextPath: string;
  messagePlaceholder: string;
  extras?: LeadFormExtras;
  proofs: Array<{ title: string; body: string }>;
  children?: ReactNode;
  sent?: boolean;
}) {
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <Photo
          src={image}
          alt={imageAlt}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/40" />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-24 md:pb-16 md:pt-32">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-fg/85">{body}</p>
          <p className="mt-2 text-sm text-fg/70">{AREA_LINE}</p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-14 px-8 text-lg">
              <CallLink>
                <Phone className="size-5" />
                Call {SITE.phoneDisplay}
              </CallLink>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-12 md:grid-cols-5 md:py-16">
        <aside className="space-y-4 md:col-span-2">
          <h2 className="font-display text-3xl text-fg">Tell us about the job.</h2>
          <p className="text-muted">
            Name, phone, and what is going on. We call back. The planning
            range is optional and sits below.
          </p>
          <CallLink className="block font-display text-3xl text-primary hover:text-primary-hover md:text-4xl">
            {SITE.phoneDisplay}
          </CallLink>
          <ul className="space-y-3 pt-2">
            {proofs.map((item) => (
              <li key={item.title}>
                <p className="font-medium text-fg">{item.title}</p>
                <p className="text-sm text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </aside>
        <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)] md:col-span-3 md:p-8">
          <LeadForm
            sent={sent}
            nextPath={nextPath}
            service={service}
            messagePlaceholder={messagePlaceholder}
            extras={extras}
            showAffiliation={false}
          />
        </div>
      </section>

      {children}
    </div>
  );
}
