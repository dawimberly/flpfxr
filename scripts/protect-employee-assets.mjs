import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join, basename } from "node:path";

const staticRoot = ".vercel/output/static";
const functionRoot = ".vercel/output/functions/__server.func";
const manifest = JSON.parse(readFileSync(".private-employee-assets.json", "utf8"));
const privateNames = new Set(manifest.map(file => basename(file)));
const privateRoot = join(functionRoot, "employee-assets");
mkdirSync(privateRoot, { recursive: true });
const prefix = "/api/employee-assets/";
function rewrite(code, privateChunk = false) {
  for (const name of privateNames) {
    code = code.replaceAll("./" + name, prefix + name)
      .replaceAll("/assets/" + name, prefix + name)
      .replaceAll('"assets/' + name + '"', '"api/employee-assets/' + name + '"');
  }
  if (privateChunk) {
    // The module is now served outside /assets, so its remaining relative asset
    // imports must explicitly point back to the public shared dependencies.
    code = code.replace(/(["'])\.\/([^"'\s]+\.(?:js|css))\1/g, (_match, quote, file) => quote + "/assets/" + file + quote);
  }
  return code;
}
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (/\.(?:js|mjs|css|html|json)$/.test(entry.name)) {
      const isPrivate = privateNames.has(entry.name);
      writeFileSync(path, rewrite(readFileSync(path, "utf8"), isPrivate));
    }
  }
}
visit(staticRoot);
// SSR manifests must use the authenticated URLs as well.
for (const name of readdirSync(functionRoot)) {
  if (/\.(?:js|mjs|json)$/.test(name)) {
    const path = join(functionRoot, name);
    writeFileSync(path, rewrite(readFileSync(path, "utf8")));
  }
}
for (const file of manifest) renameSync(join(staticRoot, file), join(privateRoot, basename(file)));
writeFileSync(join(privateRoot, "manifest.json"), JSON.stringify([...privateNames]));
// Never leave an alternate static copy or a source map with confidential text.
const forbidden = /Northville MSRP|install each|laborPerUnit|laborPerOversized|personHours|adjustedDays|CREW_DAY_RATE|materialsAtCost|laborRate/;
function audit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) audit(path);
    else if (/\.(?:js|mjs|map|json)$/.test(entry.name) && forbidden.test(readFileSync(path, "utf8"))) {
      throw new Error("Confidential pricing remains in public output: " + path);
    }
  }
}
audit(staticRoot);
console.log("Protected " + privateNames.size + " employee chunks; public pricing scan passed.");
