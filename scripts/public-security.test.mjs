import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deflateRawSync, gzipSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { scanPublicPricing } from "./scan-public-pricing.mjs";
function docx(text) {
  const name = Buffer.from("word/document.xml"), raw = Buffer.from('<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>'), data = deflateRawSync(raw);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8,8); local.writeUInt32LE(data.length,18); local.writeUInt32LE(raw.length,22); local.writeUInt16LE(name.length,26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8,10); central.writeUInt32LE(data.length,20); central.writeUInt32LE(raw.length,24); central.writeUInt16LE(name.length,28);
  const start = local.length+name.length+data.length, end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1,8); end.writeUInt16LE(1,10); end.writeUInt32LE(central.length+name.length,12); end.writeUInt32LE(start,16);
  return Buffer.concat([local,name,data,central,name,end]);
}
test("public scan rejects every requested marker, compressed DOCX/PDF and alternate output paths", async () => {
  const root = await mkdtemp(join(tmpdir(),"ff-public-scan-"));
  try {
    for (const marker of ["MSRP", "Our cost", "Labor rates", "install each", "$75", "$125", "O&P", "margin", "profit margins"]) {
      for (const ext of ["txt","json","docx"]) {
        const path = join(root,"internal."+ext);
        await writeFile(path,ext === "docx" ? docx(marker) : marker);
        await assert.rejects(scanPublicPricing([root]), /Confidential pricing/);
        await rm(path);
      }
    }
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText("Our cost and labor rates", { font });
    await writeFile(join(root,"internal.pdf"), await pdf.save({ useObjectStreams: true }));
    await assert.rejects(scanPublicPricing([root]), /Confidential pricing/);
    await rm(join(root,"internal.pdf"));
    await writeFile(join(root,"leak.js.gz"),gzipSync("MSRP"));
    await assert.rejects(scanPublicPricing([root]), /Confidential pricing/);
    await rm(join(root,"leak.js.gz"));
    await writeFile(join(root,"safe.css"),"main { margin: 0; }");
    assert.equal(await scanPublicPricing([root]),1);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test("admin provisioning never calls a public signup endpoint", async () => {
  for (const file of ["scripts/create-employee.mjs","scripts/reset-employee-password.mjs","scripts/employee-admin.mjs"]) {
    assert.doesNotMatch(await readFile(file,"utf8"), /fetch\(|sign-up\/email/);
  }
});
