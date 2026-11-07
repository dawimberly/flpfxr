/**
 * Strict phone normalization for estimate follow-up leads.
 * Rejects injection-prone or unbounded input; stores only a canonical US form.
 */

const MAX_PHONE_INPUT_CHARS = 32;

function hasDisallowedControls(raw: string) {
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

/** Digits-only from a string (no validation). */
export function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

/**
 * Accept common US formatting; reject letters, URLs, newlines, oversized input,
 * and non-10-digit results (after stripping a leading country-code 1).
 * Returns canonical E.164-ish national digits + display form for notifications.
 */
export function normalizeEstimatePhone(raw: string):
  | { ok: true; digits: string; display: string }
  | { ok: false; message: string } {
  if (!raw.trim()) {
    return { ok: false, message: "Add a 10-digit phone, or leave phone blank and use email instead." };
  }
  if (raw.length > MAX_PHONE_INPUT_CHARS) {
    return { ok: false, message: "Phone number is too long." };
  }
  if (hasDisallowedControls(raw)) {
    return { ok: false, message: "Phone number looks invalid." };
  }
  if (/[a-z]/i.test(raw)) {
    return { ok: false, message: "Phone number looks invalid." };
  }
  if (/https?:|www\.|\//i.test(raw)) {
    return { ok: false, message: "Phone number looks invalid." };
  }
  // Allow digits and common separators only.
  if (!/^[\d\s().+-]+$/.test(raw.trim())) {
    return { ok: false, message: "Phone number looks invalid." };
  }

  let digits = digitsOnly(raw);
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) {
    return { ok: false, message: "Add a 10-digit phone, or leave phone blank and use email instead." };
  }
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    // Soft NANP check: area/exchange cannot start with 0 or 1.
    return { ok: false, message: "Phone number looks invalid." };
  }

  const display = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return { ok: true, digits, display };
}
