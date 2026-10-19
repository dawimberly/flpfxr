import { it } from "node:test";
import assert from "node:assert/strict";
import { loadLeadDraft, saveLeadDraft } from "./site-rest-b.ts";

it("keeps lead retries usable when browser storage is blocked", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem() { throw new Error("Storage denied"); },
      setItem() { throw new Error("Storage denied"); },
    },
  });
  try {
    const submissionId = "550e8400-e29b-41d4-a716-446655440000";
    assert.doesNotThrow(() => saveLeadDraft({ name: "Tracking test", submissionId }));
    saveLeadDraft({ message: "Retry the same request" });
    assert.equal(loadLeadDraft().submissionId, submissionId);
    assert.equal(loadLeadDraft().name, "Tracking test");
    saveLeadDraft({ submissionId: "" });
    assert.equal(loadLeadDraft().submissionId, "");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem() { return JSON.stringify({ submissionId: "stale" }); },
        setItem() { throw new Error("Quota exceeded"); },
      },
    });
    saveLeadDraft({ submissionId });
    assert.equal(loadLeadDraft().submissionId, submissionId);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousStorage) Object.defineProperty(globalThis, "sessionStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
