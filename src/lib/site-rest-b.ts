export function galleryJobId(src: string): string {
  const numbered = src.match(/gallery-(\d+)/);
  if (numbered) return numbered[1];
  return src.replace(/^\/images\//, "").replace(/\.webp$/, "");
}

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
