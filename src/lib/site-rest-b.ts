import { GALLERY } from "./site-rest-a";
import type { ServiceId } from "./site";

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
export function galleryJobs(service?: ServiceId): GalleryJob[] {
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
  id?: ServiceId;
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
    a: "Kitchen and bath remodels, flooring, paint, handyman work, outdoor, make-ready, and insurance claim rebuilds. Alamo Heights, The Dominion, Kerrville, Boerne, San Antonio, and nearby.",
  },
  {
    q: "How do I get a price?",
    a: "Call (210) 436-9117 or send the form on the homepage. Photos help. We'll walk the house with you and give you a clear number.",
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
    a: `Yes. Seniors 65+, military, first responders, and educators: 5% under $10,000, 10% at $10,000 and up. One discount per job — they do not stack. Ask when you call. Bring ID or a work email if you have it.`,
  },
] as const;

export const LEAD_STORAGE_KEY = "flipfixer-lead-draft";

export type LeadDraft = {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  scope?: string;
  kitchenScope?: string;
  bathroomScope?: string;
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
