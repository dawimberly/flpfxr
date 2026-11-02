import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogRedirectUrl } from "./catalog-gate.ts";
import { readDetailedEstimateFeeCents } from "./estimate-fee.ts";
import { buildLaborDocument, laborDocumentPlainText } from "./labor-estimate.ts";
import { renderLaborEstimatePdf } from "./labor-estimate-pdf.ts";
import { decidePayment, readStripeEvent } from "./estimate-next.server.ts";
import { handleCatalogSignup } from "./catalog-signup.server.ts";
import { parseStoredPlanner } from "./planner-form.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";
import { DEFAULT_PROJECT_INPUTS, type ProjectInputs } from "./public-estimate-options.ts";
import { projectPlanningEstimate } from "./public-pricing.ts";
import type { StoredPlanner } from "./planner-form.ts";

const submissionId = "550e8400-e29b-41d4-a716-446655440000";

function planner(changes: Partial<ProjectInputs> = {}, extra: Partial<StoredPlanner> = {}): StoredPlanner {
  return {
    v: 1,
    project: { ...DEFAULT_PROJECT_INPUTS, ...changes },
    address: "120 Broadway, San Antonio",
    note: "Side gate is open.",
    occupancy: "occupied",
    timing: "soon",
    decision: "shared",
    ...extra,
  };
}

describe("catalog url", () => {
  it("defaults to the live browse-only shop with the flipfixer ref", () => {
    assert.equal(catalogRedirectUrl({} as NodeJS.ProcessEnv), "https://stylesbydesigntx.com/shop?ref=flipfixer");
  });

  it("accepts an env base and path and drops other query strings", () => {
    const url = catalogRedirectUrl({
      SBD_CATALOG_BASE_URL: "https://example.com/ignored?x=1",
      SBD_CATALOG_PATH: "/showroom",
    } as NodeJS.ProcessEnv);
    assert.equal(url, "https://example.com/showroom?ref=flipfixer");
  });

  it("refuses a non-http base", () => {
    assert.equal(
      catalogRedirectUrl({ SBD_CATALOG_BASE_URL: "javascript:alert(1)" } as NodeJS.ProcessEnv),
      "https://stylesbydesigntx.com/shop?ref=flipfixer",
    );
  });
});

describe("estimate fee", () => {
  it("defaults to $35 and rejects an invalid override", () => {
    assert.equal(readDetailedEstimateFeeCents({} as NodeJS.ProcessEnv), 3500);
    assert.equal(readDetailedEstimateFeeCents({ DETAILED_ESTIMATE_FEE_CENTS: "4500" } as NodeJS.ProcessEnv), 4500);
    assert.throws(() => readDetailedEstimateFeeCents({ DETAILED_ESTIMATE_FEE_CENTS: "35.00" } as NodeJS.ProcessEnv));
  });
});

describe("labor document", () => {
  it("prices labor and services only, with quantities, rates, tiers, and a timeline", () => {
    const doc = buildLaborDocument(planner());
    const built = projectPlanningEstimate(planner().project)!;
    const expected = Math.round(built.labor * 100) + Math.round(built.support * 100);
    assert.equal(doc.kind, "itemized");
    assert.equal(doc.totalCents, expected);
    assert.ok(doc.lines.length >= 8);
    assert.ok(doc.areas.includes("Cabinets"));
    assert.ok(doc.areas.includes("Floor"));
    assert.ok(doc.tiers.length === 3);
    assert.equal(doc.tiers.find((tier) => tier.selected)?.totalCents, doc.totalCents);
    assert.match(doc.timeline, /working day/);
    assert.doesNotMatch(doc.timeline, /\$650|crew day/i);
    const floor = doc.lines.find((line) => line.label === "Floor installation")!;
    const source = built.lines.find((line) => line.id === "floor")!;
    assert.notEqual(floor.amountCents, Math.round(source.materials * 100));
    assert.equal(floor.rateCents, Math.round(floor.amountCents / floor.quantity));
    const text = laborDocumentPlainText(doc, {
      name: "Ada",
      phone: "2104369117",
      email: "ada@example.com",
      feeLabel: "$35.00",
      catalogUrl: "https://stylesbydesigntx.com/shop?ref=flipfixer",
    });
    assert.match(text, /Material prices are not included/);
    assert.match(text, /Request a designer call/);
    assert.match(text, /fillers, toe kick, and baseboard/);
    assert.match(text, /stylesbydesigntx.com\/shop\?ref=flipfixer/);
    assert.doesNotMatch(text, /insured|insurance/i);
    assert.doesNotMatch(text, /\$3\.85|\$185/);
  });

  it("leaves supplier-installed stone out of the labor lines", () => {
    const doc = buildLaborDocument(planner({ counter: "quartz" }));
    assert.equal(doc.lines.some((line) => line.label === "Countertop installation"), false);
    assert.match(doc.supplierNote ?? "", /designer confirms it/);
  });

  it("keeps shower valve labor and drops fixture product cost", () => {
    const input = planner({ service: "bathroom", floor: "tile", shower: "ceramic" });
    const doc = buildLaborDocument(input);
    const built = projectPlanningEstimate(input.project)!;
    const valve = doc.lines.find((line) => line.label === "Shower valve labor");
    assert.equal(valve?.amountCents, 22500);
    const fixture = built.lines.find((line) => line.id === "fixture-allowance")!;
    const fixtureLine = doc.lines.find((line) => line.label === "Fixture installation")!;
    assert.notEqual(fixtureLine.amountCents, Math.round(fixture.materials * 100));
    assert.doesNotMatch(JSON.stringify(doc.excluded), /insured|insurance/i);
  });
});

describe("stripe", () => {
  it("checks the webhook signature and reads a paid checkout session", () => {
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: {
        object: "checkout.session",
        id: "cs_test_123",
        payment_status: "paid",
        amount_total: 3500,
        currency: "usd",
        client_reference_id: submissionId,
        metadata: { lead_id: submissionId },
        payment_intent: "pi_123",
      } },
    });
    const stamp = 1_700_000_000;
    const sig = createHmac("sha256", "whsec_test").update(`${stamp}.${payload}`).digest("hex");
    assert.equal(verifyStripeSignature(payload, `t=${stamp},v1=${sig}`, "whsec_test", stamp * 1000), true);
    assert.equal(verifyStripeSignature(payload, `t=${stamp},v1=${"0".repeat(sig.length)}`, "whsec_test", stamp * 1000), false);
    const event = readStripeEvent(JSON.parse(payload));
    assert.equal(event && "leadId" in event && event.leadId, submissionId);
    assert.equal(decidePayment({
      submissionId,
      name: "Ada",
      email: "ada@example.com",
      phone: "2104369117",
      feeCents: 3500,
      status: "checkout",
      sessionId: "cs_test_123",
      paymentIntent: null,
      planner: null,
      customerNotified: false,
      staffNotified: false,
      hasPhoto: false,
    }, { sessionId: "cs_test_123", amountCents: 3500, currency: "usd" }), "pay");
  });
});

describe("catalog signup", () => {
  it("saves an sbd_catalog lead and returns the shop url", async () => {
    let source = "";
    const response = await handleCatalogSignup(form({
      submissionId,
      name: "Ada Lovelace",
      phone: "2104369117",
      email: "ada@example.com",
      project_type: "kitchen",
    }), new Request("https://theflipfixer.com/api/catalog-signup"), {
      handleLead: async (next) => {
        source = String(next.get("Source"));
        assert.match(String(next.get("message")), /browse-only/);
        assert.match(String(next.get("message")), /Request a designer call/);
        return Response.json({ ok: true, submissionId });
      },
    });
    assert.equal(source, "sbd_catalog");
    const body = await response.json();
    assert.equal(body.redirectUrl, "https://stylesbydesigntx.com/shop?ref=flipfixer");
  });
});

describe("planner form", () => {
  it("keeps a measured kitchen and drops a forged service", () => {
    const data = form({
      service: "kitchen",
      size: "Medium",
      floor: "lvp",
      counter: "quartz",
      shower: "ceramic",
      prime: "1",
      exterior_coats: "1",
      new_toilet: "1",
      floor_sqft: "168",
      counter_sqft: "40",
      cabinet_boxes: "16",
      note: "Pets in the house",
      occupancy: "occupied",
    });
    const parsed = parseStoredPlanner(data);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.planner.project.cabinetBoxes, 16);
    data.set("service", "roofing");
    assert.equal(parseStoredPlanner(data).ok, false);
  });
});

describe("labor pdf", () => {
  it("renders a branded multi-section pdf without material prices", async () => {
    const doc = buildLaborDocument(planner());
    const bytes = await renderLaborEstimatePdf({
      document: doc,
      name: "Ada Lovelace",
      phone: "(210) 436-9117",
      email: "ada@example.com",
      feeLabel: "$35.00",
      catalogUrl: "https://stylesbydesigntx.com/shop?ref=flipfixer",
      submissionId,
      issued: new Date("2026-11-02T12:00:00Z"),
    });
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
    const { extractPdfText } = await import("./pdf-text.ts");
    const text = await extractPdfText(bytes);
    assert.match(text, /THE FLIP FIXER/);
    assert.match(text, /Floor installation/);
    assert.match(text, /Labor and services total/);
    assert.match(text, /Before we start/);
    assert.match(text, /Next steps/);
    assert.match(text, /stylesbydesigntx.com\/shop\?ref=flipfixer/);
    assert.match(text, /Request a designer call/);
    assert.doesNotMatch(text, /insured|insurance/i);
  });
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
