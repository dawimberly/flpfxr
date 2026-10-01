export const SITE = {
  name: "The Flip Fixer",
  legalName: "The Flip Fixer",
  tagline:
    "Kitchen and bath remodels, flooring, paint, make-ready, and insurance claim rebuilds.",
  phone: "2104369117",
  phoneDisplay: "(210) 436-9117",
  email: "Jon@TheFlipFixer.com",
  city: "San Antonio, TX",
  url: "https://theflipfixer.com",
  owner: "Jon",
} as const;

export const CREW = [
  {
    name: "Jon Styles",
    src: "/images/crew-jon.webp",
    line: "30+ years on the tools. Design in-house.",
  },
  {
    name: "Dan Wimberly",
    src: "/images/crew-dan.webp",
    line: "Estimates and project coordination. Kitchen, bath, and insurance scopes — 10+ years Xactimate.",
  },
] as const;

/** Same-origin employee estimator (gated at /login). */
export const ESTIMATOR_APP_URL = "/estimator";

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/about", label: "About" },
  { to: "/community", label: "Community" },
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
  | "kitchen"
  | "bathroom"
  | "flooring"
  | "paint"
  | "handyman"
  | "outdoor"
  | "make-ready"
  | "roofing"
  | "insurance-claims"
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
    image: "/images/flooring.webp",
    group: "Remodels",
  },
  {
    id: "paint",
    title: "Paint",
    short: "Interior and exterior, prepped right.",
    body: "Interior and exterior. Prep first, then paint.",
    image: "/images/gallery-08-a.webp",
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
    image: "/images/staircase.webp",
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
    id: "roofing",
    title: "Roofing",
    short: "Measure the roof. Get a planning range.",
    body: "Type the address. We outline that roof, you pick pitch and shingles, and we give a planning range. Then we walk it.",
    image: "/images/gallery-22-d.webp",
    group: "Specialty",
  },
  {
    id: "insurance-claims",
    title: "Insurance claims",
    short: "Fire and storm rebuilds.",
    body: "Insurance claim rebuilds — tear-out through finish. Full restore after fire or storm damage.",
    image: "/images/gallery-22-f.webp",
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

export const COMMUNITY = {
  title: "If you have the house, we bring the labor.",
  intro:
    "If you run a group home, work with CASA, or serve military families, first responders, or educators in San Antonio, this is the start of a partnership. We design the kitchen or bath and donate the labor. We need partners to cover materials — grants, donations, churches, civic groups, and vendors.",
  subject: "community partnership",
  lanes: [
    {
      title: "If the kitchen is the room that needs to work",
      body: "Send the house, the room, and photos. We design it, write the takeoff, and put free labor on it. Mentoring on the work is part of the visit, so the people who live there can keep the room.",
    },
    {
      title: "If you have a grant, a gift, or product to give",
      body: "A material list with real numbers is what a grant or a donor can attach to. We price the takeoff in plain language. You cover cabinets, counters, and fixtures. We cover design and labor.",
    },
    {
      title: "If you are 65+, military, first responder, or an educator",
      body: "Ask when you call. Seniors, military, first responders, and educators: 5% under $10,000, 10% at $10,000 and up. One discount per job — they do not stack. Bring ID or a work email if you have it.",
    },
    {
      title: "If you already know which house comes next",
      body: "Sit with us on the application. We put a design, a takeoff, and donated labor on the page so the ask is concrete.",
    },
  ],
  split: [
    {
      who: "We give",
      what: "Design, the list, free labor, and training on the work.",
    },
    {
      who: "A partner gives",
      what: "A grant, a donation, gifted product, or a group ready to cover materials.",
    },
    {
      who: "The house gets",
      what: "A kitchen or bath that can be used, and people on site who know how to keep it.",
    },
  ],
  kinds: [
    "A group home",
    "CASA or child-advocacy",
    "Senior (65+), military, veteran, first responder, or educator",
    "A grant writer or foundation",
    "A donor, church, or civic partner",
    "A vendor who can gift materials",
    "A partner in another form",
  ],
  funded: [
    { value: "", label: "Still mapping this" },
    { value: "Funded — looking for design and labor", label: "Funded — looking for design and labor" },
    { value: "Partly funded", label: "Partly funded" },
    { value: "Ready to pursue a grant or donations together", label: "Ready to pursue a grant or donations together" },
    { value: "Ready to donate or gift product", label: "Ready to donate or gift product" },
  ],
} as const;

export const CONTACT_AFFILIATIONS = [
  { value: "", label: "Doesn't apply" },
  { value: "Senior (65+)", label: "Senior (65+)" },
  { value: "Military or veteran", label: "Military or veteran" },
  { value: "First responder", label: "First responder" },
  { value: "Educator", label: "Educator" },
] as const;

/** Two public bands. Eligible groups share the same rate. They do not stack. */
export const JOB_DISCOUNT =
  "Seniors 65+, military, first responders, and educators: 5% under $10,000, 10% at $10,000 and up. One discount per job — they do not stack.";

export const TESTIMONIALS = [
  {
    quote:
      "Jon and his team have been awesome to work with. The value they provide for the cost is unbeatable. Jon is talented and responsive. I highly recommend him for all your home repair needs!",
    name: "Michael M.",
    place: "San Antonio, TX",
  },
  {
    quote:
      "The Flip Fixer transformed my outdated rental property within my budget. Jon's attention to detail and craftsmanship is outstanding. I had multiple offers after just one open house!",
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
      "As a property manager, I need reliable contractors I can trust. The Flip Fixer has become our go-to for all maintenance and renovation needs. Always professional and on time.",
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
    src: "/images/gallery-23-a.webp",
    alt: "Kitchen before the remodel",
    title: "Kitchen remodel",
    caption: "Before",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-23-b.webp",
    alt: "Kitchen tear-out during the remodel",
    title: "Kitchen remodel",
    caption: "Tear-out",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-23-c.webp",
    alt: "Cabinets going in during the remodel",
    title: "Kitchen remodel",
    caption: "Cabinets in",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-23-d.webp",
    alt: "Kitchen after the remodel, sink run",
    title: "Kitchen remodel",
    caption: "After",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-23-e.webp",
    alt: "Kitchen after the remodel, peninsula",
    title: "Kitchen remodel",
    caption: "After",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-01-a.webp",
    alt: "Farmhouse kitchen by The Flip Fixer",
    title: "Farmhouse kitchen",
    caption: "Farmhouse kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-01-b.webp",
    alt: "Farmhouse kitchen by The Flip Fixer",
    title: "Farmhouse kitchen",
    caption: "Farmhouse kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-01-c.webp",
    alt: "Farmhouse kitchen by The Flip Fixer",
    title: "Farmhouse kitchen",
    caption: "Farmhouse kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-02-a.webp",
    alt: "Navy island kitchen by The Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-02-b.webp",
    alt: "Navy island kitchen by The Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-02-c.webp",
    alt: "Navy island kitchen by The Flip Fixer",
    title: "Navy island kitchen",
    caption: "Navy island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-03-a.webp",
    alt: "Charcoal kitchen by The Flip Fixer",
    title: "Charcoal kitchen",
    caption: "Charcoal kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-03-b.webp",
    alt: "Charcoal kitchen by The Flip Fixer",
    title: "Charcoal kitchen",
    caption: "Charcoal kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-03-c.webp",
    alt: "Charcoal kitchen by The Flip Fixer",
    title: "Charcoal kitchen",
    caption: "Charcoal kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-05-a.webp",
    alt: "Two-tone kitchen by The Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-05-b.webp",
    alt: "Two-tone kitchen by The Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-05-c.webp",
    alt: "Two-tone kitchen by The Flip Fixer",
    title: "Two-tone kitchen",
    caption: "Two-tone kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-06-a.webp",
    alt: "Open kitchen by The Flip Fixer",
    title: "Open kitchen",
    caption: "Open kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-06-b.webp",
    alt: "Open kitchen by The Flip Fixer",
    title: "Open kitchen",
    caption: "Open kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-06-c.webp",
    alt: "Open kitchen living area by The Flip Fixer",
    title: "Open kitchen",
    caption: "Open kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-10-a.webp",
    alt: "Dark wood kitchen by The Flip Fixer",
    title: "Dark wood kitchen",
    caption: "Dark wood kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-10-b.webp",
    alt: "Dark wood kitchen by The Flip Fixer",
    title: "Dark wood kitchen",
    caption: "Dark wood kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-08-a.webp",
    alt: "Gray shaker kitchen by The Flip Fixer",
    title: "Gray shaker kitchen",
    caption: "Gray shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-08-b.webp",
    alt: "Gray shaker kitchen by The Flip Fixer",
    title: "Gray shaker kitchen",
    caption: "Gray shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-08-c.webp",
    alt: "Gray shaker kitchen by The Flip Fixer",
    title: "Gray shaker kitchen",
    caption: "Gray shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-09-a.webp",
    alt: "White kitchen, black island by The Flip Fixer",
    title: "White kitchen, black island",
    caption: "White kitchen, black island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-09-b.webp",
    alt: "White kitchen, black island by The Flip Fixer",
    title: "White kitchen, black island",
    caption: "White kitchen, black island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-09-c.webp",
    alt: "White kitchen, black island by The Flip Fixer",
    title: "White kitchen, black island",
    caption: "White kitchen, black island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-13-a.webp",
    alt: "Granite breakfast bar by The Flip Fixer",
    title: "Granite breakfast bar",
    caption: "Granite breakfast bar",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-14-a.webp",
    alt: "Cream kitchen by The Flip Fixer",
    title: "Cream kitchen",
    caption: "Cream kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-15-a.webp",
    alt: "Navy island by The Flip Fixer",
    title: "Navy island",
    caption: "Navy island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-16-a.webp",
    alt: "Charcoal island by The Flip Fixer",
    title: "Charcoal island",
    caption: "Charcoal island",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-17-a.webp",
    alt: "Navy island with gold accents by The Flip Fixer",
    title: "Navy gold kitchen",
    caption: "Navy gold kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-18-a.webp",
    alt: "Gray and white kitchen by The Flip Fixer",
    title: "Gray and white kitchen",
    caption: "Gray and white kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-18-b.webp",
    alt: "Gray and white kitchen by The Flip Fixer",
    title: "Gray and white kitchen",
    caption: "Gray and white kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-18-c.webp",
    alt: "Gray and white kitchen by The Flip Fixer",
    title: "Gray and white kitchen",
    caption: "Gray and white kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-19-a.webp",
    alt: "White shaker kitchen by The Flip Fixer",
    title: "White shaker kitchen",
    caption: "White shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-19-b.webp",
    alt: "White shaker kitchen by The Flip Fixer",
    title: "White shaker kitchen",
    caption: "White shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-19-c.webp",
    alt: "White shaker kitchen by The Flip Fixer",
    title: "White shaker kitchen",
    caption: "White shaker kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-20-a.webp",
    alt: "Modern white kitchen by The Flip Fixer",
    title: "Modern white kitchen",
    caption: "Modern white kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-20-b.webp",
    alt: "Modern white kitchen by The Flip Fixer",
    title: "Modern white kitchen",
    caption: "Modern white kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-21-a.webp",
    alt: "Bath remodel by The Flip Fixer",
    title: "Bath remodel",
    caption: "Bath remodel",
    category: "Bath",
  },
  {
    src: "/images/gallery-21-b.webp",
    alt: "Bath remodel by The Flip Fixer",
    title: "Bath remodel",
    caption: "Bath remodel",
    category: "Bath",
  },
  {
    src: "/images/gallery-21-c.webp",
    alt: "Bath remodel by The Flip Fixer",
    title: "Bath remodel",
    caption: "Bath remodel",
    category: "Bath",
  },
  {
    src: "/images/gallery-22-a.webp",
    alt: "Roof work by The Flip Fixer",
    title: "Roof",
    caption: "Roof",
    category: "Outdoor",
  },
  {
    src: "/images/gallery-22-b.webp",
    alt: "Roof work by The Flip Fixer",
    title: "Roof",
    caption: "Roof",
    category: "Outdoor",
  },
  {
    src: "/images/gallery-22-c.webp",
    alt: "Roof work by The Flip Fixer",
    title: "Roof",
    caption: "Roof",
    category: "Outdoor",
  },
  {
    src: "/images/gallery-22-d.webp",
    alt: "Roof work by The Flip Fixer",
    title: "Roof",
    caption: "Roof",
    category: "Outdoor",
  },
  {
    src: "/images/gallery-22-e.webp",
    alt: "Roof work by The Flip Fixer",
    title: "Roof",
    caption: "Roof",
    category: "Outdoor",
  },
  {
    src: "/images/gallery-22-f.webp",
    alt: "Insurance rebuild by The Flip Fixer",
    title: "Insurance rebuild",
    caption: "Insurance rebuild",
    category: "Custom",
  },
  {
    src: "/images/gallery-24-a.webp",
    alt: "White island kitchen by The Flip Fixer",
    title: "White island kitchen",
    caption: "White island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-24-b.webp",
    alt: "White island kitchen by The Flip Fixer",
    title: "White island kitchen",
    caption: "White island kitchen",
    category: "Kitchen",
  },
  {
    src: "/images/gallery-24-c.webp",
    alt: "White island kitchen by The Flip Fixer",
    title: "White island kitchen",
    caption: "White island kitchen",
    category: "Kitchen",
  },
];

export const BEFORE_AFTER = [
  {
    title: "Kitchen remodel",
    before: "/images/gallery-23-a.webp",
    after: "/images/gallery-23-d.webp",
  },
  {
    title: "Kitchen remodel",
    before: "/images/gallery-23-a.webp",
    after: "/images/gallery-23-e.webp",
  },
];

export const GALLERY_FILTERS: Array<{
  label: string;
  id?: ServiceId;
  view?: "before-after";
}> = [
  { label: "All" },
  { label: "Kitchen", id: "kitchen" },
  { label: "Bath", id: "bathroom" },
  { label: "Before / After", view: "before-after" },
];

export const FAQS = [
  {
    q: "How long does a kitchen take?",
    a: "Most kitchens are two to four weeks once materials are on site. We give you a date when we price the job.",
  },
  {
    q: "Do you handle permits?",
    a: "Yes. When the scope needs a permit, we pull it and schedule the inspections.",
  },
  {
    q: "Can I live in the house during the work?",
    a: "Usually yes. We work room by room, cover floors, and clean up every day so you can still use the rest of the house.",
  },
  {
    q: "How do I get a price?",
    a: "Call or text. We’ll walk the job, tell you what’s worth doing, and give you one number.",
  },
];

export type EstimateScope = "small" | "medium" | "large";
export type RoomScope = EstimateScope | "none";

export const SCOPE_LABELS: Record<EstimateScope, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const ESTIMATE_TYPES: Array<{
  id: ServiceId;
  label: string;
  ranges: Record<EstimateScope, [number, number]>;
  includes: Record<EstimateScope, string>;
}> = [
  {
    id: "kitchen-bath",
    label: "Kitchen",
    ranges: {
      small: [12000, 22000],
      medium: [22000, 38000],
      large: [38000, 65000],
    },
    includes: {
      small: "Cabinets, counters, sink, faucet, basic tile backsplash.",
      medium: "Cabinets, counters, appliances, tile, lighting, hardware.",
      large: "Full gut, layout change, cabinets, counters, appliances, tile, lighting.",
    },
  },
  {
    id: "bathroom",
    label: "Bath",
    ranges: {
      small: [6000, 11000],
      medium: [11000, 18000],
      large: [18000, 32000],
    },
    includes: {
      small: "Vanity, toilet, fixtures, paint, basic tile.",
      medium: "Vanity, tub or shower, tile, fixtures, paint.",
      large: "Full gut, layout change, tub/shower, tile, vanity, fixtures.",
    },
  },
];

export type LeadDraft = Record<string, string | undefined>;

export const LEAD_STORAGE_KEY = "ff-lead-draft";

export function saveLeadDraft(draft: LeadDraft) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadLeadDraft();
    sessionStorage.setItem(
      LEAD_STORAGE_KEY,
      JSON.stringify({ ...prev, ...draft }),
    );
  } catch {
    // ignore
  }
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
