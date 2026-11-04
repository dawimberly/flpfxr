import { SERVICE_AREAS, SITE } from "./site.ts";

/**
 * Unsigned decimal of the Maps feature id 0x1238d1d38ea1b563.
 * Verified: int("1238d1d38ea1b563", 16) === 1313029997939766627.
 * The older San Antonio CID 16586128267752596041 (0xe62dc3c84e756249) is a
 * duplicate listing Dan is removing. Do not use it.
 */
export const GOOGLE_MAPS_CID = "1313029997939766627";

/** Canonical Google Business Profile URL. No tracking parameters. */
export const GOOGLE_BUSINESS_URL = `https://maps.google.com/?cid=${GOOGLE_MAPS_CID}`;

/**
 * Real public profile URLs for schema.org sameAs.
 * TODO owner: paste the Nextdoor business URL if you want it here. The site
 * quotes a Nextdoor review, but the repo still has no Nextdoor profile link.
 */
export const BUSINESS_SAME_AS: readonly string[] = [GOOGLE_BUSINESS_URL];

/**
 * Hours Dan confirmed on the service-area profile.
 * Sunday opens and closes at 00:00, which is how schema.org marks a closed day.
 */
export const BUSINESS_HOURS = [
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: "Saturday",
    opens: "10:00",
    closes: "16:00",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: "Sunday",
    opens: "00:00",
    closes: "00:00",
  },
] as const;

/**
 * Homepage GeneralContractor graph. Published facts only.
 * No street address and no geo pin: the correct profile is a service-area
 * business with no storefront. No review markup.
 */
export function businessJsonLd() {
  const [locality, region] = SITE.city.split(",").map((part) => part.trim());
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    "@id": `${SITE.url}/#business`,
    name: SITE.name,
    url: `${SITE.url}/`,
    telephone: `+1${SITE.phone}`,
    email: SITE.email,
    description: SITE.tagline,
    logo: `${SITE.url}/logo.svg`,
    image: `${SITE.url}/og.jpg`,
    address: {
      "@type": "PostalAddress",
      addressLocality: locality,
      addressRegion: region,
      addressCountry: "US",
    },
    openingHoursSpecification: BUSINESS_HOURS,
    areaServed: SERVICE_AREAS.map((name) => ({
      "@type": "Place",
      name,
      address: {
        "@type": "PostalAddress",
        addressRegion: "TX",
        addressCountry: "US",
      },
    })),
  };
  if (BUSINESS_SAME_AS.length > 0) data.sameAs = [...BUSINESS_SAME_AS];
  return data;
}
