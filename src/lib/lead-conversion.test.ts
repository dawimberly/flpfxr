import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLeadPending,
  canCountLeadThankYou,
  isAcceptedFormSubmit,
  normalizeLeadPath,
  parseLeadPending,
} from "./lead-conversion.ts";

describe("lead conversion gates", () => {
  it("normalizes thank-you paths", () => {
    assert.equal(normalizeLeadPath("/contact/"), "/contact");
    assert.equal(normalizeLeadPath("/"), "/");
    assert.equal(normalizeLeadPath("/kitchen?sent=1"), "/kitchen");
  });

  it("counts a thank-you only with a fresh matching pending submit", () => {
    const pending = buildLeadPending("/contact", 1_000);
    assert.equal(
      canCountLeadThankYou({
        pending,
        pathname: "/contact",
        search: "?sent=1",
        now: 1_000 + 30_000,
      }),
      true,
    );
  });

  it("rejects bare ?sent=1, wrong path, and stale pending", () => {
    const pending = buildLeadPending("/contact", 1_000);
    assert.equal(
      canCountLeadThankYou({
        pending: null,
        pathname: "/contact",
        search: "?sent=1",
        now: 2_000,
      }),
      false,
    );
    assert.equal(
      canCountLeadThankYou({
        pending,
        pathname: "/contact",
        search: "",
        now: 2_000,
      }),
      false,
    );
    assert.equal(
      canCountLeadThankYou({
        pending,
        pathname: "/kitchen",
        search: "?sent=1",
        now: 2_000,
      }),
      false,
    );
    assert.equal(
      canCountLeadThankYou({
        pending,
        pathname: "/contact",
        search: "?sent=1",
        now: 1_000 + 11 * 60 * 1000,
      }),
      false,
    );
  });

  it("parses pending JSON and ignores garbage", () => {
    assert.deepEqual(parseLeadPending('{"nextPath":"/kitchen/","createdAt":9}'), {
      nextPath: "/kitchen",
      createdAt: 9,
    });
    assert.equal(parseLeadPending("not-json"), null);
    assert.equal(parseLeadPending('{"nextPath":"/x"}'), null);
  });

  it("requires explicit FormSubmit acceptance", () => {
    assert.equal(isAcceptedFormSubmit({ ok: true, needsConfirm: false }), true);
    assert.equal(isAcceptedFormSubmit({ ok: false, needsConfirm: true }), false);
    assert.equal(isAcceptedFormSubmit({ ok: false, needsConfirm: false }), false);
  });
});
