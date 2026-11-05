/** Anonymous production-output checks. No lead submissions or external service calls. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, copyFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const functionRoot = ".vercel/output/functions/__server.func";
for (const name of ["pglite.data", "pglite.wasm"]) {
  copyFileSync("node_modules/@electric-sql/pglite/dist/" + name, functionRoot + "/" + name);
}
const names = JSON.parse(readFileSync(functionRoot + "/employee-assets/manifest.json", "utf8"));
const base = "http://127.0.0.1:8188";
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "8188", "--strictPort"], {
  env: { ...process.env, DATABASE_URL: "" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", data => { logs = (logs + data).slice(-8000); });
child.stderr.on("data", data => { logs = (logs + data).slice(-8000); });
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) break;
    try { if ((await fetch(base + "/northville", { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } } catch { /* startup */ }
    await delay(500);
  }
  assert.ok(ready, "Production preview did not start: " + logs);
  for (const name of names) {
    const publicResponse = await fetch(base + "/assets/" + name);
    assert.equal(publicResponse.status, 404, "Private chunk must not remain at its static URL: " + name);
    const privateResponse = await fetch(base + "/api/employee-assets/" + name);
    assert.equal(privateResponse.status, 401, "Anonymous private-asset request must be rejected: " + name);
    assert.match(privateResponse.headers.get("cache-control"), /private, no-store/);
    assert.doesNotMatch(await privateResponse.text(), /MSRP|install each|laborPerUnit/);
  }
  assert.equal((await fetch(base + "/financing")).status, 404);
  console.log("PASS production-output HTTP: " + names.length + " confidential chunks removed from static assets and denied anonymously");
} finally {
  child.kill("SIGTERM");
  child.stdout.destroy(); child.stderr.destroy(); child.unref();
}
