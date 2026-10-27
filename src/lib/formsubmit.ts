import { captureFirstTouchFromWindow } from "./lead-attribution.ts";
import { SITE } from "./site.ts";

export const FORMSUBMIT_AJAX_URL = `https://formsubmit.co/ajax/${encodeURIComponent(SITE.email)}`;
export const FORMSUBMIT_POST_URL = `https://formsubmit.co/${encodeURIComponent(SITE.email)}`;

export type FormSubmitResult = {
  ok: boolean;
  needsConfirm: boolean;
  message: string;
};

/** Shown when FormSubmit did not explicitly accept the lead. */
export const FORM_SUBMIT_UNCONFIRMED =
  "Could not confirm the form was sent. Call instead.";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

/** FormSubmit's first send from a new domain is a confirmation email, not a lead. */
export function parseFormSubmitResponse(
  status: number,
  body: unknown,
): FormSubmitResult {
  const rec = asRecord(body);
  const rawMessage =
    (typeof rec?.message === "string" && rec.message) ||
    (typeof rec?.error === "string" && rec.error) ||
    "";
  const successFlag = rec?.success;
  const success =
    successFlag === true ||
    successFlag === "true" ||
    (typeof successFlag === "string" && successFlag.toLowerCase() === "true");
  const blob = `${rawMessage} ${JSON.stringify(body ?? "")}`.toLowerCase();
  const needsConfirm =
    blob.includes("confirm") ||
    blob.includes("activation") ||
    blob.includes("make sure you confirm");

  if (needsConfirm) {
    return {
      ok: false,
      needsConfirm: true,
      message:
        `Open the FormSubmit confirmation email sent to ${SITE.email}. Until that link is clicked, contact-form leads never arrive.`,
    };
  }

  // Explicit success only. An empty 2xx body is not acceptance evidence.
  if (status >= 200 && status < 300 && success) {
    return { ok: true, needsConfirm: false, message: "Sent." };
  }

  return {
    ok: false,
    needsConfirm: false,
    message: rawMessage || FORM_SUBMIT_UNCONFIRMED,
  };
}

/**
 * Fetch options for FormSubmit's ajax endpoint.
 * No custom headers — `Accept: application/json` triggers a CORS preflight that
 * Cloudflare on formsubmit.co often blocks, forcing every browser into the
 * native redirect path.
 */
export function formSubmitAjaxInit(body: BodyInit): RequestInit {
  return {
    method: "POST",
    body,
    credentials: "omit",
  };
}

/** First-touch click ids and UTMs for this tab. Does not write cookies or call analytics. */
export function captureAdClickIds(): Record<string, string> {
  try {
    return captureFirstTouchFromWindow();
  } catch {
    return {};
  }
}
