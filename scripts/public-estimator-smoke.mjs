/** Local-only browser smoke. All lead requests are intercepted; no real delivery or Google hits. */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { PRELIMINARY_ESTIMATE_WORDING } from "../src/lib/public-estimate-display.ts";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { toJSONAsync } from "seroval";
import { compareAuthInvariant, probeDevAuthEnabled, buildAuthEnabled } from "./check-auth-invariant.mjs";
import { mergeAppEnv, readAppEnv } from "./with-app-env.mjs";

const base = "http://127.0.0.1:8080";
const artifacts = process.env.GITHUB_ACTIONS ? process.cwd() : mkdtempSync(join(tmpdir(), "flipfixer-estimator-smoke-"));
const server = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "dev", "--host", "127.0.0.1", "--port", "8080", "--strictPort",
], { detached: process.platform !== "win32", windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"], env: mergeAppEnv(readAppEnv(process.cwd()), { ...process.env, CI: "1" }) });
let logs = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", c => { logs=(logs+String(c)).slice(-12000); });
server.on("error", error => { logs += String(error); });
function stopServer() {
  if (!server.pid) return;
  if (process.platform === "win32") {
    server.kill("SIGTERM");
  } else { try { process.kill(-server.pid,"SIGTERM"); } catch { /* already stopped */ } }
  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
}
let browser;
let activePage;
try {
  let ready=false;
  for(let i=0;i<60;i++) {
    if(server.exitCode!==null) break;
    try { if((await fetch(base+"/estimate")).ok) { ready=true; break; } } catch { /* startup */ }
    await delay(500);
  }
  assert.ok(ready,"Local /estimate not ready: "+logs);
  const auth=compareAuthInvariant({devAuthEnabled:await probeDevAuthEnabled(base),buildAuthEnabled:buildAuthEnabled()});
  assert.equal(auth.status,"ok",auth.message);
  browser=await chromium.launch({headless:true});

  for(const width of [1280,390]) for(const mode of ["abort","500"]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    activePage=page;
    await page.goto(base+"/estimate?gclid=keep&utm_source=qa&utm_campaign=recovery",{waitUntil:"networkidle"});
    const primeSize=mode==="abort"?"Small":"Large";
    await page.getByRole("button",{name:primeSize,exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get("size")===primeSize.toLowerCase());
    await page.getByTestId("estimate-total").waitFor();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get("size")==="medium");
    await page.getByTestId("estimate-total").getByText("$12,800",{exact:true}).waitFor();
    let blocked=0;
    await page.route("**/_serverFn/**",route=>{
      blocked++;
      return mode==="abort"?route.abort():route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({error:"temporary-estimate-failure"})});
    });
    const size=mode==="abort"?"Large":"Small";
    await page.getByRole("button",{name:size,exact:true}).click();
    await page.getByRole("status").getByText(/Unable to load your estimate/).waitFor();
    // Drain the router loader and component request before restoring the network.
    await page.waitForLoadState("networkidle");
    await page.getByRole("button",{name:"Retry estimate",exact:true}).waitFor({state:"visible"});
    assert.ok(blocked>0,"A real estimate RPC must fail");
    assert.ok(await page.getByRole("heading",{name:/^Plan your (?:next project|kitchen remodel)\.$/}).isVisible(),"Planner remains mounted instead of router error page");
    assert.equal(new URL(page.url()).searchParams.get("gclid"),"keep");
    assert.equal(new URL(page.url()).searchParams.get("utm_campaign"),"recovery");
    await page.unroute("**/_serverFn/**");
    await page.getByRole("button",{name:"Retry estimate",exact:true}).click();
    await page.getByTestId("estimate-total").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("gclid"),"keep");
    await page.screenshot({path:join(artifacts,"public-estimator-smoke-recovery-"+width+"-"+mode+".png"),fullPage:true});
    await page.close();
    console.log("PASS loader/component recovery",width,mode,"retains attribution and retries the same selection");
  }


  {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    activePage=page;
    page.on("pageerror", e => console.error("BROWSER ERROR", e.message));
    page.on("console", m => { if(m.type()==="error") console.error("BROWSER CONSOLE",m.text()); });
    const ad="gclid=G123&gbraid=B123&wbraid=W123&utm_source=google&utm_medium=cpc&utm_campaign=bath&utm_term=remodel&utm_content=ad";
    await page.goto(base+"/estimate?service=bathroom&size=medium&"+ad,{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:"Plan your bathroom remodel.",exact:true}).waitFor();
    // SSR price is visible before hydration; establish real interactivity first.
    let hydrated = false;
    for (let i = 0; i < 30; i++) {
      await page.getByRole("button",{name:"Large",exact:true}).click();
      if (new URL(page.url()).searchParams.get("size") === "large") { hydrated = true; break; }
      await delay(100);
    }
    assert.ok(hydrated,"Planner must hydrate before handoff verification");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get("size")==="medium");
    assert.equal(await page.getByRole("button",{name:"Bathroom remodeling",exact:true}).getAttribute("aria-pressed"),"true");
    assert.equal(await page.getByRole("button",{name:"Medium",exact:true}).getAttribute("aria-pressed"),"true");
    await page.getByTestId("estimate-total").getByText("$9,300",{exact:true}).waitFor();
    assert.equal(await page.getByText(PRELIMINARY_ESTIMATE_WORDING,{exact:true}).count(),1);
    await page.evaluate(()=>document.fonts?.ready);
    const fold=await page.locator("#estimate-fold").boundingBox();
    assert.ok(fold,"Fold block is missing");
    assert.ok(fold.y+fold.height<=844-88,`Phone fold extends under the call bar: ${Math.round(fold.y+fold.height)}`);
    await page.screenshot({path:join(artifacts,"public-estimator-smoke-before-handoff.png"),fullPage:true});
    console.log("HANDOFF STATE", await page.getByRole("link",{name:"Request an on-site estimate"}).getAttribute("aria-disabled"));
    await page.getByRole("link",{name:"Request an on-site estimate"}).click();
    try { await page.waitForURL(/\/contact/); } catch(error) { console.error("NAV DEBUG", await page.getByRole("link",{name:"Request an on-site estimate"}).getAttribute("href"), await page.evaluate(()=>sessionStorage.getItem("flipfixer-lead-draft")), logs); throw error; }
    const contact=new URL(page.url());
    for(const [key,value] of [["gclid","G123"],["gbraid","B123"],["wbraid","W123"],["utm_source","google"],["utm_medium","cpc"],["utm_campaign","bath"],["utm_term","remodel"],["utm_content","ad"]]) {
      assert.equal(contact.searchParams.get(key),value,key+" missing on /contact");
    }
    assert.equal(contact.searchParams.get("origin"),"estimate");
    await page.goto(base+"/estimate?service=roof&size=tiny&gclid=keep-me",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:"Plan your next project.",exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Kitchen remodeling",exact:true}).getAttribute("aria-pressed"),"true");
    assert.equal(await page.getByRole("button",{name:"Medium",exact:true}).getAttribute("aria-pressed"),"true");
    await page.getByTestId("estimate-total").getByText("$12,800",{exact:true}).waitFor();
    let interactive=false;
    for(let i=0;i<30;i++) {
      await page.getByRole("button",{name:"Large",exact:true}).click();
      if(new URL(page.url()).searchParams.get("size")==="large") { interactive=true; break; }
      await delay(100);
    }
    assert.ok(interactive,"Size change did not sync the URL");
    const synced=new URL(page.url());
    assert.equal(synced.searchParams.get("gclid"),"keep-me");
    assert.equal(synced.searchParams.get("service"),"kitchen");
    assert.equal(synced.searchParams.get("size"),"large");
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    activePage = page;
    await page.goto(base + "/estimate", { waitUntil: "networkidle" });
    const originalBox = await page.getByTestId("estimate-summary").boundingBox();
    let intercepted = 0;
    let rpcUrl;
    await page.route("**/*", async route => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["x-tsr-serverfn"]) return route.continue();
      rpcUrl = request.url();
      intercepted++;
      if (intercepted === 1) return route.abort();
      if (intercepted === 2) await delay(700);
      return route.continue();
    });
    await page.getByLabel("Countertop type").selectOption("laminate");
    await page.getByRole("status").getByText(/Unable to load your estimate/).waitFor();
    // Leave the failed key, then return while its retry is in flight.
    await page.getByLabel("Countertop type").selectOption("quartz");
    await page.getByTestId("estimate-total").waitFor();
    await page.getByLabel("Countertop type").selectOption("laminate");
    await page.getByRole("status").getByText(/Updating/).waitFor();
    assert.doesNotMatch(await page.getByTestId("estimate-summary").innerText(), /Unable to load/);
    const loadingBox = await page.getByTestId("estimate-summary").boundingBox();
    assert.equal(Math.round(loadingBox.height), Math.round(originalBox.height), "Price box must reserve its loading space");
    await page.getByTestId("estimate-total").waitFor();
    await page.unroute("**/*");
    assert.ok(rpcUrl, "Estimate RPC was observed");
    const badPayload = await toJSONAsync({ data: { service: "not-a-service" } });
    const invalid = await page.request.post(rpcUrl, {
      headers: { "content-type": "application/json", "x-tsr-serverFn": "true", origin: base, "sec-fetch-site": "same-origin" },
      data: JSON.stringify(badPayload),
    });
    assert.equal(invalid.status(), 400, "Invalid estimator input must return HTTP 400");
    assert.match(await invalid.text(), /invalid_estimate_input/);
    const asset = await page.request.get(base + "/api/employee-assets/estimator.index-test.js");
    assert.equal(asset.status(), 401, "Employee assets require a real authenticated session");
    assert.match(asset.headers()["cache-control"], /private, no-store/);
    await page.close();
    console.log("PASS retry state, reserved loading space, strict HTTP 400 input validation, and anonymous asset denial");
  }

  const widths=process.env.ESTIMATOR_SMOKE_WIDTH ? [Number(process.env.ESTIMATOR_SMOKE_WIDTH)] : [390,1280];
  for(const width of widths) {
    const page=await browser.newPage({viewport:{width,height:844}});
    const pageErrors=[];
    const leadRequests=[];
    page.on("pageerror",e=>pageErrors.push(e.message));
    await page.route("**/api/leads",async route=>{
      const request = route.request();
      const form = await new Request(request.url(), { method: "POST", headers: request.headers(), body: request.postDataBuffer() }).formData();
      leadRequests.push(Object.fromEntries([...form.entries()].filter(([,value])=>typeof value === "string")));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, submissionId: form.get("submissionId") }) });
    });
    const response=await page.goto(base+"/estimate",{waitUntil:"domcontentloaded"});
    assert.equal(response.status(),200);
    await page.getByTestId("estimate-disclaimer").getByText(PRELIMINARY_ESTIMATE_WORDING,{exact:true}).waitFor();
    await page.getByTestId("estimate-total").getByText("$12,800",{exact:true}).waitFor();
    let interactive=false;
    for(let i=0;i<30;i++) {
      await page.getByRole("button",{name:"Small",exact:true}).click();
      if(await page.getByRole("button",{name:"Small",exact:true}).getAttribute("aria-pressed")==="true") { interactive=true;break; }
      await delay(100);
    }
    assert.ok(interactive,"Estimator hydration failed");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    const total=page.getByTestId("estimate-total");
    await page.getByText("$12,800",{exact:true}).waitFor();
    const bodyText=async()=>page.locator("body").innerText();
    assert.doesNotMatch(await bodyText(),/\$650|crew.?days?|per day|\/day|10% off|remnant|allowance|slab|licensed|insured|waterfall/i);
    await page.getByTestId("estimate-included").waitFor();
    assert.equal(await page.getByTestId("sample-estimate").count(), 0, "No priced sample document competes with the single estimate");
    await page.getByText("Not included: appliances, layout or plumbing moves, electrical, permits, and hidden damage.",{exact:true}).waitFor();

    const floor=page.getByLabel("Kitchen floor (sq ft)",{exact:true});
    for(const bad of ["abc","10"]) {
      await floor.fill(bad);
      await page.getByTestId("estimate-area-error").waitFor();
      assert.equal(await floor.getAttribute("aria-invalid"),"true");
      assert.equal(await page.getByRole("link",{name:"Request an on-site estimate"}).getAttribute("aria-disabled"),"true");
      await page.getByRole("link",{name:"Request an on-site estimate"}).click({force:true});
      assert.ok(page.url().includes("/estimate"),"Invalid inputs must not navigate");
    }
    await floor.fill("168");
    await page.getByText("$12,800",{exact:true}).waitFor();

    await page.getByRole("button",{name:"Kitchen remodeling",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    assert.equal(await page.getByLabel("Fabrication / installation allowance ($)",{exact:true}).count(),0);
    await page.getByText("$12,800",{exact:true}).waitFor();
    await page.getByLabel("Countertop type").selectOption("laminate");
    await page.getByText("$11,300",{exact:true}).waitFor();
    await page.getByLabel("Countertop type").selectOption("quartz");

    await page.getByRole("button",{name:"Bathroom remodeling",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByTestId("estimate-included").getByText("Demolition",{exact:true}).waitFor();
    await page.getByText("$9,300",{exact:true}).waitFor();
    await page.getByLabel("Shower wall").selectOption("stone");
    assert.equal(await page.getByLabel("Fabrication / installation allowance ($)",{exact:true}).count(),0);
    assert.match(await total.innerText(),/^\$[\d,]+$/);
    assert.match(await page.getByTestId("estimate-materials").innerText(),/Stone slab/);
    assert.doesNotMatch(await page.getByTestId("estimate-summary").innerText(),/remnant|10% off|allowance|full slab|licensed|insured|waterfall/i);
    await page.getByLabel("Shower wall").selectOption("ceramic");
    await page.getByRole("button",{name:"Exterior painting",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByText("$5,300",{exact:true}).waitFor();
    await page.locator("#estimate-coats").selectOption("2");
    await page.getByText("$8,600",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Bathroom remodeling",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByText("$9,300",{exact:true}).waitFor();
    const undersized=await page.locator("main select, main input, main button, main summary, main a").evaluateAll(elements=>
      elements.filter(el=>el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0)
        .filter(el=>el.getBoundingClientRect().height<44).map(el=>el.id||el.textContent));
    assert.deepEqual(undersized,[],"Tap targets must be at least 44px high");
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=3,"Horizontal overflow");
    await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.getByTestId("estimate-next").count(), 0, "Planner has no competing four-step form");
    assert.equal(await page.getByRole("button", { name: /Shop the full cabinet catalog/ }).count(), 0);
    assert.doesNotMatch(await page.locator("main").innerText(), /finalize cabinets|cabinet catalog|15% off retail/i);
    assert.equal(await page.getByRole("link", { name: "Request an on-site estimate", exact: true }).count(), 1);
    await page.screenshot({path:join(artifacts,"public-estimator-smoke-"+width+".png"),fullPage:true});

    await page.getByRole("link",{name:"Request an on-site estimate"}).click();
    await page.waitForURL(/\/contact/);
    await page.waitForFunction(()=>document.querySelector('textarea[name="message"]')?.value.includes("Preliminary estimate:"));
    const message=await page.locator('textarea[name="message"]').inputValue();
    assert.match(message,/\$9,300/);
    assert.match(message,/Project: Bathroom remodeling. Size: Medium. Materials:/);
    assert.ok(message.includes(PRELIMINARY_ESTIMATE_WORDING));
    assert.doesNotMatch(message,/crew|hours|days|650|shipping|specialist|sq ft|allowance/i);
    assert.equal(await page.locator('input[name="Source"]').inputValue(),"estimate");
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("ff-first-landing-path")),"/estimate");
    const contactEmail = page.locator('input[name="email"]');
    assert.equal(await contactEmail.getAttribute("required"), "");
    await page.locator('input[name="name"]').fill("LOCAL MOCK ONLY");
    await page.locator('input[name="phone"]').fill("2105550100");
    await page.locator('textarea[name="message"]').fill("Please call me tomorrow about this project.");
    await page.locator("form").first().screenshot({ path: join(artifacts, "contact-required-email-"+width+".png") });
    await page.getByRole("button",{name:"Send it over",exact:true}).click();
    await page.getByText("Add your email so we can send your estimate.").waitFor();
    assert.equal(leadRequests.length,0,"Missing email must not post");
    await contactEmail.fill("sample@example.com");
    await page.getByRole("button",{name:"Send it over",exact:true}).click();
    await page.getByRole("heading",{name:"Sent.",exact:true}).waitFor();
    assert.equal(leadRequests.length,1,"Exactly one mocked request");
    assert.equal(leadRequests[0].email,"sample@example.com");
    assert.equal(leadRequests[0].Source,"estimate");
    assert.equal(leadRequests[0].estimate_service,"bathroom");
    assert.equal(leadRequests[0].estimate_size,"Medium");
    assert.equal(leadRequests[0].estimate_range,"$9,300");
    assert.equal(leadRequests[0].first_landing_path,"/estimate");
    assert.match(leadRequests[0].landing_path,/^\/contact/);
    assert.doesNotMatch(leadRequests[0].message,/\$/);
    assert.equal(await page.evaluate(()=>(window.dataLayer??[]).length),0,"Local hosts must not queue Google hits");
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("flipfixer-lead-draft")).estimate),undefined,"Successful handoff clears stale estimate metadata");
    assert.deepEqual(pageErrors,[],"Browser page errors");
    for(const path of ["/kitchen","/bathroom"]) assert.equal((await page.request.get(base+path)).status(),200,path);
    await page.close();
    console.log("PASS",width,"px: single combined price, handoff source, first landing, structured range after message edit; mocked delivery only");
  }
  console.log("Screenshots:",artifacts);
} catch(error) {
  if(activePage && !activePage.isClosed()) {
    await activePage.screenshot({path:join(artifacts,"public-estimator-smoke-failure.png"),fullPage:true});
    console.error("FAILURE PAGE", await activePage.locator("body").innerText());
  }
  throw error;
} finally {
  if(browser) await browser.close();
  stopServer();
}
