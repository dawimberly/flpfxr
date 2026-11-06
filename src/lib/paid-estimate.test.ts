import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogRedirectUrl } from "./catalog-gate.ts";
import { publicEstimateOffer, readDetailedEstimateFeeCents } from "./estimate-fee.ts";
import { paidEstimateEnabled } from "./paid-estimate-flag.ts";
import { buildLaborDocument, laborDocumentPlainText } from "./labor-estimate.ts";
import { renderLaborEstimatePdf, SITE_HEADER_LOGO } from "./labor-estimate-pdf.ts";
import { decidePayment, handleEstimateCheckout, handleFreeInquiry, readStripeEvent } from "./estimate-next.server.ts";
import { handleCatalogSignup } from "./catalog-signup.server.ts";
import { parseStoredPlanner } from "./planner-form.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";
import { DEFAULT_PROJECT_INPUTS, type ProjectInputs } from "./public-estimate-options.ts";
import { formatEstimateRange, projectPlanningEstimate } from "./public-pricing.ts";
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

describe("paid estimate flag", () => {
  it("stays off unless the value is true", () => {
    assert.equal(paidEstimateEnabled(undefined), false);
    assert.equal(paidEstimateEnabled(null), false);
    assert.equal(paidEstimateEnabled(""), false);
    assert.equal(paidEstimateEnabled("false"), false);
    assert.equal(paidEstimateEnabled("1"), false);
    assert.equal(paidEstimateEnabled("yes"), false);
    assert.equal(paidEstimateEnabled(" true "), true);
    assert.equal(paidEstimateEnabled("TRUE"), true);
  });

  it("hides the public fee until checkout is enabled", () => {
    assert.equal(publicEstimateOffer({} as NodeJS.ProcessEnv).feeLabel, null);
    assert.equal(publicEstimateOffer({ VITE_PAID_ESTIMATE_ENABLED: "false" } as NodeJS.ProcessEnv).feeLabel, null);
    assert.equal(
      publicEstimateOffer({ VITE_PAID_ESTIMATE_ENABLED: "true" } as NodeJS.ProcessEnv).feeLabel,
      "$35.00",
    );
  });

  it("refuses checkout while the flag is off", async () => {
    const previous = process.env.VITE_PAID_ESTIMATE_ENABLED;
    delete process.env.VITE_PAID_ESTIMATE_ENABLED;
    try {
      const form = new FormData();
      const response = await handleEstimateCheckout(form, new Request("https://theflipfixer.com/api/estimate-checkout"));
      assert.equal(response.status, 503);
      const body = await response.json() as { code?: string };
      assert.equal(body.code, "not_configured");
    } finally {
      if (previous === undefined) delete process.env.VITE_PAID_ESTIMATE_ENABLED;
      else process.env.VITE_PAID_ESTIMATE_ENABLED = previous;
    }
  });
});

describe("free inquiry", () => {
  it("includes the planner selections in the lead", async () => {
    const stored = planner();
    const form = new FormData();
    form.set("submissionId", submissionId);
    form.set("name", "Ada Lovelace");
    form.set("phone", "2104369117");
    form.set("email", "ada@example.com");
    form.set("service", stored.project.service);
    form.set("size", stored.project.size);
    form.set("floor", stored.project.floor);
    form.set("counter", stored.project.counter);
    form.set("shower", stored.project.shower);
    form.set("prime", "1");
    form.set("exterior_coats", "1");
    form.set("new_toilet", "1");
    form.set("address", stored.address);
    form.set("note", stored.note);
    let message = "";
    const response = await handleFreeInquiry(form, new Request("https://theflipfixer.com/api/estimate-inquiry"), {
      handleLead: async (next) => {
        message = String(next.get("message") ?? "");
        return Response.json({ ok: true, submissionId });
      },
      savePlanner: async () => {},
      sendMail: async () => ({ ok: true, id: "local" }),
    });
    assert.equal(response.status, 200);
    assert.match(message, /Kitchen remodeling/);
    assert.match(message, /Size: Medium/);
    assert.match(message, /between \$13,300 and \$16,700/);
    assert.match(message, /120 Broadway/);
    assert.match(message, /Side gate is open/);
    assert.doesNotMatch(message, /insured/i);
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
  it("prices the whole job on the same range as the planner", () => {
    const doc = buildLaborDocument(planner());
    const built = projectPlanningEstimate(planner().project)!;
    assert.equal(doc.kind, "itemized");
    assert.equal(doc.totalCents, Math.round(built.low) * 100);
    assert.equal(doc.lines.reduce((sum, line) => sum + line.amountCents, 0), doc.totalCents);
    assert.equal(doc.rangeLabel, formatEstimateRange(built));
    assert.equal(doc.rangeLabel, "between $13,300 and $16,700");
    assert.ok(doc.lines.some((line) => line.label === "Cabinets - supplied and installed"));
    assert.ok(doc.lines.some((line) => line.label === "Counters - supplied and installed"));
    assert.equal(doc.supplierNote, null);
    assert.doesNotMatch(doc.excluded.join(" "), /Material prices|do not put prices/i);
    assert.ok(doc.tiers.length === 3);
    assert.equal(doc.tiers.find((tier) => tier.selected)?.totalCents, doc.totalCents);
    assert.match(doc.timeline, /working day/);
    assert.doesNotMatch(doc.timeline, /\$650|crew day/i);
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
    assert.match(text, /between \$13,300 and \$16,700/);
    assert.match(text, /Cabinets - supplied and installed/);
    assert.doesNotMatch(text, /Material prices|do not put prices|labor only|labor and services/i);
    assert.match(text, /Itemized job estimate/);
    assert.match(text, /Estimated job total/);
    assert.doesNotMatch(text, /\blabor\b/i);
    assert.match(text, /50% deposit schedules the work/);
    assert.match(text, /Ready when you are/);
    assert.match(text, /stylesbydesigntx.com\/shop\?ref=flipfixer/);
    assert.doesNotMatch(text, /168 sq ft|8 boxes|Per unit/);
    assert.doesNotMatch(text, /\$\d[\d,]*\.\d{2}\s*\//);
    assert.doesNotMatch(text, /\binsured\b/i);
    assert.doesNotMatch(text, /divided by|rounded to the cent/i);
    assert.doesNotMatch(text, /\$3\.85|\$185/);
  });

  it("includes quartz counters and a larger cabinet package in the job total", () => {
    const plain = buildLaborDocument(planner());
    const withPanel = buildLaborDocument(planner({ xlFridgeBoxes: 1 }));
    const cabinets = (doc: ReturnType<typeof buildLaborDocument>) =>
      doc.lines.find((line) => line.label === "Cabinets - supplied and installed")?.amountCents ?? 0;
    assert.ok(cabinets(withPanel) > cabinets(plain));
    const quartz = buildLaborDocument(planner({ counter: "quartz" }));
    const built = projectPlanningEstimate(planner({ counter: "quartz" }).project)!;
    assert.equal(quartz.rangeLabel, formatEstimateRange(built));
    assert.ok(quartz.lines.some((line) => line.label === "Counters - supplied and installed"));
    assert.equal(quartz.supplierNote, null);
  });

  it("prices a bathroom on the planner range, including fixtures", () => {
    const input = planner({ service: "bathroom", floor: "tile", shower: "ceramic" });
    const doc = buildLaborDocument(input);
    const built = projectPlanningEstimate(input.project)!;
    assert.equal(doc.rangeLabel, formatEstimateRange(built));
    assert.equal(doc.rangeLabel, "between $9,300 and $11,700");
    const fixtures = doc.lines.find((line) => line.label === "Fixtures - supplied and installed");
    const source = built.lines.find((line) => line.id === "fixture-allowance")!;
    assert.ok((fixtures?.amountCents ?? 0) > Math.round(source.materials * 100));
    assert.doesNotMatch(JSON.stringify(doc.excluded), /\binsured\b|Material prices/i);
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
  it("labels a sample estimate and does not use a real customer", async () => {
    const doc = buildLaborDocument(planner({}, {
      address: "100 Sample Street, San Antonio, TX 78205",
      note: "Sample only. This is not a real job.",
      occupancy: "",
      timing: "",
      decision: "",
    }));
    const bytes = await renderLaborEstimatePdf({
      document: doc,
      name: "Sample Customer",
      phone: "(210) 555-0100",
      email: "sample@example.com",
      feeLabel: "$35.00",
      catalogUrl: "https://stylesbydesigntx.com/shop?ref=flipfixer",
      submissionId,
      issued: new Date("2026-11-02T12:00:00Z"),
      sample: true,
    });
    const { extractPdfText } = await import("./pdf-text.ts");
    const text = await extractPdfText(bytes);
    assert.match(text, /Estimate #SAMPLE/);
    assert.match(text, /Sample Customer/);
    assert.match(text, /100 Sample Street/);
    assert.match(text, /not a real job/);
    assert.doesNotMatch(text, /\binsured\b/i);
    assert.doesNotMatch(text, /Ada Lovelace|120 Broadway/);
  });

  it("draws the same logo file the live header uses", () => {
    const svg = readFileSync(new URL("../../public/logo.svg", import.meta.url), "utf8");
    assert.equal(SITE_HEADER_LOGO.source, "public/logo.svg");
    assert.ok(svg.includes(SITE_HEADER_LOGO.white));
    assert.ok(svg.includes(SITE_HEADER_LOGO.orange));
    assert.match(svg, /#f08330/);
    assert.match(svg, /#fff/);
  });

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
    assert.match(text, /Estimated job total/);
    assert.match(text, /between \$13,300 and \$16,700/);
    assert.match(text, /Cabinets - supplied and installed/);
    assert.match(text, /\u2022/);
    assert.doesNotMatch(text, /Material prices|do not put prices|labor only|labor and services/i);
    assert.doesNotMatch(text, /\blabor\b/i);
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
