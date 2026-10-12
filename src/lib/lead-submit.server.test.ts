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

  it("reuses the same Resend Idempotency-Key for concurrent retries", async () => {
    const fields = {
      submissionId,
      name: "TRACKING TEST — NOT A CUSTOMER LEAD",
      phone: "2104369117",
      message: "Concurrent retry unit test — discard.",
      Source: "contact",
    };
    const request = () =>
      new Request("https://theflipfixer.com/api/leads", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });

    const [a, b] = await Promise.all([
      handleLeadFormData(form(fields), request()),
      handleLeadFormData(form(fields), request()),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(mailCalls.length, 2);
    for (const call of mailCalls) {
      const headers = new Headers((call as { init?: RequestInit }).init?.headers);
      assert.equal(headers.get("Idempotency-Key"), `contact-lead/${submissionId}`);
    }
  });

  it("returns duplicate without a second email when already delivered", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        message: "Duplicate path unit test — discard.",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      {
        findExistingLead: async () => ({
          submission_id: submissionId,
          delivered_email: true,
        }),
      },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.duplicate, true);
    assert.equal(mailCalls.length, 0);
  });

  it("reports delivery_failed without claiming success when Resend errors", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    let persisted = false;
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        message: "Delivery failure unit test — discard.",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      {
        persistLead: async () => {
          persisted = true;
        },
      },
    );
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "delivery_failed");
    assert.match(body.message, /Call or text/);
    assert.equal(persisted, true);
  });

  it("still accepts the lead when persistence fails after email", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        message: "DB failure after email unit test — discard.",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      {
        persistLead: async () => {
          throw new Error("database unavailable");
        },
      },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(mailCalls.length, 1);
  });

  it("rejects invalid photos before calling Resend", async () => {
    const data = form({
      submissionId,
      name: "TRACKING TEST — NOT A CUSTOMER LEAD",
      phone: "2104369117",
      message: "Photo validation unit test — discard.",
    });
    data.set(
      "attachment",
      new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }),
    );
    const res = await handleLeadFormData(
      data,
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "validation");
    assert.equal(mailCalls.length, 0);
  });
});
