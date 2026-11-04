import { AREA_LINE, SERVICE_AREAS, SITE } from "./site.ts";

export type AreaLink =
  | {
      label: string;
      to:
        | "/kitchen"
        | "/bathroom"
        | "/services"
        | "/gallery"
        | "/about"
        | "/testimonials"
        | "/insurance-claims"
        | "/estimate"
        | "/blog"
        | "/areas";
    }
  | {
      label: string;
      to: "/contact";
      service?: "insurance-claims" | "make-ready" | "outdoor" | "kitchen" | "bathroom";
    }
  | { label: string; to: "/blog/$slug"; slug: string }
  | { label: string; to: "/areas/$slug"; slug: string };

export type AreaPage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  paragraphs: readonly string[];
  /** Published testimonial that already names this place. */
  reviewName?: "Clark P." | "Jennifer R.";
  /** Render the published four-step process. Used on one page so it is not copied onto every city. */
  showProcess?: boolean;
  links: readonly AreaLink[];
  todos: readonly string[];
};

const phone = SITE.phoneDisplay;

export const AREA_PAGES: readonly AreaPage[] = [
  {
    slug: "alamo-heights",
    name: "Alamo Heights",
    title: "Kitchen, bath, and make-ready in Alamo Heights",
    description: `Alamo Heights remodeling and rental make-ready. Call ${phone}. Clark P. wrote about a rental prepared for an open house.`,
    paragraphs: [
      `Alamo Heights is the first name on our service-area list, and it is one of the places in the short line on the site: ${AREA_LINE}`,
      "The only review that names Alamo Heights is from Clark P. He describes a rental property made ready on a budget, then multiple offers after one open house. The review does not list rooms, a street, or a price.",
      "Make-ready, as we describe it, is paint, floors, fixtures, and punch lists for rentals and listings. Kitchen and bathroom work is a full-room remodel, with design handled in-house.",
      "Terrell Hills and Olmos Park are also on the service list. They do not have their own pages. Gallery photos are not labeled by neighborhood, so this page does not present them as Alamo Heights jobs.",
    ],
    reviewName: "Clark P.",
    links: [
      { label: "Make-ready", to: "/contact", service: "make-ready" },
      { label: "Kitchen remodeling", to: "/kitchen" },
      { label: "Bathroom remodeling", to: "/bathroom" },
      { label: "All reviews", to: "/testimonials" },
    ],
    todos: [
      "Add an Alamo Heights project note (which room, what changed) if you want more here than Clark P.'s review. Do not assign a gallery photo to Alamo Heights unless you know that house was there.",
    ],
  },
  {
    slug: "stone-oak",
    name: "Stone Oak",
    title: "Kitchen remodeling in Stone Oak",
    description: `Stone Oak kitchen remodeling. Call ${phone}. Jennifer R. wrote about a kitchen renovation in Stone Oak.`,
    paragraphs: [
      `Stone Oak is on the service-area list. It is not in the short area line (${AREA_LINE}). This page exists because a published review names Stone Oak.`,
      "Jennifer R. of Stone Oak wrote about a kitchen renovation. The review does not name cabinets, a street, or a price. The quote is below, unchanged.",
      "Kitchen remodels are cabinets, counters, and floors. We walk the room and give you a number. The kitchen journal follows one real kitchen from tear-out through a herringbone floor. That journal does not say the house was in Stone Oak, so this page does not claim it was.",
      "Helotes, Hollywood Park, and Shavano Park are on the service list and do not have their own pages. Hollywood Park has a separate review, from Scott S., about home repairs. That review is on the reviews page. It is not a Stone Oak job.",
    ],
    reviewName: "Jennifer R.",
    links: [
      { label: "Kitchen remodeling", to: "/kitchen" },
      {
        label: "Kitchen journal: before, during, and after",
        to: "/blog/$slug",
        slug: "kitchen-remodel-before-during-after",
      },
      { label: "All reviews", to: "/testimonials" },
    ],
    todos: [
      "Add a Stone Oak project note only if you are willing to publish it. Do not label the kitchen journal or the gallery kitchens as Stone Oak unless that is the house.",
    ],
  },
  {
    slug: "boerne",
    name: "Boerne",
    title: "Remodeling and home repair in Boerne",
    description: `Boerne remodeling, repair, and make-ready. Call ${phone} to schedule a walkthrough. Boerne is on The Flip Fixer's service list.`,
    paragraphs: [
      `Boerne is named in the short area line: ${AREA_LINE} No review on this site is placed in Boerne.`,
      "The work we publish for every listed area is indoor full-room kitchen and bathroom remodels, plus flooring, paint, handyman work, outdoor projects, make-ready, and insurance claim rebuilds.",
      `A job starts the way we describe it everywhere: we walk the house, then give one clear price. The steps we publish are below. Fair Oaks Ranch is also on the service list and does not have its own page. Call or text ${phone} and say Boerne, the room, and what you want to change.`,
      "If you want a planning range before that visit, use the estimate page. The number there is a planning range. The price we stand behind comes after we walk the house.",
    ],
    showProcess: true,
    links: [
      { label: "Services", to: "/services" },
      { label: "Planning range", to: "/estimate" },
      {
        label: "What to have ready for the first visit",
        to: "/blog/$slug",
        slug: "first-remodeling-appointment",
      },
      { label: "Contact", to: "/contact" },
    ],
    todos: [
      "Add a real Boerne job note (scope only) or delete this note. Do not paste another city's review onto this page.",
    ],
  },
  {
    slug: "the-dominion",
    name: "The Dominion",
    title: "Remodeling in The Dominion",
    description: `Remodeling in The Dominion. Call ${phone}. The Dominion is named on the site. No review is placed there.`,
    paragraphs: [
      `The Dominion is named in the short area line: ${AREA_LINE} No review on this site is placed in The Dominion.`,
      "A Nextdoor review from Elieen Doctor describes a custom fireplace, built in bookshelves, a bathroom remodel, fence replacements, and a repair that avoided an insurance claim. Those words are hers, from the review on the reviews page. The review does not name a neighborhood. It is not a Dominion project on this page.",
      "What we do publish for The Dominion, same as the rest of the list: kitchen and bathroom remodels with design in-house, and outdoor work — fences, decks, patios, and lighting.",
    ],
    links: [
      { label: "Read the Nextdoor review", to: "/testimonials" },
      { label: "Kitchen remodeling", to: "/kitchen" },
      { label: "Bathroom remodeling", to: "/bathroom" },
      { label: "Outdoor work", to: "/contact", service: "outdoor" },
    ],
    todos: [
      "If the Nextdoor fireplace, bookshelves, bathroom, or fence work was in The Dominion, say which part. Until you do, that review stays a general review, not a Dominion project.",
      "Add a Dominion project note you are willing to publish, or leave this as a service-area page without a job story.",
    ],
  },
  {
    slug: "kerrville",
    name: "Kerrville",
    title: "Remodeling and insurance rebuilds in Kerrville",
    description: `Kerrville remodeling and insurance claim rebuilds. Call ${phone}. Kerrville is on the service list. No Kerrville review is published.`,
    paragraphs: [
      `Kerrville is on the service-area list and in the short line on the site: ${AREA_LINE} No review on this site is placed in Kerrville.`,
      "Insurance claim rebuilds are one of the services we publish for the areas we list, Kerrville included. The published description is fire or storm damage, rebuilt from tear-out through finish, catching scope the carrier left out. That description is not a Kerrville story.",
      "Dan Wimberly's published bio says he has a decade handling insurance claims and has regularly secured 20-50% increases in approved scope. That figure is his insurance-rebuild record. It is not a Kerrville result, and this page does not turn it into one.",
      `Kitchen and bathroom remodels are the other main work. Call or text ${phone} and say Kerrville and what you want done.`,
    ],
    links: [
      { label: "Insurance claim rebuilds", to: "/insurance-claims" },
      { label: "About the crew", to: "/about" },
      { label: "Kitchen remodeling", to: "/kitchen" },
      { label: "Contact", to: "/contact", service: "insurance-claims" },
    ],
    todos: [
      "Add a Kerrville project or scheduling note if one should be public. Do not add storm counts, license numbers, or claim stories that are not already written on the site.",
      "Confirm you still want Kerrville on its own page. It is already on the service list either way.",
    ],
  },
];

export function areaBySlug(slug: string): AreaPage | undefined {
  return AREA_PAGES.find((area) => area.slug === slug);
}

export function areasWithoutPages(): string[] {
  const named = new Set(AREA_PAGES.map((area) => area.name));
  return SERVICE_AREAS.filter((name) => !named.has(name));
}
