import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";

describe("lead mail", () => {
  it("reads Resend config from env without exposing defaults as secrets", () => {
    const cfg = leadMailConfigFromEnv({
      RESEND_API_KEY: " re_test ",
      LEAD_TO_EMAIL: "Jon@TheFlipFixer.com",
      LEAD_FROM_EMAIL: "Leads <leads@theflipfixer.com>",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.apiKey, "re_test");
    assert.equal(cfg.to, "Jon@TheFlipFixer.com");
    assert.match(cfg.from, /leads@theflipfixer.com/);
  });

  it("treats Resend 200 with id as acceptance and sends Idempotency-Key", async () => {
    const submissionId = "550e8400-e29b-41d4-a716-446655440000";
    let seenKey: string | null = null;
    const result = await sendLeadEmail(
      {
        to: "Jon@TheFlipFixer.com",
        submissionId,
        from: "Leads <leads@theflipfixer.com>",
        subject: "Test",
        text: "Hello",
      },
      "re_test",
      async (_url, init) => {
        seenKey = new Headers(init?.headers).get("Idempotency-Key");
        return new Response(JSON.stringify({ id: "email_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    assert.deepEqual(result, { ok: true, id: "email_123" });
    assert.equal(seenKey, `contact-lead/${submissionId}`);
  });

  it("surfaces provider failures without claiming delivery", async () => {
    const result = await sendLeadEmail(
      {
        to: "Jon@TheFlipFixer.com",
        submissionId: "550e8400-e29b-41d4-a716-446655440000",
        from: "Leads <leads@theflipfixer.com>",
        subject: "Test",
        text: "Hello",
      },
      "re_test",
      async () =>
        new Response(JSON.stringify({ message: "Invalid API key" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.match(result.message, /Invalid API key/);
    }
  });
});
