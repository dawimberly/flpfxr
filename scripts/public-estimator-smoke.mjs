/** Local-only browser smoke. Never submits a lead or creates a deployment. */
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
    await page.route("**/api/leads",route=>{leadRequests.push(route.request().method());return route.abort();});
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
    assert.doesNotMatch(await page.locator("body").innerText(),/\$650|crew.?days?|per day|\/day/i);

    // Raw invalid values remain visible and block calculation + navigation.
    await page.getByText("Delivery and additional allowances",{exact:true}).click();
    const delivery=page.getByLabel("Delivery / shipping allowance ($)",{exact:true});
    const specialist=page.getByLabel("Specialist / other allowance ($)",{exact:true});
    for(const field of [delivery,specialist]) {
      for(const bad of ["abc","-1","50001","1e3"]) {
        await field.fill(bad);
        await page.getByText("Enter valid allowances",{exact:true}).waitFor();
        assert.equal(await field.getAttribute("aria-invalid"),"true");
        assert.equal(await page.getByRole("link",{name:"Request an on-site estimate"}).getAttribute("aria-disabled"),"true");
        await page.getByRole("link",{name:"Request an on-site estimate"}).click({force:true});
        assert.ok(page.url().includes("/estimate"),"Invalid inputs must not navigate");
      }
      await field.fill("");
    }

    // Kitchen quartz shows a range with no fabrication input. Switching materials drops that surface price.
    await page.getByLabel("Project type",{exact:true}).selectOption("kitchen");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    assert.equal(await page.getByLabel("Fabrication / installation allowance ($)",{exact:true}).count(),0);
    await page.getByText("between $12,300 and $15,400",{exact:true}).waitFor();
    await page.getByText("Discounted stone remnants may be available — visit our stone yard with Jon to choose.",{exact:true}).waitFor();
    await page.getByLabel("Countertop type").selectOption("laminate");
    await page.getByText("between $10,900 and $13,600",{exact:true}).waitFor();
    await page.getByLabel("Countertop type").selectOption("quartz");

    await delivery.fill("$100");
    await specialist.fill("1,000");
    await page.getByTestId("estimate-delivery-line").waitFor();
    await page.getByTestId("estimate-specialist-line").waitFor();
    assert.match(await total.innerText(),/between \$[\d,]+ and \$[\d,]+/);
    await delivery.fill("");
    await specialist.fill("");

    await page.getByLabel("Project type",{exact:true}).selectOption("bathroom");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByLabel("Shower wall").selectOption("stone");
    assert.equal(await page.getByLabel("Fabrication / installation allowance ($)",{exact:true}).count(),0);
    assert.match(await total.innerText(),/between \$[\d,]+ and \$[\d,]+/);
    await page.getByLabel("Shower wall").selectOption("ceramic");
    await page.getByLabel("Project type",{exact:true}).selectOption("exterior-paint");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    await page.getByText("between $5,300 and $6,700",{exact:true}).waitFor();
    await page.locator("#estimate-coats").selectOption("2");
    await page.getByText("between $8,600 and $10,800",{exact:true}).waitFor();
    await page.getByLabel("Project type",{exact:true}).selectOption("bathroom");
    await page.getByRole("button",{name:"Medium",exact:true}).click();
    const details=page.locator("details");
    if(!await details.evaluate(el=>el.open)) await page.getByText("Delivery and additional allowances",{exact:true}).click();
    await delivery.fill("300");
    await specialist.fill("750");
    await page.getByText("between $10,000 and $12,600",{exact:true}).waitFor();
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
    assert.match(message,/between \$10,000 and \$12,600/);
    assert.match(message,/Project: Bathroom remodeling. Size: Medium. Materials:/);
    assert.match(message,/Preliminary estimate only — not a quote\. Final price is set after Jon sees the space\./);
    assert.doesNotMatch(message,/crew|hours|days|650|shipping|specialist|sq ft|allowance/i);
    assert.deepEqual(leadRequests,[],"No lead submission is allowed");
    assert.deepEqual(pageErrors,[],"Browser page errors");
    for(const path of ["/kitchen","/bathroom"]) assert.equal((await page.request.get(base+path)).status(),200,path);
    await page.close();
    console.log("PASS",width,"px: kitchen range, stone, coats, allowances, tap targets, no overflow, handoff; no lead submitted");
  }
  console.log("Screenshots:",artifacts);
} finally {
  if(browser) await browser.close();
  stopServer();
}
