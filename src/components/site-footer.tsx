import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { NAV, SERVICE_AREAS, SITE } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-xl text-primary">{SITE.legalName}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Kitchen and bath remodels, flooring, paint, and make-ready work.
            Design in-house. 30+ years on the tools.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-fg">
            Service areas
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {SERVICE_AREAS.join(" · ")}
          </p>
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-fg">
            Contact
          </p>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <CallLink className="flex items-center gap-2 hover:text-fg">
              <Phone className="size-4 text-primary" />
              {SITE.phoneDisplay}
            </CallLink>
            <a
              href={`mailto:${SITE.email}`}
              className="flex items-center gap-2 hover:text-fg"
            >
              <Mail className="size-4 text-primary" />
              {SITE.email}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-subtle">
        © {year} {SITE.legalName}. All rights reserved.
      </div>
    </footer>
  );
}
