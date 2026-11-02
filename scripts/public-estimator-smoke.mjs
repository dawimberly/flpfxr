/** Local-only browser smoke. All lead requests are intercepted; no real delivery or Google hits. */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
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
    await page.getByTestId("estimate-disclaimer").getByText("Preliminary estimate only — not a quote. Final price is set after Jon sees the space.",{exact:true}).waitFor();
    await page.getByTestId("estimate-total").getByText("between $12,300 and $15,400",{exact:true}).waitFor();
    let interactive=false;
    for(let i=0;i<30;i++) {
      await page.getByRole("button",{name:"Small",exact:true}).click();
      if(await page.getByRole("button",{name:"Small",exact:true}).getAttribute("aria-pressed")==="true") { interactive=true;break; }
      await delay(100);
    }
    assert.ok(interactive,"Estimator hydration failed");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    const total=page.getByTestId("estimate-total");
    await page.getByText("between $12,300 and $15,400",{exact:true}).waitFor();
    const bodyText=async()=>page.locator("body").innerText();
    assert.doesNotMatch(await bodyText(),/\$650|crew.?days?|per day|\/day|10% off|remnant|allowance|slab|licensed|insured|waterfall/i);
    await page.getByTestId("estimate-included").waitFor();
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
    await page.getByText("between $12,300 and $15,400",{exact:true}).waitFor();

    await page.getByRole("button",{name:"Kitchen remodeling",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    assert.equal(await page.getByLabel("Fabrication / installation allowance ($)",{exact:true}).count(),0);
    await page.getByText("between $12,300 and $15,400",{exact:true}).waitFor();
    await page.getByLabel("Countertop type").selectOption("laminate");
    await page.getByText("between $10,900 and $13,600",{exact:true}).waitFor();
    await page.getByLabel("Countertop type").selectOption("quartz");

    await page.getByRole("button",{name:"Bathroom remodeling",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByText("Demolition",{exact:true}).waitFor();
    await page.getByText("between $9,000 and $11,200",{exact:true}).waitFor();
    await page.getByLabel("Shower wall").selectOption("stone");
    assert.equal(await page.getByLabel("Fabrication / installation allowance ($)",{exact:true}).count(),0);
    assert.match(await total.innerText(),/between \$[\d,]+ and \$[\d,]+/);
    assert.match(await page.getByTestId("estimate-materials").innerText(),/Stone slab/);
    assert.doesNotMatch(await page.getByTestId("estimate-summary").innerText(),/remnant|10% off|allowance|full slab|licensed|insured|waterfall/i);
    await page.getByLabel("Shower wall").selectOption("ceramic");
    await page.getByRole("button",{name:"Exterior painting",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByText("between $5,300 and $6,700",{exact:true}).waitFor();
    await page.locator("#estimate-coats").selectOption("2");
    await page.getByText("between $8,600 and $10,800",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Bathroom remodeling",exact:true}).click();
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByText("between $9,000 and $11,200",{exact:true}).waitFor();
    const undersized=await page.locator("main select, main input, main button, main summary, main a").evaluateAll(elements=>
      elements.filter(el=>el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0)
        .filter(el=>el.getBoundingClientRect().height<44).map(el=>el.id||el.textContent));
    assert.deepEqual(undersized,[],"Tap targets must be at least 44px high");
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=3,"Horizontal overflow");
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:join(artifacts,"public-estimator-smoke-"+width+".png"),fullPage:true});

    await page.getByRole("link",{name:"Request an on-site estimate"}).click();
    await page.waitForURL(/\/contact/);
    await page.waitForFunction(()=>document.querySelector('textarea[name="message"]')?.value.includes("Preliminary estimate:"));
    const message=await page.locator('textarea[name="message"]').inputValue();
    assert.match(message,/between \$9,000 and \$11,200/);
    assert.match(message,/Project: Bathroom remodeling. Size: Medium. Materials:/);
    assert.match(message,/Preliminary estimate only — not a quote\. Final price is set after Jon sees the space\./);
    assert.doesNotMatch(message,/crew|hours|days|650|shipping|specialist|sq ft|allowance/i);
    assert.equal(await page.locator('input[name="Source"]').inputValue(),"estimate");
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("ff-first-landing-path")),"/estimate");
    await page.locator('input[name="name"]').fill("LOCAL MOCK ONLY");
    await page.locator('input[name="phone"]').fill("2105550100");
    await page.locator('textarea[name="message"]').fill("Please call me tomorrow about this project.");
    await page.getByRole("button",{name:"Send it over",exact:true}).click();
    await page.getByRole("heading",{name:"Sent.",exact:true}).waitFor();
    assert.equal(leadRequests.length,1,"Exactly one mocked request");
    assert.equal(leadRequests[0].Source,"estimate");
    assert.equal(leadRequests[0].estimate_service,"bathroom");
    assert.equal(leadRequests[0].estimate_size,"Medium");
    assert.equal(leadRequests[0].estimate_range,"between $9,000 and $11,200");
    assert.equal(leadRequests[0].first_landing_path,"/estimate");
    assert.match(leadRequests[0].landing_path,/^\/contact/);
    assert.doesNotMatch(leadRequests[0].message,/\$/);
    assert.equal(await page.evaluate(()=>(window.dataLayer??[]).length),0,"Local hosts must not queue Google hits");
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("flipfixer-lead-draft")).estimate),undefined,"Successful handoff clears stale estimate metadata");
    assert.deepEqual(pageErrors,[],"Browser page errors");
    for(const path of ["/kitchen","/bathroom"]) assert.equal((await page.request.get(base+path)).status(),200,path);
    await page.close();
    console.log("PASS",width,"px: unchanged ranges, handoff source, first landing, structured range after message edit; mocked delivery only");
  }
  console.log("Screenshots:",artifacts);
} finally {
  if(browser) await browser.close();
  stopServer();
}
