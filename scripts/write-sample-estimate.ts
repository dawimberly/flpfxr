/**
 * Writes the public sample job estimate from the current PDF renderer.
 * Run: node --experimental-strip-types scripts/write-sample-estimate.ts
 */
import { writeFileSync } from "node:fs";
import { buildLaborDocument } from "../src/lib/labor-estimate.ts";
import { renderLaborEstimatePdf } from "../src/lib/labor-estimate-pdf.ts";
import { DEFAULT_PROJECT_INPUTS } from "../src/lib/public-estimate-options.ts";

const document = buildLaborDocument({
  v: 1,
  project: { ...DEFAULT_PROJECT_INPUTS },
  address: "100 Sample Street, San Antonio, TX 78205",
  note: "Sample only. This is not a real job.",
  occupancy: "",
  timing: "",
  decision: "",
});

const bytes = await renderLaborEstimatePdf({
  document,
  name: "Sample Customer",
  phone: "(210) 555-0100",
  email: "sample@example.com",
  feeLabel: "$35.00",
  catalogUrl: "https://stylesbydesigntx.com/shop?ref=flipfixer",
  submissionId: "sample-estimate",
  issued: new Date("2026-11-02T12:00:00Z"),
  sample: true,
});

writeFileSync("public/sample-estimate.pdf", bytes);
console.log(`wrote public/sample-estimate.pdf (${bytes.byteLength} bytes)`);
