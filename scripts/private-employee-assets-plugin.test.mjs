import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { privateEmployeeAssetsPlugin } from "./private-employee-assets-plugin.mjs";

function chunk(fileName, moduleId, flags = {}) {
  return {
    type: "chunk",
    fileName,
    modules: { [moduleId]: {} },
    imports: [],
    dynamicImports: [],
    isEntry: false,
    ...flags,
  };
}

async function generateManifest(t, ...chunks) {
  const root = await mkdtemp(join(tmpdir(), "ff-employee-chunks-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugin = privateEmployeeAssetsPlugin();
  plugin.configResolved({ root });
  const bundle = Object.fromEntries(chunks.map(chunk => [chunk.fileName, chunk]));
  plugin.generateBundle.call({ environment: { name: "client" } }, {}, bundle);
  return JSON.parse(await readFile(join(root, ".private-employee-assets.json"), "utf8"));
}

test("rejects a public chunk with a static import of employee cabinet helpers", async t => {
  const entry = chunk("entry.js", "/app/src/router.tsx", { isEntry: true, imports: ["public.js"] });
  const shared = chunk("public.js", "/app/src/lib/public-pricing.ts", { imports: ["cabinets.js"] });
  const cabinets = chunk("cabinets.js", "/app/src/lib/cabinets.ts");
  await assert.rejects(generateManifest(t, entry, shared, cabinets),
    /Public chunk public\.js statically imports employee asset cabinets\.js/);
});

test("rejects an entry that bundles employee code without a separate static import", async t => {
  const entry = chunk("entry.js", "/app/src/lib/cabinets.ts", { isEntry: true });
  await assert.rejects(generateManifest(t, entry),
    /Browser entry chunk entry\.js is classified as an employee asset/);
});

test("allows a lazy employee route and static imports between protected chunks", async t => {
  const entry = chunk("entry.js", "/app/src/router.tsx", { isEntry: true, dynamicImports: ["employee.js"] });
  const employee = chunk("employee.js", "/app/src/components/estimator-app.tsx", {
    isDynamicEntry: true, imports: ["cabinets.js"],
  });
  const cabinets = chunk("cabinets.js", "/app/src/lib/cabinets.ts");
  assert.deepEqual(await generateManifest(t, entry, employee, cabinets), ["employee.js", "cabinets.js"]);
});
