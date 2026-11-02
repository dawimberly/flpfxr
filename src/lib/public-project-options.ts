/** Draft planning ranges recovered from src/lib/site.ts before c9b2824 (2026-10-02).
 * Historical prices, not newly validated estimates. Review before publishing.
 * Keep daily labor rates and employee catalog data out of this public module.
 */
export type ProjectService = "kitchen" | "bathroom";
export type ProjectSize = "small" | "medium" | "large";
export const PROJECT_SIZES = ["small", "medium", "large"] as const;
export const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" } as const;
export const PROJECTS = {
  kitchen: {
    label: "Kitchen remodeling",
    image: "/images/gallery-23-d.webp",
    alt: "Completed kitchen remodel by The Flip Fixer",
    scopes: {
      small: { range: [4000, 9000], title: "A kitchen refresh", includes: "Counters, fixtures and paint.", note: "Keep the existing layout and cabinets." },
      medium: { range: [12000, 25000], title: "A full-room update", includes: "Stock cabinets, counters and floors.", note: "Keep the main layout; selections affect the total." },
      large: { range: [25000, 45000], title: "A more extensive remodel", includes: "Full kitchen with cabinets, quartz and tile or LVP.", note: "Layout changes and specialty work require an on-site assessment." },
    },
  },
  bathroom: {
    label: "Bathroom remodeling",
    image: "/images/gallery-26-b.webp",
    alt: "Completed glass-enclosed shower by The Flip Fixer",
    scopes: {
      small: { range: [3000, 7000], title: "A bathroom refresh", includes: "Vanity, fixtures and paint.", note: "Keep the existing tub or shower and layout." },
      medium: { range: [8000, 16000], title: "A full bath remodel", includes: "A complete bathroom update.", note: "Fixtures, finishes and existing conditions affect the total." },
      large: { range: [15000, 28000], title: "A primary bath remodel", includes: "Primary bathroom with a tile shower.", note: "Shower size, selections and specialty work affect the total." },
    },
  },
} as const;

export function projectSelection(service: ProjectService, size: ProjectSize) {
  if (!Object.prototype.hasOwnProperty.call(PROJECTS, service) || !PROJECT_SIZES.includes(size)) {
    throw new Error("Choose a supported project and size");
  }
  const project = PROJECTS[service];
  const scope = project.scopes[size];
  const format = (n: number) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
  const rangeText = format(scope.range[0]) + "–" + format(scope.range[1]);
  return {
    service, size, label: project.label, ...scope, rangeText,
    message: "I'd like an on-site estimate for " + project.label.toLowerCase() +
      " (" + size + " scope). Planning range: " + rangeText + ". " +
      scope.includes + " " + scope.note +
      " This is a planning estimate, not a quote; please confirm scope and price on site.",
  };
}
