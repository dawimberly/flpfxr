import { SERVICE_AREAS, SITE } from "./site.ts";

/**
 * Real public profile URLs for schema.org sameAs.
 * TODO owner: paste the Nextdoor business URL (the site quotes a Nextdoor
 * review, but the repo has no profile link), plus Google Business Profile or
 * any other profile that is actually yours. Do not invent URLs.
 */
export const BUSINESS_SAME_AS: readonly string[] = [];

/**
 * Homepage GeneralContractor graph. Published facts only.
 * No street address, no opening hours (none are in the repo), no review markup.
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
