import { GALLERY } from "./site-rest-a.ts";

export function galleryJobId(src: string): string {
  const numbered = src.match(/gallery-(\d+)/);
  if (numbered) return numbered[1];
  return src.replace(/^\/images\//, "").replace(/\.webp$/, "");
}

export function galleryService(item: { category: string }): string | null {
  const map: Record<string, string> = {
    Kitchen: "kitchen-bath",
    Bath: "kitchen-bath",
    Outdoor: "outdoor",
    Interior: "paint",
    Custom: "consulting",
  };
  return map[item.category] ?? null;
}

export function serviceHasWork(_id: string): boolean {
  return true;
}

export type GalleryPhoto = {
  src: string;
  alt: string;
  title: string;
  caption: string;
  category: string;
};

export type GalleryJob = {
  id: string;
  title: string;
  service: string | null;
  photos: GalleryPhoto[];
};

/** Group GALLERY photos into jobs by gallery-NN prefix (or full stem). */
export function galleryJobs(service?: string): GalleryJob[] {
  const byId = new Map<string, GalleryJob>();

  for (const item of GALLERY) {
    const id = galleryJobId(item.src);
    const svc = galleryService(item);
    if (service && svc !== service) continue;

    let job = byId.get(id);
    if (!job) {
      job = {
        id,
        title: item.title,
        service: svc,
        photos: [],
      };
      byId.set(id, job);
    }
    job.photos.push(item);
  }

  return Array.from(byId.values());
}

/** Jobs that have before/after (or process) captions. */
export function isBeforeAfterJob(job: GalleryJob): boolean {
  const labels = job.photos.map((p) => (p.caption || "").toLowerCase());
  return (
    labels.some((c) => c.includes("before")) &&
    labels.some((c) => c.includes("after"))
  );
}

export const GALLERY_FILTERS: Array<{
  label: string;
  id?: string;
  view?: "before-after";
}> = [
  { label: "All" },
  { label: "Kitchen & bath", id: "kitchen-bath" },
  { label: "Flooring", id: "flooring" },
  { label: "Paint", id: "paint" },
  { label: "Outdoor", id: "outdoor" },
  { label: "Before & after", view: "before-after" },
];

export const FAQS = [
  {
    q: "What kind of jobs do you take?",
    a: "We focus on indoor, full-room kitchen and bathroom remodels. We also do flooring, paint, handyman work, outdoor, make-ready, and insurance claim rebuilds. Tell us about the room and what you want to change. Alamo Heights, The Dominion, Kerrville, Boerne, San Antonio, and nearby.",
  },
  {
    q: "How do I get a price?",
    a: "Call (210) 436-9117 or send the form on the homepage. Tell us about the room and what you want to change. Photos help. We'll walk the house with you and give you a clear number.",
  },
  {
    q: "Do you design the work?",
    a: "Yes. Design is handled in-house.",
  },
  {
    q: "Can we stay in the house while you work?",
    a: "Yes. We cover floors, work room by room, and clean up every day so you can still live here.",
  },
  {
    q: "Do you offer a senior or military discount?",
    a: `Yes. Seniors 65+, military, first responders, and educators: ask us about available discounts. One discount per job — they do not stack. Eligibility is confirmed when we accept the job. Ask when you call. Bring ID or a work email if you have it.`,
  },
] as const;

export const LEAD_STORAGE_KEY = "flipfixer-lead-draft";

export type LeadDraft = {
  name?: string;
  address?: string;
  pitchId?: string;
  pitch?: string;
  roofSize?: string;
  shingleId?: string;
  email?: string;
  phone?: string;
  affiliation?: string;
  service?: string;
  scope?: string;
  kitchenScope?: string;
  bathroomScope?: string;
  message?: string;
  /** In-flight / retry id so remounts keep the same Resend Idempotency-Key. */
  submissionId?: string;
};

// Keep retries usable when a browser denies sessionStorage access.
let inMemoryLeadDraft: LeadDraft | null = null;

export function saveLeadDraft(draft: LeadDraft) {
  if (typeof window === "undefined") return;
  const prev = loadLeadDraft();
  inMemoryLeadDraft = { ...prev, ...draft };
  try {
    sessionStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(inMemoryLeadDraft));
  } catch {
    // A blocked draft cache must not prevent the actual lead request.
  }
}

export function loadLeadDraft(): LeadDraft {
  if (typeof window === "undefined") return {};
  if (inMemoryLeadDraft) return inMemoryLeadDraft;
  try {
    const raw = sessionStorage.getItem(LEAD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadDraft) : {};
  } catch {
    return {};
  }
}

/** Legacy ballpark selector: price ranges withheld until scope-matched values are verified. */
export type EstimateScope = "small" | "medium" | "large";
export type RoomScope = EstimateScope | "none";
export const SCOPE_LABELS: Record<EstimateScope, string> = { small: "Small", medium: "Medium", large: "Large" };
type LegacyService = import("./site.ts").ServiceId;
type LegacyEstimateType = { id: LegacyService; label: string; ranges: Record<EstimateScope, [number, number] | null>; includes: Record<EstimateScope, string> };
const noRanges = { small: null, medium: null, large: null };
const description = { small: "Final scope and materials require an on-site assessment.", medium: "Final scope and materials require an on-site assessment.", large: "Final scope and materials require an on-site assessment." };
export const ESTIMATE_TYPES: LegacyEstimateType[] = [
  { id: "kitchen", label: "Kitchen remodeling", ranges: noRanges, includes: description },
  { id: "bathroom", label: "Bathroom remodeling", ranges: noRanges, includes: description },
  { id: "flooring", label: "Flooring", ranges: noRanges, includes: description },
  { id: "paint", label: "Painting", ranges: noRanges, includes: description },
  { id: "handyman", label: "Handyman", ranges: noRanges, includes: description },
  { id: "make-ready", label: "Make-ready", ranges: noRanges, includes: description },
];
