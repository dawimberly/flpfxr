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

// RESTORE IN PROGRESS - full file in artifacts/flpfxr-site.ts.restore
// Temporary minimal stub to unblock - WILL BE REPLACED
export const CREW = [] as const;
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
export const SERVICE_AREAS = ["San Antonio"] as const;
export const AREA_LINE = "San Antonio.";
export type ServiceId = "kitchen-bath" | "kitchen" | "bathroom" | "flooring" | "paint" | "handyman" | "outdoor" | "make-ready" | "roofing" | "insurance-claims" | "consulting";
export const SERVICES: Array<{id: ServiceId; title: string; short: string; body: string; image: string; group: "Remodels" | "Make-ready" | "Repairs" | "Specialty"}> = [];
export const STATS = [] as const;
export const VALUES = [] as const;
export const PROCESS = [] as const;
export const COMMUNITY = { title: "", intro: "", subject: "", lanes: [], split: [], kinds: [], funded: [] } as const;
export const CONTACT_AFFILIATIONS = [] as const;
export const JOB_DISCOUNT = "";
export const TESTIMONIALS = [] as const;
export const GALLERY: Array<{src: string; alt: string; title: string; caption: string; category: "Kitchen" | "Bath" | "Outdoor" | "Interior" | "Custom"}> = [];
export const BEFORE_AFTER = [] as const;
export const GALLERY_FILTERS: Array<{label: string; id?: ServiceId; view?: "before-after"}> = [{label: "All"}];
export const FAQS = [] as const;
export const HOME_BEST_WORK: Array<{ src: string; alt: string; title: string }> = [
  { src: "/images/gallery-23-d.webp", alt: "Herringbone floor kitchen after remodel", title: "Kitchen remodel" },
  { src: "/images/gallery-17-a.webp", alt: "Navy island kitchen with gold fixtures", title: "Kitchen remodel" },
  { src: "/images/gallery-01-a.webp", alt: "Farmhouse kitchen with large island", title: "Kitchen remodel" },
  { src: "/images/gallery-03-a.webp", alt: "Charcoal and gray remodeled kitchen", title: "Kitchen remodel" },
];
export type EstimateScope = "small" | "medium" | "large";
export type RoomScope = EstimateScope | "none";
export const SCOPE_LABELS: Record<EstimateScope, string> = { small: "Small", medium: "Medium", large: "Large" };
export const ESTIMATE_TYPES: Array<{id: ServiceId; label: string; ranges: Record<EstimateScope, [number, number]>; includes: Record<EstimateScope, string>}> = [];
export type LeadDraft = Record<string, string | undefined>;
export const LEAD_STORAGE_KEY = "ff-lead-draft";
export function saveLeadDraft(_d: LeadDraft) {}
export function loadLeadDraft(): LeadDraft { return {}; }
