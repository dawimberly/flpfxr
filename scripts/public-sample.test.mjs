import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PDFDocument,StandardFonts} from "pdf-lib";
import {createSampleEstimatePdf} from "./write-sample-estimate.ts";
import {scanPublicPricing} from "./scan-public-pricing.mjs";
import {publicEstimateResult} from "../src/lib/public-estimate-result.server.ts";
import {DEFAULT_PROJECT_INPUTS} from "../src/lib/public-estimate-options.ts";
import {formatPublicEstimate} from "../src/lib/public-estimate-display.ts";
async function pdfText(bytes){const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const doc=await task.promise;try{return (await (await doc.getPage(1)).getTextContent()).items.map(item=>item.str??"").join(" ");}finally{await task.destroy();}}
test("public sample and generator contain exactly one computed project price",async()=>{
  const expected=formatPublicEstimate(publicEstimateResult({...DEFAULT_PROJECT_INPUTS}).total);
  for(const bytes of [await createSampleEstimatePdf(),await readFile("public/sample-estimate.pdf")]){
    const text=await pdfText(bytes);
    assert.deepEqual(text.match(/\$[\d,]+(?:\.\d+)?/g),[expected]);
    assert.match(text,/SAMPLE/);
    assert.match(text,/Preliminary estimate only - not a quote/);
    assert.match(text,/theflipfixer.com\/estimate/);
    assert.doesNotMatch(text,/itemized|between|range|credit|MSRP|our cost|labor rate|install each|guaranteed|starting at|free quote|insurance claims/i);
  }
  const png=await readFile("public/sample-estimate.png");assert.equal(png.subarray(1,4).toString(),"PNG");
});
test("PDF metadata is scanned and attachments are rejected",async()=>{
  const root=await mkdtemp(join(tmpdir(),"ff-pdf-metadata-")),path=join(root,"sample.pdf");
  try{
    async function fixture(subject,attachment=false){const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText("Welcome home",{font});pdf.setSubject(subject);if(attachment)await pdf.attach(Buffer.from("MSRP"),"internal.txt");await writeFile(path,await pdf.save());}
    await fixture("Public sample");assert.equal(await scanPublicPricing([root]),1);
    await fixture("Our cost");await assert.rejects(scanPublicPricing([root]),/Confidential pricing/);
    await fixture("Public sample",true);await assert.rejects(scanPublicPricing([root]),/attachments/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("ordinary HTML markup identifiers pass while financial markup fails",async()=>{
  const root=await mkdtemp(join(tmpdir(),"ff-markup-")),path=join(root,"app.js");
  try{
    await writeFile(path,'const markup="<p>Welcome home</p>";');assert.equal(await scanPublicPricing([root]),1);
    await writeFile(path,'const markup=20;');await assert.rejects(scanPublicPricing([root]),/Confidential pricing/);
    await writeFile(path,'const copy="20% markup";');await assert.rejects(scanPublicPricing([root]),/Confidential pricing/);
  }finally{await rm(root,{recursive:true,force:true});}
});
