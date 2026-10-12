import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LEAD_PHOTO_BYTES,
  buildLeadEmailText,
  claimAcceptedLeadConversion,
  isValidSubmissionId,
  parseLeadApiResponse,
  shouldTrackAcceptedLead,
  validateLeadFields,
  validateLeadPhoto,
} from "./lead-delivery.ts";

const submissionId = "550e8400-e29b-41d4-a716-446655440000";

describe("lead delivery validation", () => {
  it("accepts a normal lead and rejects short phone or empty message", () => {
    assert.equal(
      validateLeadFields({
        name: "Jon",
        email: "jon@theflipfixer.com",
        phone: "(210) 436-9117",
        message: "Kitchen remodel in Alamo Heights",
      }).ok,
      true,
    );
    assert.equal(
      validateLeadFields({
        name: "Jon",
        email: "",
        phone: "210",
        message: "Kitchen remodel",
      }).ok,
      false,
    );
    assert.equal(
      validateLeadFields({
        name: "Jon",
        email: "",
        phone: "2104369117",
        message: "hi",
      }).ok,
      false,
    );
  });

  it("validates submission ids", () => {
    assert.equal(isValidSubmissionId(submissionId), true);
    assert.equal(isValidSubmissionId("not-a-uuid"), false);
  });

  it("rejects oversize or unsupported photos", () => {
    assert.equal(validateLeadPhoto(null).ok, true);
    const okFile = new File([new Uint8Array([1, 2, 3])], "job.jpg", {
      type: "image/jpeg",
    });
    assert.equal(validateLeadPhoto(okFile).ok, true);
    const huge = new File([new Uint8Array(MAX_LEAD_PHOTO_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const hugeCheck = validateLeadPhoto(huge);
    assert.equal(hugeCheck.ok, false);
    const bad = new File([new Uint8Array([1])], "notes.pdf", {
      type: "application/pdf",
    });
    const badCheck = validateLeadPhoto(bad);
    assert.equal(badCheck.ok, false);
  });

  it("tracks only explicit non-discarded acceptance", () => {
    assert.equal(
      shouldTrackAcceptedLead({ ok: true, submissionId: "x" }),
      true,
    );
    assert.equal(
      shouldTrackAcceptedLead({ ok: true, discarded: true, submissionId: "x" }),
      false,
    );
    assert.equal(
      shouldTrackAcceptedLead({ ok: false, message: "nope" }),
      false,
    );
    assert.equal(
      shouldTrackAcceptedLead({
        ok: true,
        duplicate: true,
        submissionId,
      }),
      true,
    );
  });

  it("claims an Ads conversion only once per submission id", () => {
    const store = new Map<string, string>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    Object.assign(globalThis, {
      window: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
          removeItem: (key: string) => {
            store.delete(key);
          },
        },
      },
    });
    try {
      assert.equal(claimAcceptedLeadConversion(submissionId), true);
      assert.equal(claimAcceptedLeadConversion(submissionId), false);
      assert.equal(claimAcceptedLeadConversion(submissionId.toUpperCase()), false);
      assert.equal(
        claimAcceptedLeadConversion("660e8400-e29b-41d4-a716-446655440001"),
        true,
      );
      assert.equal(claimAcceptedLeadConversion("not-a-uuid"), false);
    } finally {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = prevWindow;
    }
  });

  it("parses API success and failure bodies", () => {
    assert.deepEqual(parseLeadApiResponse(200, { ok: true, submissionId: "abc" }), {
      ok: true,
      discarded: false,
      duplicate: false,
      submissionId: "abc",
    });
    const fail = parseLeadApiResponse(503, {
      ok: false,
      code: "not_configured",
      message: "Lead email is not configured on the server yet.",
    });
    assert.equal(fail.ok, false);
    if (!fail.ok) {
      assert.equal(fail.code, "not_configured");
    }
  });

  it("includes ad click fields in the email body", () => {
    const text = buildLeadEmailText({
      submissionId,
      name: "Ada",
      email: "a@example.com",
      phone: "2104369117",
      phoneDigits: "2104369117",
      message: "Bath remodel",
      service: "bathroom",
      source: "contact",
      affiliation: "",
      honey: "",
      adIds: { gclid: "test-gclid", landing_path: "/contact" },
    });
    assert.match(text, /gclid: test-gclid/);
    assert.match(text, /Bath remodel/);
  });
});
