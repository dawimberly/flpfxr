/** Local production-artifact integration; all identities/data are disposable PGLite fixtures. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { provisionEmployee } from "./employee-admin.mjs";
import { chromium } from "playwright";
import { toJSONAsync } from "seroval";
process.env.DATABASE_URL = "";
process.env.VITE_AUTH_ENABLED = "true";
process.env.BETTER_AUTH_SECRET = "isolated-fixture-secret-not-used-in-production";
const functionRoot = resolve(".vercel/output/functions/__server.func"), staticRoot = resolve(".vercel/output/static");
for (const name of ["pglite.data", "pglite.wasm"]) {
  assert.ok((await stat(resolve(functionRoot, name))).size > 0, "Build must package " + name);
}
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
const cookieByEmail = new Map();
async function token(email) {
  const response=await post("/api/auth/sign-in/email",{email,password});
  assert.equal(response.status,200,await response.clone().text());
  cookieByEmail.set(email, response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; "));
  return (await response.json()).token;
}
const employeeToken=await token("crew@example.test"), outsiderToken=await token("outsider@example.test");
const names=JSON.parse(await readFile(functionRoot+"/employee-assets/manifest.json","utf8"));
for (const [session,status] of [[null,401],[outsiderToken,403],[employeeToken,200]]) {
  for(const path of ["/estimator","/Estimator","/ESTIMATOR/roof","/eStimator/Roof",...names.map(name=>"/api/employee-assets/"+name)]) {
    const response=await app.fetch(new Request(base+path,{headers:session?{authorization:"Bearer "+session}:{}}));
    assert.equal(response.status,status,path+" employee policy");
    if(status!==200) {
      const body = await response.text();
      assert.doesNotMatch(body,/Northville MSRP|install each|laborPerUnit|One house. Every room/);
      if(status===401 && /estimator/i.test(path) && !path.includes("employee-assets")) assert.match(body,/href="\/login"/);
    }
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
  const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Keep this hydration regression independent of third-party availability.
  await visitor.route("https://**/*", route => route.fulfill({ status: 200, body: "", contentType: route.request().resourceType() === "stylesheet" ? "text/css" : "text/javascript" }));
  const blockedImports = [];
  const pageErrors = [];
  visitor.on("pageerror", error => pageErrors.push(error.message));
  visitor.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/employee-assets/")) blockedImports.push(request.url());
  });
  await visitor.goto(base + "/", { waitUntil: "networkidle" });
  await visitor.getByRole("button", { name: "Open menu", exact: true }).click();
  await visitor.getByRole("dialog", { name: "Menu" }).waitFor();
  await visitor.goto(base + "/estimate", { waitUntil: "networkidle" });

  const total = visitor.getByTestId("estimate-total");
  const sizeButton = name => visitor.getByRole("button", { name, exact: true });
  async function readTotal() {
    await total.waitFor();
    const text = (await total.innerText()).trim();
    assert.match(text, /^\$\d{1,3}(?:,\d{3})*$/, "Expected one formatted preliminary total");
    const value = Number(text.replace(/[$,]/g, ""));
    assert.ok(value > 0, "Preliminary total must be positive");
    return value;
  }

  assert.equal(await sizeButton("Medium").getAttribute("aria-pressed"), "true");
  const mediumTotal = await readTotal();
  const totals = { Medium: mediumTotal };
  let previousTotal = mediumTotal;
  for (const size of ["Small", "Large"]) {
    const button = sizeButton(size);
    await button.click();
    await visitor.waitForURL(url => url.searchParams.get("size") === size.toLowerCase());
    await visitor.waitForFunction(previous => {
      const text = document.querySelector('[data-testid="estimate-total"]')?.textContent?.trim();
      return /^\$\d{1,3}(?:,\d{3})*$/.test(text ?? "") &&
        Number(text.replace(/[$,]/g, "")) !== previous;
    }, previousTotal);
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.equal(await visitor.locator('button[aria-pressed="true"]').filter({ hasText: /^(Small|Medium|Large)$/ }).count(), 1);
    totals[size] = await readTotal();
    previousTotal = totals[size];
  }
  assert.ok(totals.Small < mediumTotal && mediumTotal < totals.Large,
    "Expected Small < Medium < Large preliminary totals: " + JSON.stringify(totals));
  assert.deepEqual(blockedImports, [], "Public pages must not load employee chunks");
  assert.deepEqual(pageErrors, [], "Public pages must hydrate without uncaught errors");
  await visitor.close();
  console.log("PASS signed-out production mobile menu and estimator hydration", totals);

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
  const source = await readFile(functionRoot+"/index.mjs","utf8");
  const cookie = cookieByEmail.get("crew@example.test");
  assert.match(cookie,/session_data/ , "Test must exercise a populated signed session cache");
  const ids = ["pullCloudJobs","pullCloudDraft"].map(name=>{
    const line=source.split("\n").find(line=>line.includes(name+" = createServerFn") && line.includes("createSsrRpc"));
    const id=line?.match(/createSsrRpc\("([^"]+)"\)/)?.[1];
    assert.ok(id,"Find generated RPC for "+name);return {name,id};
  });
  const body=JSON.stringify(await toJSONAsync({data:undefined,context:{}}));
  const rpc = id => app.fetch(new Request(base+"/_serverFn/"+id,{method:"POST",headers:{cookie,origin:base,"sec-fetch-site":"same-origin","content-type":"application/json","x-tsr-serverFn":"true"},body}));
  for(const {name,id} of ids)assert.equal((await rpc(id)).status,200,name+" accepts crew before reset");
  await provisionEmployee(client,{email:"crew@example.test",password:password+"-reset",reset:true});
  for(const {name,id} of ids) {
    const revoked=await rpc(id);
    assert.equal(revoked.status,401,name+" must immediately reject old cached cookies: "+await revoked.text());
  }
  console.log("PASS production employee HTML/chunks/imports/styles; mixed-case paths; outsider 403; anonymous 401/login link; signup rejected; removed static URLs 404; cached cookie revoked immediately for both crew RPCs.");
} finally {
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
  await db.close();
}
