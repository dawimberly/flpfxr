import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileCallBar } from "@/components/mobile-call-bar";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <SiteHeader />
      <main className="flex-1 pb-24 sm:pb-0">{children}</main>
      <SiteFooter />
      <MobileCallBar />
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center md:pt-20">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-fg md:text-5xl">
        {title}
      </h1>
      {children ? (
        <div className="mt-4 text-lg leading-relaxed text-muted">{children}</div>
      ) : null}
    </header>
  );
}

export function CtaBand({
  title = "Need work done?",
  body = "Tell us about the job.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="bg-cream px-4 py-16 text-cream-fg md:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-lg text-cream-muted">{body}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/contact"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Contact
          </Link>
        </div>
      </div>
    </section>
  );
}
