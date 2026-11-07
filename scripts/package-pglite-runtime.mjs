import { copyFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

/** Runtime files Nitro-inlined PGLite needs beside `__server.func/index.mjs`. */
export const REQUIRED_PGLITE_RUNTIME_FILES = Object.freeze([
  "initdb.wasm",
  "pglite.data",
  "pglite.wasm",
]);

/** Keep only PGLite dist runtime artifacts (wasm/data). */
export function listPgliteRuntimeFiles(names) {
  return names.filter((name) => /\.(?:wasm|data)$/.test(name));
}

/**
 * Fail closed when any required runtime file is absent from the package source.
 * @param {Iterable<string>} availableNames
 */
export function assertRequiredPgliteRuntimeFiles(availableNames) {
  const available = new Set(availableNames);
  for (const required of REQUIRED_PGLITE_RUNTIME_FILES) {
    if (!available.has(required)) {
      throw new Error("Missing PGLite runtime dependency: " + required);
    }
  }
}

/**
 * @param {{
 *   sourceDir: string,
 *   targetDir: string,
 *   readdir?: typeof readdir,
 *   copyFile?: typeof copyFile,
 *   stat?: typeof stat,
 * }} options
 */
export async function packagePgliteRuntime({
  sourceDir,
  targetDir,
  readdir: readDir = readdir,
  copyFile: copy = copyFile,
  stat: fileStat = stat,
}) {
  await fileStat(resolve(targetDir, "index.mjs"));
  const files = listPgliteRuntimeFiles(await readDir(sourceDir));
  assertRequiredPgliteRuntimeFiles(files);
  for (const name of files) {
    await copy(resolve(sourceDir, name), resolve(targetDir, name));
  }
  return files;
}

function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url)) {
  // Nitro inlines PGLite into index.mjs, so its runtime files must live beside it.
  const source = resolve("node_modules/@electric-sql/pglite/dist");
  const target = resolve(".vercel/output/functions/__server.func");
  const files = await packagePgliteRuntime({ sourceDir: source, targetDir: target });
  console.log(
    "Packaged PGLite runtime files in the server function: " + files.join(", "),
  );
}
