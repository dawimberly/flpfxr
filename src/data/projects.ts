export type ProjectTemplate = {
  service: "kitchen" | "bathroom";
  published: boolean;
  photo: string;
  neighborhood: string;
  wanted: string;
  work: string;
  timeline: string;
};

// Replace every placeholder with verified project details before publishing.
export const PROJECTS: ProjectTemplate[] = [
  { service: "kitchen", published: false, photo: "/images/gallery-23-d.webp", neighborhood: "[NEIGHBORHOOD]", wanted: "[WHAT THE CUSTOMER WANTED]", work: "[WHAT WE DID]", timeline: "[TIMELINE]" },
  { service: "kitchen", published: false, photo: "/images/gallery-01-a.webp", neighborhood: "[NEIGHBORHOOD]", wanted: "[WHAT THE CUSTOMER WANTED]", work: "[WHAT WE DID]", timeline: "[TIMELINE]" },
  { service: "bathroom", published: false, photo: "/images/gallery-26-b.webp", neighborhood: "[NEIGHBORHOOD]", wanted: "[WHAT THE CUSTOMER WANTED]", work: "[WHAT WE DID]", timeline: "[TIMELINE]" },
  { service: "bathroom", published: false, photo: "/images/gallery-27-a.webp", neighborhood: "[NEIGHBORHOOD]", wanted: "[WHAT THE CUSTOMER WANTED]", work: "[WHAT WE DID]", timeline: "[TIMELINE]" },
];
