export const SITE = {
  name: "Flip Fixer",
  legalName: "The Flip Fixer",
  tagline: "Kitchen and bath remodels, flooring, paint, and make-ready work.",
  phone: "2104369117",
  phoneDisplay: "(210) 436-9117",
  email: "Jon@TheFlipFixer.com",
  city: "San Antonio, TX",
  url: "https://theflipfixer.com",
  owner: "Jon",
} as const;

/** Same-origin employee estimator (gated at /login). */
export const ESTIMATOR_APP_URL = "/estimator";

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/about", label: "About" },
  { to: "/testimonials", label: "Reviews" },
  { to: "/contact", label: "Contact" },
] as const;

export const SERVICE_AREAS = [
  "Alamo Heights",
  "Terrell Hills",
  "Olmos Park",
  "The Dominion",
  "Shavano Park",
  "Fair Oaks Ranch",
  "Hollywood Park",
  "Stone Oak",
  "Helotes",
  "Boerne",
  "Kerrville",
  "San Antonio",
] as const;

export const AREA_LINE =
  "Alamo Heights, The Dominion, Kerrville, Boerne, and San Antonio.";

export type ServiceId =
  | "kitchen-bath"
  | "flooring"
  | "paint"
  | "handyman"
  | "outdoor"
  | "make-ready"
  | "carpentry"
  | "consulting";

export const SERVICES: Array<{
  id: ServiceId;
  title: string;
  short: string;
  body: string;
  image: string;
  group: "Remodels" | "Make-ready" | "Repairs" | "Specialty";
}> = [
  {
    id: "kitchen-bath",
    title: "Kitchen & bath",
    short: "Cabinets, counters, floors, appliances.",
    body: "Cabinets, counters, floors, appliances. Full remodel or a refresh.",
    image: "/images/gallery-01-a.webp",
    group: "Remodels",
  },
  {
    id: "flooring",
    title: "Flooring",
    short: "Hardwood, laminate, tile, vinyl.",
    body: "Hardwood, laminate, tile, vinyl. Installed for this climate.",
    image: "/images/gallery-04-a.webp",
    group: "Remodels",
  },
  {
    id: "paint",
    title: "Paint",
    short: "Interior and exterior, prepped right.",
    body: "Interior and exterior. Prep first, then paint.",
    image: "/images/painter.webp",
    group: "Remodels",
  },
  {
    id: "make-ready",
    title: "Make-ready",
    short: "Rentals and homes for sale.",
    body: "Paint, floors, fixtures, punch lists. Rentals and listings, ready to show.",
    image: "/images/punchout.webp",
    group: "Make-ready",
  },
  {
    id: "handyman",
    title: "Handyman",
    short: "Repairs and punch lists.",
    body: "Repairs and punch lists. Doors, drywall, hardware, the leftover work.",
    image: "/images/repair.webp",
    group: "Repairs",
  },
  {
    id: "outdoor",
    title: "Outdoor",
    short: "Decks, patios, lighting.",
    body: "Decks, patios, lighting. Outdoor work that holds up out here.",
    image: "/images/patio1.webp",
    group: "Specialty",
  },
  {
    id: "carpentry",
    title: "Custom carpentry",
    short: "Built-ins, bars, stairs.",
    body: "Built-ins, bars, stairs. Built to fit the house.",
    image: "/images/bar1.webp",
    group: "Specialty",
  },
  {
    id: "consulting",
    title: "Walkthrough",
    short: "Look at the job. Get a price and a plan.",
    body: "We'll walk it, tell you what's worth doing, and give you a number. If you want the work, we do it.",
    image: "/images/gallery-09-c.webp",
    group: "Specialty",
  },
];

export const HOME_SERVICES: ServiceId[] = [
  "kitchen-bath",
  "handyman",
  "flooring",
  "paint",
  "outdoor",
  "make-ready",
];

export const STATS = [
  { value: "30+", label: "years on the tools" },
  { value: "Weeks", label: "not months" },
  { value: "24–48h", label: "to a call back" },
] as const;

export const VALUES = [
  {
    title: "Do it right",
    description:
      "The last 10% is the job. How a door shuts. Whether the caulk line is clean. That's what you live with.",
  },
  {
    title: "Don't drag it out",
    description:
      "We turn jobs around fast. Living in a remodel is miserable. You shouldn't have to do it longer than you have to.",
  },
  {
    title: "Respect the house",
    description:
      "Drop cloths down. Floors covered. We work like somebody still lives here — because they do.",
  },
  {
    title: "Straight to the crew",
    description:
      "The person who looked at the job is the person who owns it.",
  },
] as const;

export const PROCESS = [
  {
    step: "1",
    title: "Walk the house",
    body: "We look at the job. What's worth doing, what isn't.",
  },
  {
    step: "2",
    title: "One price",
    body: "What's included, what isn't, and a date. That's the number.",
  },
  {
    step: "3",
    title: "Daily cleanup",
    body: "We work. We sweep. You can still live here.",
  },
  {
    step: "4",
    title: "Walkthrough",
    body: "We walk it with you. Then you get the house back.",
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "Jon and his team have been awesome to work with. The value they provide for the cost is unbeatable. Jon is talented and responsive. I highly recommend him for all your home repair needs!",
    name: "Michael M.",
    place: "San Antonio, TX",
  },
  {
    quote:
      "Flip Fixer transformed my outdated rental property within my budget. Jon's attention to detail and craftsmanship is outstanding. I had multiple offers after just one open house!",
    name: "Clark P.",
    place: "Alamo Heights, TX",
  },
  {
    quote:
      "I approached Jon with several repairs needed throughout my home. He was professional, efficient, and the quality of work was exceptional. Will definitely be calling him again.",
    name: "Scott S.",
    place: "Hollywood Park, TX",
  },
  {
    quote:
      "The kitchen renovation exceeded all our expectations. Jon and his team were fast, clean, and incredibly professional. My new kitchen is exactly what I envisioned!",
    name: "Jennifer R.",
    place: "Stone Oak, TX",
  },
  {
    quote:
      "Their make-ready service saved us time and money — enabling our tenant to move in sooner than expected. Jon's team handled everything from repairs to painting flawlessly.",
    name: "David K.",
    place: "Austin, TX",
  },
  {
    quote:
      "As a property manager, I need reliable contractors I can trust. Flip Fixer has become our go-to for all maintenance and renovation needs. Always professional and on time.",
    name: "Sarah M.",
    place: "San Antonio, TX",
  },
] as const;

export const GALLERY: Array<{
  src: string;
  alt: string;
  title: string;
  caption: string;
  category: "Kitchen" | "Bath" | "Outdoor" | "Interior" | "Custom";
}> = [
  {
    src: "/images/kitchenbefore.webp",
    alt: "Kitchen before the remodel",
    title: "Kitchen remodel",
    caption: "Before",
    category: "Kitchen",
  },
  {
    src: "/images/kitchenafter.webp",
    alt: "Kitchen after the remodel",
    title: "Kitchen remodel",
    caption: "After",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-01-a.webp",
    alt: "Farmhouse kitchen by Flip Fixer",
    title: "Farmhouse kitchen",
    caption: "Farmhouse kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-01-b.webp",
    alt: "Farmhouse kitchen by Flip Fixer",
    title: "Farmhouse kitchen",
    caption: "Farmhouse kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-01-c.webp",
    alt: "Farmhouse kitchen by Flip Fixer",
    title: "Farmhouse kitchen",
    caption: "Farmhouse kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-02-a.webp",
    alt: "Navy island kitchen by Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-02-b.webp",
    alt: "Navy island kitchen by Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-02-c.webp",
    alt: "Navy island kitchen by Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-03-a.webp",
    alt: "Charcoal kitchen by Flip Fixer",
    title: "Charcoal kitchen",
    caption: "Charcoal kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-03-b.webp",
    alt: "Charcoal kitchen by Flip Fixer",
    title: "Charcoal kitchen",
    caption: "Charcoal kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-03-c.webp",
    alt: "Charcoal kitchen by Flip Fixer",
    title: "Charcoal kitchen",
    caption: "Charcoal kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-04-a.webp",
    alt: "Taupe kitchen by Flip Fixer",
    title: "Taupe kitchen",
    caption: "Taupe kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-04-b.webp",
    alt: "Taupe kitchen by Flip Fixer",
    title: "Taupe kitchen",
    caption: "Taupe kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-04-c.webp",
    alt: "Taupe kitchen by Flip Fixer",
    title: "Taupe kitchen",
    caption: "Taupe kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-05-a.webp",
    alt: "Two-tone kitchen by Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-05-b.webp",
    alt: "Two-tone kitchen by Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-05-c.webp",
    alt: "Two-tone kitchen by Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-06-a.webp",
    alt: "Open kitchen by Flip Fixer",
    title: "Open kitchen",
    caption: "Open kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-06-b.webp",
    alt: "Open kitchen by Flip Fixer",
    title: "Open kitchen",
    caption: "Open kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-06-c.webp",
    alt: "Open kitchen by Flip Fixer",
    title: "Open kitchen",
    caption: "Open kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-07-a.webp",
    alt: "Vaulted kitchen by Flip Fixer",
    title: "Vaulted kitchen",
    caption: "Vaulted kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-07-b.webp",
    alt: "Vaulted kitchen by Flip Fixer",
    title: "Vaulted kitchen",
    caption: "Vaulted kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-08-a.webp",
    alt: "Gray shaker kitchen by Flip Fixer",
    title: "Gray shaker kitchen",
    caption: "Gray shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-08-b.webp",
    alt: "Gray shaker kitchen by Flip Fixer",
    title: "Gray shaker kitchen",
    caption: "Gray shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-08-c.webp",
    alt: "Gray shaker kitchen by Flip Fixer",
    title: "Gray shaker kitchen",
    caption: "Gray shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-09-a.webp",
    alt: "White kitchen, black island by Flip Fixer",
    title: "White kitchen, black island",
    caption: "White kitchen, black island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-09-b.webp",
    alt: "White kitchen, black island by Flip Fixer",
    title: "White kitchen, black island",
    caption: "White kitchen, black island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-09-c.webp",
    alt: "White kitchen, black island by Flip Fixer",
    title: "White kitchen, black island",
    caption: "White kitchen, black island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-10-a.webp",
    alt: "Dark wood kitchen by Flip Fixer",
    title: "Dark wood kitchen",
    caption: "Dark wood kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-10-b.webp",
    alt: "Dark wood kitchen by Flip Fixer",
    title: "Dark wood kitchen",
    caption: "Dark wood kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-11-a.webp",
    alt: "Spa bath by Flip Fixer",
    title: "Spa bath",
    caption: "Spa bath",
    category: "Bath",
  },
  {
    src: "/images/gallery-11-b.webp",
    alt: "Spa bath by Flip Fixer",
    title: "Spa bath",
    caption: "Spa bath",
    category: "Bath",
  },
  {
    src: "/images/gallery-12-a.webp",
    alt: "Walk-in shower by Flip Fixer",
    title: "Walk-in shower",
    caption: "Walk-in shower",
    category: "Bath",
  },
  {
    src: "/images/gallery-12-b.webp",
    alt: "Walk-in shower by Flip Fixer",
    title: "Walk-in shower",
    caption: "Walk-in shower",
    category: "Bath",
  },
  {
    src: "/images/gallery-13-a.webp",
    alt: "Granite breakfast bar by Flip Fixer",
    title: "Granite breakfast bar",
    caption: "Granite breakfast bar",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-14-a.webp",
    alt: "Cream kitchen by Flip Fixer",
    title: "Cream kitchen",
    caption: "Cream kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-15-a.webp",
    alt: "Navy island by Flip Fixer",
    title: "Navy island",
    caption: "Navy island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-16-a.webp",
    alt: "Charcoal island by Flip Fixer",
    title: "Charcoal island",
    caption: "Charcoal island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-17-a.webp",
    alt: "Navy island kitchen by Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-18-a.webp",
    alt: "Two-tone kitchen by Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-18-b.webp",
    alt: "Two-tone kitchen by Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-18-c.webp",
    alt: "Two-tone kitchen by Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-19-a.webp",
    alt: "White shaker kitchen by Flip Fixer",
    title: "White shaker kitchen",
    caption: "White shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-19-b.webp",
    alt: "White shaker kitchen by Flip Fixer",
    title: "White shaker kitchen",
    caption: "White shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-19-c.webp",
    alt: "White shaker kitchen by Flip Fixer",
    title: "White shaker kitchen",
    caption: "White shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-20-a.webp",
    alt: "Cream kitchen by Flip Fixer",
    title: "Cream kitchen",
    caption: "Cream kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-20-b.webp",
    alt: "Cream kitchen by Flip Fixer",
    title: "Cream kitchen",
    caption: "Cream kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-20-c.webp",
    alt: "Cream kitchen by Flip Fixer",
    title: "Cream kitchen",
    caption: "Cream kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-21-a.webp",
    alt: "Herringbone kitchen by Flip Fixer",
    title: "Herringbone kitchen",
    caption: "Herringbone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-21-b.webp",
    alt: "Herringbone kitchen by Flip Fixer",
    title: "Herringbone kitchen",
    caption: "Herringbone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-21-c.webp",
    alt: "Herringbone kitchen by Flip Fixer",
    title: "Herringbone kitchen",
    caption: "Herringbone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-22-a.webp",
    alt: "Fire rebuild by Flip Fixer — insurance claim tear-out",
    title: "Fire rebuild",
    caption: "Insurance claim — full rebuild. Tear-out after the fire.",
    category: "Custom",
  },
  {
    src: "/images/gallery-22-b.webp",
    alt: "Charred structure during fire rebuild by Flip Fixer",
    title: "Fire rebuild",
    caption: "Insurance claim — full rebuild. Fire damage exposed.",
    category: "Custom",
  },
  {
    src: "/images/gallery-22-c.webp",
    alt: "Structural framing on fire rebuild by Flip Fixer",
    title: "Fire rebuild",
    caption: "Insurance claim — full rebuild. Framing goes back up.",
    category: "Custom",
  },
  {
    src: "/images/gallery-22-d.webp",
    alt: "New roof during fire rebuild by Flip Fixer",
    title: "Fire rebuild",
    caption: "Insurance claim — full rebuild. New roof going on.",
    category: "Custom",
  },
  {
    src: "/images/gallery-22-e.webp",
    alt: "Finished bath after fire rebuild by Flip Fixer",
    title: "Fire rebuild",
    caption: "Insurance claim — full rebuild. Finished bath.",
    category: "Custom",
  },
  {
    src: "/images/gallery-22-f.webp",
    alt: "Finished exterior after fire rebuild by Flip Fixer",
    title: "Fire rebuild",
    caption: "Insurance claim — full rebuild. Home finished.",
    category: "Custom",
  },
  {
    src: "/images/patio1.webp",
    alt: "Covered patio with string lights",
    title: "Patio",
    caption: "Patio",
    category: "Outdoor",
  },
  {
    src: "/images/patio2.webp",
    alt: "Pergola patio with dining table",
    title: "Pergola",
    caption: "Pergola",
    category: "Outdoor",
  },
  {
    src: "/images/staircase.webp",
    alt: "Staircase with wood treads and black rail",
    title: "Stairs",
    caption: "Stairs",
    category: "Interior",
  },
  {
    src: "/images/laundry.webp",
    alt: "Laundry room with built-in storage",
    title: "Laundry",
    caption: "Laundry",
    category: "Interior",
  },
  {
    src: "/images/bar1.webp",
    alt: "Custom home bar",
    title: "Custom bar",
    caption: "Custom bar",
    category: "Custom",
  },
  {
    src: "/images/flooring.webp",
    alt: "Wood-look flooring",
    title: "Floors",
    caption: "Floors",
    category: "Interior",
  },
  {
    src: "/images/painter.webp",
    alt: "Interior paint by Flip Fixer",
    title: "Paint",
    caption: "Paint",
    category: "Interior",
  },
  {
    src: "/images/punchout.webp",
    alt: "Make-ready work by Flip Fixer",
    title: "Make-ready",
    caption: "Make-ready",
    category: "Interior",
  },
  {
    src: "/images/repair.webp",
    alt: "Repair work by Flip Fixer",
    title: "Repairs",
    caption: "Repairs",
    category: "Interior",
  },
  {
    src: "/images/handyman.webp",
    alt: "Handyman work by Flip Fixer",
    title: "Repairs",
    caption: "Repairs",
    category: "Interior",
  },
];

export function galleryJobId(src: string): string {
  const numbered = src.match(/gallery-(\d+)/);
  if (numbered) return numbered[1];
  if (/kitchenbefore|kitchenafter/.test(src)) return "kitchen-remodel";
  if (/patio/.test(src)) return src.includes("patio2") ? "patio-2" : "patio-1";
  // repair.webp + handyman.webp share one gallery section
  if (/\/(repair|handyman)\./.test(src)) return "repairs";
  return src.replace(/^\/images\//, "").replace(/\.[a-z]+$/i, "");
}

export function galleryService(
  item: (typeof GALLERY)[number],
): ServiceId {
  if (item.src.includes("flooring")) return "flooring";
  if (item.src.includes("painter")) return "paint";
  if (item.src.includes("punchout")) return "make-ready";
  if (item.src.includes("repair") || item.src.includes("handyman")) {
    return "handyman";
  }
  if (item.src.includes("patio")) return "outdoor";
  if (item.category === "Kitchen" || item.category === "Bath") {
    return "kitchen-bath";
  }
  if (item.category === "Outdoor") return "outdoor";
  return "carpentry";
}

export type GalleryJob = {
  id: string;
  title: string;
  service: ServiceId;
  photos: Array<(typeof GALLERY)[number]>;
};

export function galleryJobs(service?: ServiceId): GalleryJob[] {
  const items = service
    ? GALLERY.filter((item) => galleryService(item) === service)
    : GALLERY;
  const jobs: GalleryJob[] = [];
  const indexById = new Map<string, number>();
  for (const item of items) {
    const id = galleryJobId(item.src);
    const existing = indexById.get(id);
    if (existing === undefined) {
      indexById.set(id, jobs.length);
      jobs.push({
        id,
        title: item.title,
        service: galleryService(item),
        photos: [item],
      });
    } else {
      jobs[existing].photos.push(item);
    }
  }
  return jobs;
}

export function serviceHasWork(id: ServiceId): boolean {
  return GALLERY.some((item) => galleryService(item) === id);
}

export const GALLERY_FILTERS: Array<{ id?: ServiceId; label: string }> = [
  { label: "All" },
  { id: "kitchen-bath", label: "Kitchen & bath" },
  { id: "flooring", label: "Flooring" },
  { id: "paint", label: "Paint" },
  { id: "outdoor", label: "Outdoor" },
  { id: "carpentry", label: "Carpentry" },
  { id: "handyman", label: "Repairs" },
  { id: "make-ready", label: "Make-ready" },
];

export const FAQS = [
  {
    q: "What kind of jobs do you take?",
    a: "Kitchen and bath remodels, flooring, paint, handyman work, outdoor, and make-ready. Alamo Heights, The Dominion, Kerrville, Boerne, San Antonio, and nearby.",
  },
  {
    q: "How do I get a price?",
    a: "Call (210) 436-9117. Pictures help. We'll walk the job if we need to and give you a number.",
  },
  {
    q: "Do you design the work?",
    a: "Yes. Design is handled in-house.",
  },
  {
    q: "Can we stay in the house while you work?",
    a: "Yes. We cover floors and work room by room.",
  },
] as const;

export type EstimateScope = "small" | "medium" | "large";

export const ESTIMATE_TYPES: Array<{
  id: ServiceId;
  label: string;
  ranges: Record<EstimateScope, [number, number]>;
  includes: Record<EstimateScope, string>;
}> = [
  {
    id: "kitchen-bath",
    label: "Kitchen or bath",
    ranges: {
      small: [8000, 18000],
      medium: [18000, 35000],
      large: [35000, 65000],
    },
    includes: {
      small: "Refresh: counters, fixtures, paint, hardware",
      medium: "Cabinets or a full bath",
      large: "Full kitchen or primary bath",
    },
  },
  {
    id: "flooring",
    label: "Floors",
    ranges: {
      small: [2500, 6000],
      medium: [6000, 12000],
      large: [12000, 22000],
    },
    includes: {
      small: "One or two rooms",
      medium: "Main living areas",
      large: "Whole house",
    },
  },
  {
    id: "paint",
    label: "Paint",
    ranges: {
      small: [1500, 3500],
      medium: [3500, 7000],
      large: [7000, 14000],
    },
    includes: {
      small: "A few rooms, patch and two coats",
      medium: "Whole interior, or a modest exterior",
      large: "Inside and out, serious prep",
    },
  },
  {
    id: "make-ready",
    label: "Make-ready",
    ranges: {
      small: [1200, 3500],
      medium: [3500, 7500],
      large: [7500, 15000],
    },
    includes: {
      small: "Touch-up, fixtures, small repairs",
      medium: "Paint, floors, a handful of trades",
      large: "Turnkey unit, ready to show or rent",
    },
  },
  {
    id: "outdoor",
    label: "Outdoor",
    ranges: {
      small: [2500, 6000],
      medium: [6000, 14000],
      large: [14000, 28000],
    },
    includes: {
      small: "Repair, stain, or a section of deck",
      medium: "Patio cover, deck, or firepit",
      large: "Full outdoor setup — pergola, lighting, woodwork",
    },
  },
  {
    id: "handyman",
    label: "Repairs",
    ranges: {
      small: [150, 500],
      medium: [500, 1500],
      large: [1500, 4000],
    },
    includes: {
      small: "A couple of small fixes",
      medium: "A half-day to a full day",
      large: "The list you've been putting off",
    },
  },
];

export const SCOPE_LABELS: Record<EstimateScope, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const LEAD_STORAGE_KEY = "flipfixer-lead-draft";

export type LeadDraft = {
  name?: string;
  email?: string;
  phone?: string;
  service?: ServiceId | "";
  scope?: EstimateScope | "";
  message?: string;
};

export function saveLeadDraft(draft: LeadDraft) {
  if (typeof window === "undefined") return;
  const prev = loadLeadDraft();
  sessionStorage.setItem(
    LEAD_STORAGE_KEY,
    JSON.stringify({ ...prev, ...draft }),
  );
}

export function loadLeadDraft(): LeadDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(LEAD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadDraft) : {};
  } catch {
    return {};
  }
}
