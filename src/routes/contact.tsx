import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CallLink } from "@/components/call-link";
import { JobBallpark, type BallparkSide } from "@/components/job-ballpark";
import { LeadForm } from "@/components/lead-form";
import { type QuoteSelection } from "@/components/quote-estimator";
import { PageIntro } from "@/components/site-shell";
import {
  AREA_LINE,
  ESTIMATE_TYPES,
  JOB_DISCOUNT,
  SERVICES,
  SITE,
  SCOPE_LABELS,
  type ServiceId,
} from "@/lib/site";
import { formatUsdRange } from "@/lib/utils";

type Search = {
  service?: ServiceId;
  sent?: boolean;
  side?: BallparkSide;
};

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const service =
      typeof search.service === "string"
        ? (search.service as ServiceId)
        : undefined;
    const sent = search.sent === "1" || search.sent === true;
    const side: BallparkSide | undefined =
      search.side === "exterior" || search.side === "interior"
        ? search.side
        : service === "roofing"
          ? "exterior"
          : undefined;
    return { service, ...(sent ? { sent: true } : {}), ...(side ? { side } : {}) };
  },
  head: () => ({
    meta: [
      { title: `Contact | ${SITE.legalName}` },
      {
        name: "description",
        content: `Call ${SITE.name} at ${SITE.phoneDisplay}. ${AREA_LINE}`,
      },
    ],
  }),
});

function ContactPage() {
  const { service: serviceFromUrl, sent: sentFromUrl, side: sideFromUrl } =
    Route.useSearch();
  const navigate = useNavigate({ from: "/contact" });
  const [address, setAddress] = useState("");
  const [pitch, setPitch] = useState("");
  const [roofSize, setRoofSize] = useState("");
  const [service, setService] = useState<string>(serviceFromUrl || "");
  const [quote, setQuote] = useState<QuoteSelection | null>(null);
  const [side, setSide] = useState<BallparkSide>(
    sideFromUrl === "exterior" || serviceFromUrl === "roofing"
      ? "exterior"
      : "interior",
  );
  const lastInteriorService = useRef<ServiceId>("kitchen");

  const estimateService =
    serviceFromUrl === "kitchen-bath"
      ? "kitchen"
      : ESTIMATE_TYPES.some((t) => t.id === serviceFromUrl)
        ? serviceFromUrl
        : undefined;

  useEffect(() => {
    if (estimateService) lastInteriorService.current = estimateService;
  }, [estimateService]);

  useEffect(() => {
    if (side === "interior" && ESTIMATE_TYPES.some((t) => t.id === service)) {
      lastInteriorService.current = service as ServiceId;
    }
  }, [side, service]);

  useEffect(() => {
    const next: BallparkSide =
      sideFromUrl === "exterior" || serviceFromUrl === "roofing"
        ? "exterior"
        : "interior";
    setSide(next);
  }, [sideFromUrl, serviceFromUrl]);

  const serviceLabel =
    ESTIMATE_TYPES.find((t) => t.id === service)?.label ||
    SERVICES.find((t) => t.id === service)?.title ||
    service;

  const interiorSize =
    quote && quote.service !== "roofing" ? SCOPE_LABELS[quote.scope] : "";
  const sizeLabel =
    (quote?.service || service) === "roofing" ? roofSize : interiorSize;
  const kitchenLabel =
    (quote?.service || service) === "kitchen" ? interiorSize : "n/a";
  const bathroomLabel =
    (quote?.service || service) === "bathroom" ? interiorSize : "n/a";
  const ballpark =
    quote?.range ? formatUsdRange(quote.range[0], quote.range[1]) : "";

  const quoteBlock = [
    "Ballpark from the website:",
    serviceLabel ? `Job: ${serviceLabel}` : null,
    address ? `Address: ${address}` : null,
    sizeLabel ? `Size: ${sizeLabel}` : null,
    pitch ? `Pitch: ${pitch}` : null,
    kitchenLabel !== "n/a" ? `Kitchen size: ${kitchenLabel}` : null,
    bathroomLabel !== "n/a" ? `Bathroom size: ${bathroomLabel}` : null,
    ballpark ? `Planning range: ${ballpark}` : null,
    quote?.includes ? quote.includes : null,
  ]
    .filter(Boolean)
    .join("\n");

  const subjectLine = `The Flip Fixer — ${serviceLabel || "job"}${sizeLabel ? `, ${sizeLabel}` : ""}${pitch ? `, ${pitch}` : ""}${ballpark ? ` (${ballpark})` : ""}`;

  const onQuoteChange = (next: QuoteSelection | null) => {
    setQuote(next);
    if (next?.service) setService(next.service);
    if (next?.service === "roofing") {
      if (next.address) setAddress(next.address);
      if (next.pitch) setPitch(next.pitch);
      if (next.sizeDetail) setRoofSize(next.sizeDetail);
      return;
    }
    if (next) {
      setAddress("");
      setPitch("");
      setRoofSize("");
    }
  };

  const onSideChange = (next: BallparkSide) => {
    setSide(next);
    if (next === "exterior") {
      setService("roofing");
      setQuote(null);
      void navigate({
        search: (prev) => ({ ...prev, service: "roofing", side: "exterior" }),
        hash: "ballpark",
        replace: true,
      });
      return;
    }
    const interiorService = lastInteriorService.current;
    setService(interiorService);
    setAddress("");
    setPitch("");
    setRoofSize("");
    void navigate({
      search: (prev) => ({
        ...prev,
        service: interiorService,
        side: "interior",
      }),
      hash: "ballpark",
      replace: true,
    });
  };

  return (
    <div>
      <PageIntro eyebrow="Contact" title="Call or send the job.">
        <p>Phone first. Photos help. The planning range is optional.</p>
      </PageIntro>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-12 md:grid-cols-5">
        <aside className="space-y-6 md:col-span-2">
          <CallLink className="block font-display text-4xl text-primary hover:text-primary-hover md:text-5xl">
            {SITE.phoneDisplay}
          </CallLink>
          <a
            href={`mailto:${SITE.email}`}
            className="block text-muted hover:text-primary"
          >
            {SITE.email}
          </a>
          <p className="text-muted">{AREA_LINE}</p>
          <p className="text-sm leading-relaxed text-subtle">
            {JOB_DISCOUNT} CASA or a group home?{" "}
            <Link to="/community" search={{ sent: false }} className="font-medium text-primary">
              Use the Community form
            </Link>{" "}
            so those notes are labeled.
          </p>
        </aside>

        <div className="rounded-2xl bg-surface p-8 shadow-[var(--shadow-border)] md:col-span-3">
          <LeadForm
            sent={sentFromUrl}
            nextPath="/contact"
            service={service}
            messagePlaceholder={
              side === "exterior"
                ? "Neighborhood, when you want to start."
                : "Neighborhood, the room, when you want to start."
            }
            extras={{
              job: serviceLabel,
              kitchenSize: kitchenLabel,
              bathroomSize: bathroomLabel,
              planningRange: ballpark,
              address,
              size: sizeLabel,
              pitch,
              quoteBlock,
              subjectLine,
            }}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-2 font-display text-2xl text-fg">
          Want a planning range?
        </h2>
        <p className="mb-6 text-sm text-muted">
          Optional. Call or send the form first. This does not replace a walkthrough.
        </p>
        <JobBallpark
          side={side}
          onSideChange={onSideChange}
          initialService={
            estimateService ??
            (side === "interior" ? lastInteriorService.current : undefined)
          }
          hideCta
          onServiceChange={(id) => setService(id)}
          onQuoteChange={onQuoteChange}
        />
      </section>
    </div>
  );
}
