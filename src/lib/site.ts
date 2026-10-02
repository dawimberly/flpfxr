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
