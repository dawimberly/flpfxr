/** Public one-price illustration. Never use the internal itemized PDF renderer here. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { publicEstimateResult } from "../src/lib/public-estimate-result.server.ts";
import { DEFAULT_PROJECT_INPUTS } from "../src/lib/public-estimate-options.ts";
import { formatPublicEstimate, PRELIMINARY_ESTIMATE_WORDING } from "../src/lib/public-estimate-display.ts";

export async function createSampleEstimatePdf() {
  const result=publicEstimateResult({...DEFAULT_PROJECT_INPUTS});
  if(!result)throw new Error("Sample estimate unavailable");
  const pdf=await PDFDocument.create();
  pdf.setTitle("Sample preliminary estimate");
  pdf.setSubject("Illustrative kitchen project; not a real customer's estimate");
  const sans=await pdf.embedFont(StandardFonts.Helvetica), bold=await pdf.embedFont(StandardFonts.HelveticaBold), display=await pdf.embedFont(StandardFonts.TimesRomanBold);
  const page=pdf.addPage([612,792]);
  const ink=rgb(0.08,0.22,0.25), muted=rgb(0.32,0.37,0.38), accent=rgb(0.96,0.47,0.12), pale=rgb(0.96,0.96,0.94);
  const text=(value:string,y:number,size=12,font=sans,color=ink)=>page.drawText(value,{x:48,y,size,font,color});
  page.drawRectangle({x:0,y:780,width:612,height:12,color:accent});
  text("THE FLIP FIXER",732,21,display);
  text("SAN ANTONIO REMODELING",709,10,sans,muted);
  text("SAMPLE",660,11,bold,accent);
  text("One project. One preliminary estimate.",625,25,display);
  text("An illustration of the online planner, not a real customer's project.",600,11,sans,muted);
  page.drawRectangle({x:48,y:444,width:516,height:128,color:pale});
  text("Example kitchen remodel",541,14,bold);
  text(formatPublicEstimate(result.total),486,40,display);
  text("Medium kitchen",410,14,bold);
  for(const [i,line] of ["Luxury vinyl plank flooring", "Quartz countertops", "Cabinet installation", "Primer and paint"].entries())text(line,383-i*20,12,sans,muted);
  text("Preliminary estimate only - not a quote.",277,13,bold);
  text("Final price is confirmed after an on-site review.",255,12,sans,muted);
  // Keep the public disclaimer contract while using standard-font-safe punctuation.
  if(!PRELIMINARY_ESTIMATE_WORDING.includes("Final price is confirmed"))throw new Error("Review sample disclaimer wording");
  text("Not included: appliances, layout or plumbing moves, electrical,",215,10,sans,muted);
  text("permits, and hidden damage.",199,10,sans,muted);
  page.drawLine({start:{x:48,y:159},end:{x:564,y:159},thickness:1,color:accent});
  text("Plan your own project",127,16,display);
  text("theflipfixer.com/estimate",102,12,bold);
  text("Call (210) 436-9117",80,12,sans,muted);
  return pdf.save();
}
export async function writeSampleEstimate() {
  const bytes=await createSampleEstimatePdf();
  writeFileSync("public/sample-estimate.pdf",bytes);
  const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const {createCanvas}=await import("@napi-rs/canvas");
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false});
  const doc=await task.promise;
  try {
    const page=await doc.getPage(1),viewport=page.getViewport({scale:1.5});
    const canvas=createCanvas(viewport.width,viewport.height);
    await page.render({canvasContext:canvas.getContext("2d") as never,viewport,canvas:canvas as never}).promise;
    writeFileSync("public/sample-estimate.png",canvas.toBuffer("image/png"));
  } finally {await task.destroy();}
  console.log("Wrote matching one-price public sample PDF and PNG.");
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await writeSampleEstimate();
