import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync, deflateRawSync, gzipSync } from "node:zlib";
import { scanPublicPricing } from "./scan-public-pricing.mjs";
async function fixture(name, bytes, reject = false) {
  const root=await mkdtemp(join(tmpdir(),"ff-encoding-"));
  try {await writeFile(join(root,name),bytes);if(reject)await assert.rejects(scanPublicPricing([root]));else assert.equal(await scanPublicPricing([root]),1);}
  finally {await rm(root,{recursive:true,force:true});}
}
function zip(name,raw) {
  const n=Buffer.from(name), data=deflateRawSync(raw), l=Buffer.alloc(30), c=Buffer.alloc(46), e=Buffer.alloc(22);
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(8,8);l.writeUInt32LE(data.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(8,10);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);
  e.writeUInt32LE(0x06054b50);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(c.length+n.length,12);e.writeUInt32LE(l.length+n.length+data.length,16);
  return Buffer.concat([l,n,data,c,n,e]);
}
function png(type,data) {
  function chunk(name,bytes){const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);return Buffer.concat([length,Buffer.from(name),bytes,Buffer.alloc(4)]);}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk(type,data),chunk("IEND",Buffer.alloc(0))]);
}
for (const [label,encode] of [
  ["decimal entities",s=>s.replace("$","&#36;")],
  ["hex entities",s=>s.replace("$","&#x24;")],
  ["named entities",s=>s.replace("$","&dollar;").replace(" ","&nbsp;")],
  ["zero-width",s=>s.split("").join("\u200b")],
  ["soft hyphen",s=>s.split("").join("\u00ad")],
  ["fullwidth",s=>s.replace("$","＄").replace("75","７５")],
  ["UTF-16LE",s=>Buffer.from("\ufeff"+s,"utf16le")],
  ["UTF-16BE",s=>Buffer.from("\ufeff"+s,"utf16le").swap16()],
]) test("normalizes "+label+" with safe and sensitive fixtures",async()=>{await fixture("text.txt",encode("Welcome home"));await fixture("text.txt",encode("$75 labor"),true);});
test("all named HTML/XML entities and split markup are decoded",async()=>{
  await fixture("text.html","<p>Welcome&nbsp;home &copy;</p>");
  await fixture("text.html","<p>Our&nbsp;cost</p>",true);
  await fixture("text.xml","<t>MS</t><t>RP</t>",true);
  await fixture("text.txt","&amp;#x24;75",true);
  await fixture("text.txt","＆＃ｘ２４；７５",true);
  await fixture("text.txt","&d\u200bollar;75",true);
});
test("extension allow-list rejects unknown formats, ODT, DOCM and RTF",async()=>{
  await fixture("safe.txt","Welcome home");
  for(const ext of ["bin","odt","docm","rtf"])for(const value of ["Welcome home","MSRP"])await fixture("file."+ext,value,true);
  for(const value of ["Welcome home","MSRP"])await fixture("renamed.txt","{\\rtf1 "+value+"}",true);
  await fixture("rtf-escapes.txt","{\\rtf1 \\'4d\\'53\\'52\\'50}",true);
});
test("ZIP signatures reject renamed archives and inspect DOCX including nested payloads",async()=>{
  for(const text of ["Welcome home","MSRP"]){const b=zip("word/document.xml",Buffer.from(text));await fixture("renamed.txt",b,true);await fixture("renamed.png",b,true);await fixture("file.docx",b,text==="MSRP");}
  await fixture("nested.docx",zip("word/document.xml",zip("word/document.xml",Buffer.from("Welcome home"))),true);
  await fixture("nested.docx",zip("word/document.xml",zip("word/document.xml",Buffer.from("MSRP"))),true);
});
for(const [kind,compress] of [["gzip",gzipSync],["zlib",deflateSync]])test(kind+" signatures survive renamed and nested files",async()=>{
  for(const text of ["Welcome home","MSRP"]){await fixture("renamed.txt",compress(text),text==="MSRP");await fixture("nested.txt",compress(compress(text)),text==="MSRP");}
  for(const text of ["Welcome home","MSRP"])await fixture("document.docx.gz",gzipSync(zip("word/document.xml",Buffer.from(text))),text==="MSRP");
  await fixture("broken.txt",compress("Welcome home").subarray(0,5),true);
});
for(const type of ["tEXt","zTXt","iTXt","iTXt-plain"])test("PNG "+type+" scans even short metadata",async()=>{
  for(const text of ["Hi","MSRP","$75","Our\u00a0cost"]){
    const bytes=Buffer.from(text,type==="tEXt"||type==="zTXt"?"latin1":"utf8");let data;
    if(type==="tEXt")data=Buffer.concat([Buffer.from("k\0"),bytes]);
    else if(type==="zTXt")data=Buffer.concat([Buffer.from("k\0\0"),deflateSync(bytes)]);
    else data=Buffer.concat([Buffer.from([107,0,type==="iTXt"?1:0,0,0,0]),type==="iTXt"?deflateSync(bytes):bytes]);
    await fixture("metadata.png",png(type.slice(0,4),data),text!=="Hi");
  }
});
test("new pricing phrases fail while ordinary prose/layout passes",async()=>{
  for(const text of ["overhead and profit","markup","off list","dealer price","labor 42/hr","labor 19/unit","19/unit labor"])await fixture("phrase.txt",text,true);
  for(const text of ["Welcome home","labor of love","kitchen design","main { margin: 0; }"])await fixture("safe.css",text);
});

test("allows only the approved Premium cabinet offer without masking other pricing text", async () => {
  const offer = "Premium Northville cabinets at 20% off MSRP.";
  await fixture("page.html", `<p>${offer}</p>`);
  await fixture("chunk.js", `const offer = "${offer}";`);
  await fixture("page.html", `<p>${offer}</p><p>Northville MSRP by SKU</p>`, true);
  await fixture("chunk.js", `const offer = "${offer}"; const laborPerUnit = 75;`, true);
  await fixture("page.html", "<p>Builder Grade Northville cabinets at 25% off MSRP.</p>", true);
});
