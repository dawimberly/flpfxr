import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFormSubmitResponse } from "./formsubmit.ts";

describe("parseFormSubmitResponse", () => {
  it("treats success JSON as a delivered lead", () => {
    const result = parseFormSubmitResponse(200, {
      success: true,
      message: "Your form has been submitted",
    });
    assert.equal(result.ok, true);
    assert.equal(result.needsConfirm, false);
  });

  it("flags the first-send confirmation email so ads leads are not silently dropped", () => {
    const result = parseFormSubmitResponse(200, {
      success: false,
      message: "Make sure you confirm the form through your email.",
    });
    assert.equal(result.ok, false);
    assert.equal(result.needsConfirm, true);
    assert.match(result.message, /FormSubmit confirmation/i);
  });

  it("surfaces other FormSubmit errors without pretending the lead arrived", () => {
    const result = parseFormSubmitResponse(400, {
      success: false,
      message: "Invalid email",
    });
    assert.equal(result.ok, false);
    assert.equal(result.needsConfirm, false);
    assert.match(result.message, /Invalid email/i);
  });
});
