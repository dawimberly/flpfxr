import { createFileRoute, Link } from "@tanstack/react-router";
import { CallTextActions } from "@/components/call-text-actions";
import { CallLink } from "@/components/call-link";
import { LeadForm } from "@/components/lead-form";
import { TextLink } from "@/components/text-link";
import { PageIntro } from "@/components/site-shell";
import { AREA_LINE, JOB_DISCOUNT, SITE, type ServiceId } from "@/lib/site";

type Search = {
  service?: ServiceId;
  sent?: boolean;
  side?: "exterior" | "interior";
};

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
    const service = (match?.search as Search | undefined)?.service;
    if (service === "roofing") {
      return {
        meta: [
          { title: `Roof repair and replacement | ${SITE.legalName}` },
          {
            name: "description",
            content: `Roof repair and replacement in San Antonio. Call ${SITE.phoneDisplay}. We walk the job. ${AREA_LINE}`,
          },
        ],
      };
    }
    if (service === "kitchen" || service === "kitchen-bath") {
      return {
        meta: [
          { title: `Kitchen remodel | ${SITE.legalName}` },
          {
            name: "description",
            content: `Kitchen remodels in San Antonio. Call or text ${SITE.phoneDisplay}. Design in-house. ${AREA_LINE}`,
          },
        ],
      };
    }
    return {
      meta: [
        { title: `Contact | ${SITE.legalName}` },
        {
          name: "description",
          content: `Call ${SITE.name} at ${SITE.phoneDisplay}. ${AREA_LINE}`,
        },
      ],
    };
  },
});

function ContactPage() {
  const { service: serviceFromUrl, sent: sentFromUrl, side: sideFromUrl } =
    Route.useSearch();
  const isRoofAd = serviceFromUrl === "roofing" || sideFromUrl === "exterior";
  const isKitchenAd =
    serviceFromUrl === "kitchen" || serviceFromUrl === "kitchen-bath";
  const introTitle = isRoofAd
    ? "Roof repair and replacement in San Antonio."
    : isKitchenAd
      ? "Kitchen remodels in San Antonio."
      : "Call or send the job.";
  const introBody = isRoofAd
    ? "Leaks, storm damage, or a roof that is done. Call. We walk it and give you a number."
      : isKitchenAd
      ? "Cabinets, counters, floors. Design in-house. Call, text, or send the job. We walk the room and give you a number."
      : "Phone first. Photos help. No planning range on this page.";
  const placeholder = isRoofAd
    ? "Address, leak or storm, when you want someone out."
    : isKitchenAd
      ? "Neighborhood, the room, when you want to start."
      : "Neighborhood, the job, when you want someone out.";

  return (
    <div>
      <PageIntro
        eyebrow={isRoofAd ? "Roofing" : isKitchenAd ? "Kitchens" : "Contact"}
        title={introTitle}
      >
        <p>{introBody}</p>
        <CallTextActions className="mt-6 justify-center" />
      </PageIntro>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 md:grid-cols-5">
        <aside className="space-y-6 md:col-span-2">
          <CallLink className="block font-display text-4xl text-primary hover:text-primary-hover md:text-5xl">
            {SITE.phoneDisplay}
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
            {JOB_DISCOUNT} CASA or a group home?{" "}
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
            messagePlaceholder={placeholder}
          />
        </div>
      </section>
    </div>
  );
}
