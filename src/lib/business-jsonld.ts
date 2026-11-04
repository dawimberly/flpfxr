import { SERVICE_AREAS, SITE } from "./site.ts";

/**
 * Unsigned decimal of the Maps feature id 0xe62dc3c84e756249.
 * Verified: int("e62dc3c84e756249", 16) === 16586128267752596041.
 */
export const GOOGLE_MAPS_CID = "16586128267752596041";

/** Canonical Google Business Profile URL. No tracking parameters. */
export const GOOGLE_BUSINESS_URL = `https://maps.google.com/?cid=${GOOGLE_MAPS_CID}`;

/**
 * Real public profile URLs for schema.org sameAs.
 * TODO owner: paste the Nextdoor business URL if you want it here. The site
 * quotes a Nextdoor review, but the repo still has no Nextdoor profile link.
 */
export const BUSINESS_SAME_AS: readonly string[] = [GOOGLE_BUSINESS_URL];

/** Place pin from the Maps URL (3d / 4d), not the zoomed-out map center. */
export const BUSINESS_GEO = {
  latitude: 29.4581826,
  longitude: -98.518079,
} as const;

/**
 * Homepage GeneralContractor graph. Published facts only.
 * No street address and no opening hours. The public Maps HTML names the
 * business and the pin, but it does not include a weekly schedule.
 * No review markup.
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
    geo: {
      "@type": "GeoCoordinates",
      latitude: BUSINESS_GEO.latitude,
      longitude: BUSINESS_GEO.longitude,
    },
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
