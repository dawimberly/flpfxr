import { copyFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("node_modules/@electric-sql/pglite/dist");
const target = resolve(".vercel/output/functions/__server.func");

// Nitro inlines PGLite into index.mjs, so its runtime files must live beside it.
await stat(resolve(target, "index.mjs"));
const files = (await readdir(source)).filter(name => /\.(?:wasm|data)$/.test(name));
for (const required of ["pglite.data", "pglite.wasm"]) {
  if (!files.includes(required)) throw new Error("Missing PGLite runtime dependency: " + required);
}
for (const name of files) await copyFile(resolve(source, name), resolve(target, name));
console.log("Packaged PGLite runtime files in the server function: " + files.join(", "));
