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
    role: "Owner",
    src: "/images/crew-jon.webp",
    line: "30 years on the tools. He designs the remodel and builds it.",
    bio: "Jon has 30 years framing, finishing, and running jobs as a general contractor. He designs the remodel, then builds it. He walks the house and lays out the plan.",
  },
  {
    name: "Dan Wimberly",
    role: "Estimating & Project Coordination",
    src: "/images/crew-dan-v3.webp",
    line: "15 years as a contractor. He writes the scope, prices the job, and works it.",
    bio: "Dan has 15 years as a contractor. He writes the scope, sets the price, and works the job with Jon. On insurance rebuilds he catches what the carrier left out, and he has regularly secured 20-50% increases in approved scope.",
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
    body: "We walk the house with you. We look at what's worth doing and what isn't. No pressure — just clarity.",
  },
  {
    step: "2",
    title: "One clear price",
    body: "What's included, what isn't, and a date you can count on. That's the number.",
  },
  {
    step: "3",
    title: "Daily cleanup",
    body: "We work carefully and leave the place livable every afternoon. You can still come home.",
  },
  {
    step: "4",
    title: "Final walkthrough",
    body: "We walk every room with you before we call it done. Then the house is yours again.",
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

export * from "./site-rest-a";
export * from "./site-rest-b";
