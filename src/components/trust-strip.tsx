import type { ReactNode } from "react";
import { Phone, ShieldCheck, Star } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { REVIEWS, SITE, TRUST } from "@/lib/site";
import { cn } from "@/lib/utils";

export function TrustStrip({ className }: { className?: string }) {
  const items: ReactNode[] = [];

  const hasRating = REVIEWS.rating !== null && REVIEWS.count !== null;
  if (hasRating || REVIEWS.googleUrl) {
    const reviewLabel = hasRating
      ? `${REVIEWS.rating} (${REVIEWS.count} Google ${REVIEWS.count === 1 ? "review" : "reviews"})`
      : "Google reviews";

    const content = (
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden="true" />
        <span>{reviewLabel}</span>
      </span>
    );

    if (REVIEWS.googleUrl) {
      items.push(
        <a
          key="reviews"
          href={REVIEWS.googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary hover:underline"
        >
          {content}
        </a>,
      );
    } else {
      items.push(<span key="reviews">{content}</span>);
    }
  }

  if (TRUST.licensed) {
    items.push(
      <span key="licensed" className="inline-flex items-center gap-1.5 font-medium">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        <span>Licensed</span>
      </span>,
    );
  }

  if (TRUST.insured) {
    items.push(
      <span key="insured" className="inline-flex items-center gap-1.5 font-medium">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        <span>Insured</span>
      </span>,
    );
  }

  if (SITE.phoneDisplay) {
    items.push(
      <CallLink
        key="phone"
        className="inline-flex items-center gap-1.5 font-medium hover:text-primary"
      >
        <Phone className="size-3.5 text-primary" aria-hidden="true" />
        <span>{SITE.phoneDisplay}</span>
      </CallLink>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-6">
          {index > 0 ? (
            <span className="hidden select-none text-border sm:inline" aria-hidden="true">
              ·
            </span>
          ) : null}
          {item}
        </div>
      ))}
    </div>
  );
}
