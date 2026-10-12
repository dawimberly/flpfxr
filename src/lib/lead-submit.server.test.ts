import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkLeadRateLimit,
  handleLeadFormData,
  resetLeadRateLimitForTests,
} from "./lead-submit.server.ts";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const submissionId = "550e8400-e29b-41d4-a716-446655440000";

describe("lead submit server", () => {
  const originalFetch = globalThis.fetch;
  let mailCalls: unknown[];

  beforeEach(() => {
    resetLeadRateLimitForTests();
    mailCalls = [];
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAD_TO_EMAIL = "Jon@TheFlipFixer.com";
    process.env.LEAD_FROM_EMAIL = "Leads <leads@theflipfixer.com>";
    delete process.env.DATABASE_URL;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      mailCalls.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: "email_ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.LEAD_TO_EMAIL;
    delete process.env.LEAD_FROM_EMAIL;
  });

  it("accepts a valid lead and calls Resend once", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        email: "Jon@TheFlipFixer.com",
        message: "Server delivery unit test — discard.",
        Source: "contact",
        Job: "kitchen",
        gclid: "unit-gclid",
      }),
      new Request("https://theflipfixer.com/api/leads", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.discarded, undefined);
    assert.equal(mailCalls.length, 1);
    const sent = mailCalls[0] as { init?: { body?: string } };
    assert.match(String(sent.init?.body), /unit-gclid/);
    const requestHeaders = new Headers((sent.init as RequestInit)?.headers);
    assert.equal(requestHeaders.get("Idempotency-Key"), `contact-lead/${submissionId}`);
  });

  it("discards honeypot without emailing", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "Bot",
        phone: "2104369117",
        message: "spam spam spam",
        _honey: "filled",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
    );
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.discarded, true);
    assert.equal(mailCalls.length, 0);
  });

  it("fails closed when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "Jon",
        phone: "2104369117",
        message: "Need a quote",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
    );
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "not_configured");
    assert.equal(mailCalls.length, 0);
  });

  it("rate-limits repeated posts from one IP", () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal(checkLeadRateLimit("198.51.100.9"), true);
    }
    assert.equal(checkLeadRateLimit("198.51.100.9"), false);
    assert.equal(checkLeadRateLimit("198.51.100.10"), true);
  });
});
