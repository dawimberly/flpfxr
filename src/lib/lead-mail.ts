/**
 * Transactional lead email via Resend's HTTP API (no SDK).
 * Requires RESEND_API_KEY on the server. Never import from client components.
 */

export type LeadMailAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

export type LeadMailInput = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachments?: LeadMailAttachment[];
};

export type LeadMailResult =
  | { ok: true; id: string }
  | { ok: false; status: number; message: string };

export function leadMailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): {
  apiKey: string | null;
  to: string;
  from: string;
} {
  const apiKey = env.RESEND_API_KEY?.trim() || null;
  const to = env.LEAD_TO_EMAIL?.trim() || "Jon@TheFlipFixer.com";
  const from =
    env.LEAD_FROM_EMAIL?.trim() || "The Flip Fixer <onboarding@resend.dev>";
  return { apiKey, to, from };
}

export async function sendLeadEmail(
  input: LeadMailInput,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LeadMailResult> {
  const payload: Record<string, unknown> = {
    from: input.from,
    to: [input.to],
    subject: input.subject,
    text: input.text,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.attachments?.length) {
    payload.attachments = input.attachments.map((file) => ({
      filename: file.filename,
      content: file.contentBase64,
      ...(file.contentType ? { content_type: file.contentType } : {}),
    }));
  }

  let res: Response;
  try {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Email request failed",
    };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (res.ok && typeof rec?.id === "string") {
    return { ok: true, id: rec.id };
  }
  const message =
    (typeof rec?.message === "string" && rec.message) ||
    (Array.isArray(rec?.message) && typeof rec.message[0] === "string"
      ? rec.message[0]
      : null) ||
    `Email provider returned ${res.status}`;
  return { ok: false, status: res.status, message };
}
