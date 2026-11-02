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
  it("prices labor and services only, with quantities, line totals, tiers, and a timeline", () => {
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
    assert.match(floor.quantityLabel, /168/);
    assert.equal(floor.unit, "sq ft");
    const text = laborDocumentPlainText(doc, {
      name: "Ada",
      phone: "2104369117",
      email: "ada@example.com",
      feeLabel: "$35.00",
      catalogUrl: "https://stylesbydesigntx.com/shop?ref=flipfixer",
    });
    assert.match(text, /FLIP FIXER/);
    assert.match(text, /WHAT'S INCLUDED/);
    assert.match(text, /WHAT'S NOT INCLUDED/);
    assert.match(text, /INVESTMENT/);
    assert.match(text, /NOTES/);
    assert.match(text, /Materials named for this job/);
    assert.match(text, /includes materials and cabinets/);
    assert.match(text, /50% deposit schedules the work/);
    assert.match(text, /Ready when you are/);
    assert.match(text, /stylesbydesigntx.com\/shop\?ref=flipfixer/);
    assert.doesNotMatch(text, /168 sq ft|8 boxes|Per unit/);
    assert.doesNotMatch(text, /\$\d[\d,]*\.\d{2}\s*\//);
    assert.doesNotMatch(text, /\binsured\b/i);
    assert.doesNotMatch(text, /divided by|rounded to the cent/i);
    assert.doesNotMatch(text, /\$3\.85|\$185/);
  });

  it("prices oversized cabinet panels at the published install rate", () => {
    const doc = buildLaborDocument(planner({ xlFridgeBoxes: 1 }));
    const panel = doc.lines.find((line) => line.label === "Refrigerator panel installation");
    assert.equal(panel?.rateCents, 12500);
    assert.notEqual(panel?.rateCents, doc.lines.find((line) => line.label === "Base cabinet installation")?.rateCents);
  });

  it("leaves supplier-installed stone out of the labor lines", () => {
    const doc = buildLaborDocument(planner({ counter: "quartz" }));
    assert.equal(doc.lines.some((line) => line.label === "Countertop installation"), false);
    assert.match(doc.supplierNote ?? "", /not part of this labor total/);
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
    assert.doesNotMatch(JSON.stringify(doc.excluded), /\binsured\b/i);
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
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(bytes);
    assert.ok(pdfDoc.getPageCount() <= 3, `expected 2-3 pages, got ${pdfDoc.getPageCount()}`);
    const { extractPdfText } = await import("./pdf-text.ts");
    const text = await extractPdfText(bytes);
    assert.match(text, /FLIP FIXER/);
    assert.match(text, /theflipfixer\.com . jon@theflipfixer\.com . San Antonio, TX/);
    assert.match(text, /Estimate #20261102-550E/);
    assert.match(text, /Valid 30 days/);
    assert.match(text, /PROJECT/);
    assert.match(text, /WHAT'S INCLUDED/);
    assert.match(text, /WHAT'S NOT INCLUDED/);
    assert.match(text, /INVESTMENT/);
    assert.match(text, /Labor and services/);
    assert.match(text, /NOTES/);
    assert.match(text, /50% deposit schedules the work\. Balance due on completion\. Price good 30 days\./);
    assert.match(text, /Final prices set after onsite inspection/);
    assert.match(text, /Ready when you are/);
    assert.match(text, /Materials named for this job/);
    assert.doesNotMatch(text, /Per unit|168 sq ft|8 boxes|Qty/);
    assert.doesNotMatch(text, /\$\d[\d,]*\.\d{2}\s*\//);
    const { PDFName } = await import("pdf-lib");
    const links = pdfDoc.getPages().flatMap((item) => {
      const found = item.node.lookup(PDFName.of("Annots")) as { size?: () => number; get?: (index: number) => unknown } | undefined;
      if (!found?.size || !found.get) return [];
      const rows: string[] = [];
      for (let index = 0; index < found.size(); index += 1) {
        const ref = found.get(index);
        const obj = ref ? pdfDoc.context.lookup(ref as never) : undefined;
        if (obj) rows.push(obj.toString());
      }
      return rows;
    });
    assert.match(links.join("\n"), /stylesbydesigntx\.com\/shop\?ref=flipfixer/);
    assert.doesNotMatch(text, /divided by|rounded to the cent/i);
    assert.doesNotMatch(text, /\binsured\b/i);
  });
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
