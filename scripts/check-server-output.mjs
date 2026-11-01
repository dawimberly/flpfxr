import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = ".vercel/output/functions";
if (!existsSync(root)) throw new Error("Missing Vercel function output; run the production build first.");
const files = [];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile() && /\.(mjs|cjs|js)$/.test(entry.name)) files.push(path);
  }
}
visit(root);
if (!files.length) throw new Error("No generated server modules found.");
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error("Invalid generated server module: " + file);
  }
}
console.log("Server syntax check passed: " + files.length + " generated modules.");
