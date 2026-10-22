import { createFileRoute, Link } from "@tanstack/react-router";
import { CallTextActions } from "@/components/call-text-actions";
import { CallLink, CallNumber } from "@/components/call-link";
import { LeadForm } from "@/components/lead-form";
import { TextLink } from "@/components/text-link";
import { PageIntro } from "@/components/site-shell";
import { AREA_LINE, DISCOUNT_ACCEPTED, JOB_DISCOUNT, PROJECT_FIT, SITE, type ServiceId } from "@/lib/site";

type Search = {
  service?: ServiceId;
  sent?: boolean;
  side?: "exterior" | "interior";
};

type ContactCopy = {
  eyebrow: string;
  /** Browser title, before the business name. */
  documentTitle: string;
  description: string;
  /** Visible page heading. */
  title: string;
  intro: string;
  placeholder: string;
};

const GENERAL_CONTACT: ContactCopy = {
  eyebrow: "Contact",
  documentTitle: "Contact",
  description: `Call ${SITE.name} at ${SITE.phoneDisplay}. ${AREA_LINE}`,
  title: "Call or send the job.",
  intro: "Phone, text, or the form. Photos help.",
  placeholder: "Neighborhood, the job, and when you want someone out.",
};

/** One entry per service id. Roofing and kitchen keep their existing lines. */
const SERVICE_CONTACT: Record<ServiceId, ContactCopy> = {
  roofing: {
    eyebrow: "Roofing",
    documentTitle: "Roof repair and replacement",
    description: `Roof repair and replacement in San Antonio. Call ${SITE.phoneDisplay}. We walk the job. ${AREA_LINE}`,
    title: "Roof repair and replacement in San Antonio.",
    intro: "Leaks, storm damage, or a roof that is done. We walk it and give you a number.",
    placeholder: "Address, what's wrong, and when you want someone out.",
  },
  kitchen: {
    eyebrow: "Kitchens",
    documentTitle: "Kitchen remodel",
    description: `Kitchen remodels in San Antonio. Call or text ${SITE.phoneDisplay}. Design in-house. ${AREA_LINE}`,
    title: "Kitchen remodels in San Antonio.",
    intro: "Cabinets, counters, and floors. We walk the room and give you a number.",
    placeholder: "Neighborhood, the room, what you want to change, and when you want to start.",
  },
  bathroom: {
    eyebrow: "Bathrooms",
    documentTitle: "Bathroom remodel",
    description: `Bathroom remodels in San Antonio. Show us the room and tell us what needs to change. ${AREA_LINE}`,
    title: "Bathroom remodels in San Antonio.",
    intro: "Show us the bathroom and what needs to change. We walk the room and give you a number.",
    placeholder: "Neighborhood, the room, what you want to change, and when you want to start.",
  },
  "kitchen-bath": {
    eyebrow: "Kitchen & bath",
    documentTitle: "Kitchen and bath remodel",
    description: `Kitchen and bath remodels in San Antonio. A full remodel or a refresh. ${AREA_LINE}`,
    title: "Kitchen and bath remodels in San Antonio.",
    intro: "Cabinets, counters, floors, and the bath. A full remodel or a refresh. We walk the rooms and give you a number.",
    placeholder: "Neighborhood, the rooms, what you want to change, and when you want to start.",
  },
  flooring: {
    eyebrow: "Flooring",
    documentTitle: "Flooring",
    description: `Hardwood, laminate, tile, and vinyl in San Antonio. ${AREA_LINE}`,
    title: "Flooring in San Antonio.",
    intro: "Hardwood, laminate, tile, or vinyl. Tell us the rooms and we'll walk them.",
    placeholder: "Neighborhood, the rooms, the floor you want, and when you want someone out.",
  },
  paint: {
    eyebrow: "Paint",
    documentTitle: "Paint",
    description: `Interior and exterior paint in San Antonio. ${AREA_LINE}`,
    title: "Paint in San Antonio.",
    intro: "Interior or exterior. Tell us the rooms or the outside and we'll walk it.",
    placeholder: "Neighborhood, interior or exterior, and when you want someone out.",
  },
  handyman: {
    eyebrow: "Handyman",
    documentTitle: "Handyman",
    description: `Repairs and punch lists in San Antonio. ${AREA_LINE}`,
    title: "Handyman work in San Antonio.",
    intro: "Repairs and punch lists. Doors, drywall, hardware, and the leftover work.",
    placeholder: "Neighborhood, what needs fixing, and when you want someone out.",
  },
  outdoor: {
    eyebrow: "Outdoor",
    documentTitle: "Outdoor",
    description: `Fences, decks, patios, and lighting in San Antonio. ${AREA_LINE}`,
    title: "Outdoor work in San Antonio.",
    intro: "Fences, decks, patios, and lighting. Tell us what you want done.",
    placeholder: "Neighborhood, the outdoor work, and when you want someone out.",
  },
  "make-ready": {
    eyebrow: "Make-ready",
    documentTitle: "Make-ready",
    description: `Make-ready for rentals and listings in San Antonio. ${AREA_LINE}`,
    title: "Make-ready in San Antonio.",
    intro: "Paint, floors, fixtures, and punch lists for rentals and homes for sale.",
    placeholder: "Neighborhood, rental or listing, and when it needs to be ready.",
  },
  "insurance-claims": {
    eyebrow: "Insurance claims",
    documentTitle: "Insurance claim rebuilds",
    description: `Fire and storm claim rebuilds in San Antonio. ${AREA_LINE}`,
    title: "Insurance claim rebuilds in San Antonio.",
    intro: "Fire or storm damage, from tear-out through finish. Tell us the address and what happened.",
    placeholder: "Address, what happened, and when you want someone out.",
  },
  consulting: {
    eyebrow: "Walkthrough",
    documentTitle: "Walkthrough",
    description: `A walkthrough and a price in San Antonio. ${AREA_LINE}`,
    title: "A walkthrough in San Antonio.",
    intro: "We'll walk the job, tell you what's worth doing, and give you a number.",
    placeholder: "Neighborhood, what you want looked at, and when you want someone out.",
  },
};

function isServiceId(value: string | undefined): value is ServiceId {
  return !!value && Object.prototype.hasOwnProperty.call(SERVICE_CONTACT, value);
}

function contactCopy(service: string | undefined, side: Search["side"]): ContactCopy | null {
  if (side === "exterior" || service === "roofing") return SERVICE_CONTACT.roofing;
  if (isServiceId(service)) return SERVICE_CONTACT[service];
  return null;
}

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const service =
      typeof search.service === "string"
        ? (search.service as ServiceId)
        : undefined;
    const sent = search.sent === "1" || search.sent === true;
    const side: Search["side"] =
      search.side === "exterior" || search.side === "interior"
        ? search.side
        : service === "roofing"
          ? "exterior"
          : undefined;
    return { service, ...(sent ? { sent: true } : {}), ...(side ? { side } : {}) };
  },
  head: ({ match }) => {
    const search = match?.search as Search | undefined;
    const copy = contactCopy(search?.service, search?.side) ?? GENERAL_CONTACT;
    return {
      links: [{ rel: "canonical", href: `${SITE.url}/contact` }],
      meta: [
        { title: `${copy.documentTitle} | ${SITE.legalName}` },
        { name: "description", content: copy.description },
      ],
    };
  },
});

function ContactPage() {
  const { service: serviceFromUrl, sent: sentFromUrl, side: sideFromUrl } =
    Route.useSearch();
  const specific = contactCopy(serviceFromUrl, sideFromUrl);
  const copy = specific ?? GENERAL_CONTACT;

  return (
    <div>
      <PageIntro eyebrow={copy.eyebrow} title={copy.title}>
        <p>{copy.intro}</p>
        {specific ? null : <p className="mt-3 text-fg">{PROJECT_FIT}</p>}
        <CallTextActions className="mt-6 hidden justify-center sm:flex" />
      </PageIntro>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 md:grid-cols-5">
        <aside className="space-y-6 md:col-span-2">
          <CallLink className="block font-display text-4xl text-primary hover:text-primary-hover md:text-5xl">
            <CallNumber />
          </CallLink>
          <TextLink className="block text-xl font-semibold text-primary hover:text-primary-hover">
            Text {SITE.phoneDisplay}
          </TextLink>
          <a
            href={`mailto:${SITE.email}`}
            className="block text-muted hover:text-primary"
          >
            {SITE.email}
          </a>
          <p className="text-muted">{AREA_LINE}</p>
          <p className="text-sm leading-relaxed text-subtle">
            {JOB_DISCOUNT} {DISCOUNT_ACCEPTED} CASA or a group home?{" "}
            <Link
              to="/community"
              search={{ sent: false }}
              className="font-medium text-primary"
            >
              Use the Community form
            </Link>{" "}
            so those notes are labeled.
          </p>
        </aside>

        <div className="rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] md:col-span-3">
          <LeadForm
            sent={sentFromUrl}
            nextPath="/contact"
            service={serviceFromUrl || ""}
            source="contact"
            messagePlaceholder={copy.placeholder}
          />
        </div>
      </section>
    </div>
  );
}
