import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  classifyLine,
  invoiceLinesFromReview,
  parseEstimateText,
  preferredEstimateFile,
} from "./invoice-parse.ts";
import { extractPdfRows } from "./invoice-pdf.ts";
import { createDraftInvoice } from "./stripe-invoice.ts";

const contractor = `
THE FLIP FIXER
Estimate #20261102-A
Prepared for Ada Lovelace
50% deposit, balance on completion
# Description Qty Unit Unit cost Amount
1 Base cabinet install 8.00 EA $75.00 $600.00
2 Quartz counters 40.00 SF $70.00 $2,800.00
3 Floor protection 1.00 LS $250.00 $250.00
10% discount -$365.00
Total $3,285.00
`;

const customerRooms = `
Flip Fixer
#20261015
Client: TBD
Kitchen $12,400.00
Bathroom $8,200.00
Balance due on completion
`;

const options = `
Estimate #20260901
Customer: Sam Rivera
Option A — Laminate
Labor to set cabinets $1,800.00
Materials allowance $900.00
Option A total $2,700.00
Option B — Quartz
Labor to set cabinets $1,800.00
Quartz slab materials @ $70/SF $3,200.00
Option B total $5,000.00
`;

describe("estimate invoice parse", () => {
  it("prefers the contractor file name", () => {
    assert.equal(
      preferredEstimateFile([
        "Flip-Fixer-Oak-Customer-20261102.pdf",
        "Flip-Fixer-Oak-Contractor-20261102.pdf",
      ]),
      "Flip-Fixer-Oak-Contractor-20261102.pdf",
    );
  });

  it("reads a contractor table, discount, deposit, and tags goods", () => {
    const parsed = parseEstimateText(contractor, "Flip-Fixer-Kitchen-Contractor-20261102.pdf");
    assert.equal(parsed.copy, "contractor");
    assert.equal(parsed.estimateNumber, "20261102-A");
    assert.equal(parsed.customerName, "Ada Lovelace");
    assert.equal(parsed.depositPercent, 50);
    assert.equal(parsed.discountPercent, 10);
    assert.equal(parsed.discountCents, -36500);
    assert.equal(parsed.lines.length, 3);
    assert.equal(parsed.lines[0].kind, "labor");
    assert.equal(parsed.lines[0].amountCents, 60000);
    assert.equal(parsed.lines[1].kind, "materials");
    assert.equal(parsed.lines[1].unit, "SF");
    assert.equal(parsed.lines[2].kind, "labor");
    assert.equal(parsed.lines.some((line) => /discount/i.test(line.description)), false);
  });

  it("does not take TBD as the customer and keeps room totals", () => {
    const parsed = parseEstimateText(customerRooms, "Flip-Fixer-Oak-Customer-20261015.pdf");
    assert.equal(parsed.customerName, null);
    assert.equal(parsed.copy, "customer");
    assert.equal(parsed.estimateNumber, "20261015");
    assert.deepEqual(parsed.lines.map((line) => [line.description, line.amountCents]), [
      ["Kitchen", 1240000],
      ["Bathroom", 820000],
    ]);
    assert.match(parsed.warnings.join(" "), /TBD/);
  });

  it("keeps option groups and does not double-count option totals", () => {
    const parsed = parseEstimateText(options);
    assert.equal(parsed.customerName, "Sam Rivera");
    assert.equal(parsed.lines.length, 4);
    assert.deepEqual(
      parsed.lines.map((line) => line.option),
      ["A", "A", "B", "B"],
    );
    assert.equal(parsed.lines[1].kind, "materials");
    assert.equal(parsed.lines[3].kind, "materials");
    assert.equal(classifyLine("Equipment rental"), "materials");
    assert.equal(classifyLine("Demolition"), "labor");
  });

  it("applies a paid estimate credit and a 50% deposit without dropping cents", () => {
    const lines = invoiceLinesFromReview({
      lines: [
        { description: "Labor", amountCents: 10001, kind: "labor", included: true },
        { description: "10% discount", amountCents: -1000, kind: "labor", included: true },
        { description: "Skipped", amountCents: 500, kind: "materials", included: false },
      ],
      depositPercent: 50,
      creditCents: 3500,
    });
    const sum = lines.reduce((total, line) => total + line.amountCents, 0);
    assert.equal(sum, Math.round((10001 - 1000) * 0.5) - Math.round(3500 * 0.5));
    assert.match(lines.at(-1)?.description ?? "", /Estimate fee credit/);
    assert.ok((lines.at(-1)?.amountCents ?? 0) < 0);
  });
});

describe("pdf rows and draft invoice", () => {
  it("extracts a drawn amount as its own row", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Estimate #20260101", { x: 48, y: 740, size: 12, font });
    page.drawText("Prepared for Blair", { x: 48, y: 720, size: 12, font });
    page.drawText("Kitchen labor $450.00", { x: 48, y: 680, size: 12, font });
    const rows = await extractPdfRows(await doc.save());
    const parsed = parseEstimateText(rows.join("\n"), "Flip-Fixer-Kitchen-Customer-20260101.pdf");
    assert.equal(parsed.estimateNumber, "20260101");
    assert.equal(parsed.customerName, "Blair");
    assert.equal(parsed.lines[0]?.amountCents, 45000);
  });

  it("creates a draft and never finalizes or sends it", async () => {
    const calls: { method: string; path: string; body: string }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      calls.push({ method: init?.method ?? "GET", path, body: typeof init?.body === "string" ? init.body : "" });
      if (path.endsWith("/invoices")) {
        return new Response(JSON.stringify({ id: "in_draft", status: "draft", hosted_invoice_url: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "ii_1" }), { status: 200 });
    }) as typeof fetch;
    const draft = await createDraftInvoice({
      secretKey: "sk_test_123",
      customerId: "cus_123",
      estimateNumber: "20261102-A",
      leadId: "550e8400-e29b-41d4-a716-446655440000",
      idempotencyKey: "draft-invoice/test",
      lines: [
        { description: "Labor", amountCents: 10000, kind: "labor" },
        { description: "Estimate fee credit", amountCents: -3500, kind: "labor" },
      ],
      tax: { laborTaxCode: "txcd_20030000", materialsTaxCode: "txcd_99999999", automaticTax: false, daysUntilDue: 30 },
      fetchImpl,
    });
    assert.equal(draft.status, "draft");
    assert.match(draft.dashboardUrl, /\/test\/invoices\/in_draft/);
    assert.equal(calls.some((call) => /\/(send|finalize)/.test(call.path)), false);
    const invoice = calls.find((call) => call.path.endsWith("/invoices"));
    assert.match(invoice?.body ?? "", /collection_method=send_invoice/);
    assert.match(invoice?.body ?? "", /auto_advance=false/);
    assert.match(invoice?.body ?? "", /metadata%5Bestimate_number%5D=20261102-A/);
    assert.equal(calls.some((call) => call.path.includes("/invoiceitems")), true);
  });
});
