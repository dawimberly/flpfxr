/**
 * Styles by Design referral catalog. Browse-only: the shop page has a
 * "Request a designer call" button. Purchases are not taken there.
 * Default: https://stylesbydesigntx.com/shop?ref=flipfixer
 */
export const CATALOG_REF = "flipfixer";
export const DEFAULT_SBD_CATALOG_BASE = "https://stylesbydesigntx.com";
export const DEFAULT_SBD_CATALOG_PATH = "/shop";

export const CATALOG_SOURCE = "sbd_catalog";

export const CATALOG_PROJECT_TYPES = [
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "closet", label: "Closet" },
  { id: "whole-home", label: "Whole home" },
  { id: "other", label: "Other" },
] as const;

export type CatalogProjectId = (typeof CATALOG_PROJECT_TYPES)[number]["id"];

export function catalogProjectLabel(id: string): string | null {
  return CATALOG_PROJECT_TYPES.find((row) => row.id === id)?.label ?? null;
}

export function catalogSignupMessage(projectLabel: string): string {
  return `Cabinet catalog signup. Project type: ${projectLabel}. Wants the full cabinet catalog at 15% off retail. The catalog is browse-only and includes a Request a designer call button. A Flip Fixer designer will call to finalize cabinets, fillers, toe kick, and baseboard.`;
}

function safeBase(raw: string): URL {
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url;
  } catch {
    // fall through
  }
  return new URL(DEFAULT_SBD_CATALOG_BASE);
}

function safePath(raw: string): string {
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.includes("\\") || path.includes("?")) {
    return DEFAULT_SBD_CATALOG_PATH;
  }
  return path;
}

/** Absolute catalog URL with ?ref=flipfixer. Ignores any other query string. */
export function catalogRedirectUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base = safeBase((env.SBD_CATALOG_BASE_URL || DEFAULT_SBD_CATALOG_BASE).trim());
  const path = safePath(env.SBD_CATALOG_PATH || DEFAULT_SBD_CATALOG_PATH);
  const url = new URL(path, base);
  if (url.origin !== base.origin) {
    url.href = new URL(DEFAULT_SBD_CATALOG_PATH, new URL(DEFAULT_SBD_CATALOG_BASE)).href;
  }
  url.search = "";
  url.hash = "";
  url.searchParams.set("ref", CATALOG_REF);
  return url.toString();
}
