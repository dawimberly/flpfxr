/** Shared lead-form validation and delivery result shapes (client + server). */

export const LEAD_API_PATH = "/api/leads";
export const MAX_LEAD_PHOTO_BYTES = 3 * 1024 * 1024;
export const LEAD_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

export type LeadAdIds = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  landing_path?: string;
  page_url?: string;
};

export type LeadPayload = {
  submissionId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  service: string;
  source: string;
  affiliation: string;
  honey: string;
  adIds: LeadAdIds;
};

export type LeadDeliverySuccess = {
  ok: true;
  discarded?: boolean;
  duplicate?: boolean;
  submissionId: string;
};

export type LeadDeliveryFailure = {
  ok: false;
  message: string;
  code?:
    | "validation"
    | "not_configured"
    | "rate_limited"
    | "delivery_failed"
    | "server_error";
};

export type LeadDeliveryResult = LeadDeliverySuccess | LeadDeliveryFailure;

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidSubmissionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim(),
  );
}

export function validateLeadFields(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): { ok: true; phoneDigits: string } | { ok: false; message: string } {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, message: "Add your name so we know who to call back." };
  }
  if (name.length > 120) {
    return { ok: false, message: "Name is too long." };
  }

  const message = input.message.trim();
  if (message.length < 5) {
    return { ok: false, message: "Tell us a bit about the job." };
  }
  if (message.length > 5000) {
    return { ok: false, message: "Message is too long." };
  }

  const phoneDigits = normalizePhoneDigits(input.phone);
  if (phoneDigits.length < 10) {
    return { ok: false, message: "Add a 10-digit phone so we can call you back." };
  }
  if (phoneDigits.length > 15) {
    return { ok: false, message: "Phone number looks invalid." };
  }

  const email = input.email.trim();
  if (email) {
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Email looks invalid. Leave it blank if you prefer." };
    }
  }

  return { ok: true, phoneDigits };
}

export function validateLeadPhoto(file: File | null | undefined): {
  ok: true;
  file: File | null;
} | { ok: false; message: string } {
  if (!file || file.size === 0) return { ok: true, file: null };
  if (file.size > MAX_LEAD_PHOTO_BYTES) {
    return { ok: false, message: "Photo must be under 3 MB." };
  }
  if (file.type && !LEAD_PHOTO_TYPES.has(file.type)) {
    return {
      ok: false,
      message: "Photo must be a JPEG, PNG, WebP, HEIC, or GIF.",
    };
  }
  return { ok: true, file };
}

export function buildLeadEmailText(payload: LeadPayload & { phoneDigits: string }): string {
  const lines = [
    "New lead from theflipfixer.com",
    "",
    `Name: ${payload.name.trim()}`,
    `Phone: ${payload.phone.trim()} (${payload.phoneDigits})`,
    `Email: ${payload.email.trim() || "(none)"}`,
    `Service: ${payload.service || "n/a"}`,
    `Source: ${payload.source || "n/a"}`,
    `Affiliation: ${payload.affiliation || "n/a"}`,
    `Submission: ${payload.submissionId}`,
    "",
    "Message:",
    payload.message.trim(),
    "",
    "Ad / landing:",
    `gclid: ${payload.adIds.gclid || ""}`,
    `gbraid: ${payload.adIds.gbraid || ""}`,
    `wbraid: ${payload.adIds.wbraid || ""}`,
    `utm_source: ${payload.adIds.utm_source || ""}`,
    `utm_campaign: ${payload.adIds.utm_campaign || ""}`,
    `utm_medium: ${payload.adIds.utm_medium || ""}`,
    `landing_path: ${payload.adIds.landing_path || ""}`,
    `page_url: ${payload.adIds.page_url || ""}`,
  ];
  return lines.join("\n");
}

export function buildLeadSubject(service: string, source: string): string {
  return `The Flip Fixer — ${service || "job"} (${source || "contact"})`;
}

/** Client parsing of /api/leads JSON. */
export function parseLeadApiResponse(
  status: number,
  body: unknown,
): LeadDeliveryResult {
  const rec =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (status >= 200 && status < 300 && rec?.ok === true) {
    return {
      ok: true,
      discarded: rec.discarded === true,
      duplicate: rec.duplicate === true,
      submissionId: typeof rec.submissionId === "string" ? rec.submissionId : "",
    };
  }
  const message =
    (typeof rec?.message === "string" && rec.message) ||
    "Could not send the form. Call or text instead.";
  const code = typeof rec?.code === "string" ? (rec.code as LeadDeliveryFailure["code"]) : undefined;
  return { ok: false, message, code };
}

export function shouldTrackAcceptedLead(result: LeadDeliveryResult): result is LeadDeliverySuccess {
  return result.ok === true && result.discarded !== true;
}

/** sessionStorage key — one Ads conversion claim per submission UUID. */
export const LEAD_CONVERSION_CLAIM_PREFIX = "ff-ads-lead-tracked:";

/**
 * Claim the Ads lead conversion for this submissionId once per browser session.
 * Retries after an uncertain response reuse the same id (and Resend Idempotency-Key)
 * and must not fire a second conversion.
 */
export function claimAcceptedLeadConversion(submissionId: string): boolean {
  const id = submissionId.trim();
  if (!isValidSubmissionId(id)) return false;
  if (typeof window === "undefined") return false;
  const key = `${LEAD_CONVERSION_CLAIM_PREFIX}${id.toLowerCase()}`;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Private mode / blocked storage — still allow one in-memory claim via Map.
  }
  const g = globalThis as typeof globalThis & {
    __ffLeadConversionClaims__?: Set<string>;
  };
  g.__ffLeadConversionClaims__ ??= new Set();
  if (g.__ffLeadConversionClaims__.has(key)) return false;
  g.__ffLeadConversionClaims__.add(key);
  return true;
}
