import {
  isValidSubmissionId,
  validateLeadFields,
  type LeadAdIds,
} from "./lead-delivery.ts";

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    ""
  );
}

export function publicOrigin(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "";
  if ((proto === "https" || proto === "http") && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

const AD_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "landing_path",
  "first_landing_path",
  "page_url",
] as const;

export function readAdIds(form: FormData): LeadAdIds {
  const adIds: LeadAdIds = {};
  for (const key of AD_KEYS) {
    const value = formString(form, key).trim();
    if (value) adIds[key] = value.slice(0, 500);
  }
  return adIds;
}

export function isHoneypot(form: FormData): boolean {
  return Boolean((formString(form, "_honey") || formString(form, "company")).trim());
}

export function requireContact(form: FormData, message: string) {
  const submissionId = formString(form, "submissionId").trim();
  if (!isValidSubmissionId(submissionId)) {
    return { ok: false as const, message: "Could not send the form. Refresh and try again, or call." };
  }
  const fields = validateLeadFields({
    name: formString(form, "name"),
    email: formString(form, "email"),
    phone: formString(form, "phone"),
    message,
  });
  if (!fields.ok) return { ok: false as const, message: fields.message };
  const email = formString(form, "email").trim();
  return {
    ok: true as const,
    submissionId,
    name: formString(form, "name").trim(),
    email,
    phone: formString(form, "phone").trim(),
    phoneDigits: fields.phoneDigits,
  };
}
