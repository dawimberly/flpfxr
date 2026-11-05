/** Local production-artifact integration; all identities/data are disposable PGLite fixtures. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, copyFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { provisionEmployee } from "./employee-admin.mjs";
import { chromium } from "playwright";
process.env.DATABASE_URL = "";
process.env.VITE_AUTH_ENABLED = "true";
process.env.BETTER_AUTH_SECRET = "isolated-fixture-secret-not-used-in-production";
const functionRoot = resolve(".vercel/output/functions/__server.func"), staticRoot = resolve(".vercel/output/static");
for (const name of (await readdir("node_modules/@electric-sql/pglite/dist")).filter(name=>/\.(?:wasm|data)$/.test(name))) await copyFile("node_modules/@electric-sql/pglite/dist/"+name,functionRoot+"/"+name);
const app = (await import(pathToFileURL(functionRoot+"/index.mjs").href)).default;
const base = "http://localhost:8080";
await app.fetch(new Request(base+"/login"));
const db = await globalThis.__pgliteInstance__;
assert.ok(db,"Embedded QA database initialized");
await globalThis.__pgliteMigrateChain__;
const client = { query: (text,params)=>db.query(text,params) };
const password = "fixture-only-password-very-long";
const employeeId = await provisionEmployee(client,{email:"crew@example.test",password});
await provisionEmployee(client,{email:"outsider@example.test",password});
process.env.EMPLOYEE_USER_IDS = employeeId;
const post = (path,data)=>app.fetch(new Request(base+path,{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify(data)}));
const signup=await post("/api/auth/sign-up/email",{email:"selfsignup@example.test",password,name:"Unapproved"});
assert.equal(signup.status,400);
assert.match(await signup.text(),/SIGN_UP_DISABLED|sign.up.*disabled/i);
assert.equal((await db.query('SELECT id FROM "user" WHERE email = $1',["selfsignup@example.test"])).rows.length,0);
async function token(email) {
  const response=await post("/api/auth/sign-in/email",{email,password});
  assert.equal(response.status,200,await response.clone().text());
  return (await response.json()).token;
}
const employeeToken=await token("crew@example.test"), outsiderToken=await token("outsider@example.test");
const names=JSON.parse(await readFile(functionRoot+"/employee-assets/manifest.json","utf8"));
for (const [session,status] of [[null,401],[outsiderToken,403],[employeeToken,200]]) {
  for(const path of ["/estimator",...names.map(name=>"/api/employee-assets/"+name)]) {
    const response=await app.fetch(new Request(base+path,{headers:session?{authorization:"Bearer "+session}:{}}));
    assert.equal(response.status,status,path+" employee policy");
    if(status!==200) assert.doesNotMatch(await response.text(),/Northville MSRP|install each|laborPerUnit/);
  }
}
for(const path of ["/Flip-Fixer-vs-Cabinet-Bazaar.docx","/Flip-Fixer-marketplace-ad-mock.pdf",...names.map(name=>"/assets/"+name)]) assert.equal((await app.fetch(new Request(base+path))).status,404,path);
const mime={".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".webp":"image/webp",".avif":"image/avif"};
const server=createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,base), file=resolve(staticRoot,"."+decodeURIComponent(url.pathname));
    if(file.startsWith(staticRoot+sep)) {
      try { if((await stat(file)).isFile()) {res.setHeader("Content-Type",mime[extname(file)]??"application/octet-stream");res.end(await readFile(file));return;} } catch { /* dynamic route */ }
    }
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const response=await app.fetch(new Request(url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  } catch(error){console.error(error);res.writeHead(500);res.end("QA server failure");}
});
await new Promise(r=>server.listen(8080,"127.0.0.1",r));
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({extraHTTPHeaders:{authorization:"Bearer "+employeeToken}});
  await page.route("https://**/*", route=>route.fulfill({ status: 200, body: "", contentType: route.request().resourceType()==="stylesheet" ? "text/css" : "text/javascript" }));
  const failures=[];
  page.on("pageerror",error=>failures.push(error.message));
  page.on("requestfailed",request=>failures.push(request.url()+" "+request.failure()?.errorText));
  page.on("response",response=>{if(response.status()>=400 && /\.(?:js|css)(?:\?|$)/.test(response.url()))failures.push(response.status()+" "+response.url());});
  await page.goto(base+"/estimator",{waitUntil:"networkidle"});
  await page.getByRole("heading", { name: "One house. Every room. One number.", exact: true }).waitFor();
  await page.screenshot({path:"employee-access-smoke.png",fullPage:true});
  await page.goto(base+"/estimator/roof",{waitUntil:"networkidle"});
  assert.equal(await page.title(), "Roof trace | The Flip Fixer");
  assert.deepEqual(failures,[],"Employee chunks/imports/styles must load without errors");
  assert.ok(await page.locator('script[type="module"]').count());
  const styleCount=await page.evaluate(()=>document.styleSheets.length);
  assert.ok(styleCount>0,"Employee styles loaded");
  console.log("PASS production employee HTML/chunks/imports/styles; outsider 403; anonymous 401; signup rejected; public documents/static chunks 404.");
} finally {
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
  await db.close();
}
