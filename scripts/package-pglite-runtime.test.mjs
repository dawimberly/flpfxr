import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  REQUIRED_PGLITE_RUNTIME_FILES,
  assertRequiredPgliteRuntimeFiles,
  listPgliteRuntimeFiles,
  packagePgliteRuntime,
} from "./package-pglite-runtime.mjs";

test("required list is exactly initdb.wasm, pglite.data, and pglite.wasm", () => {
  assert.deepEqual([...REQUIRED_PGLITE_RUNTIME_FILES], [
    "initdb.wasm",
    "pglite.data",
    "pglite.wasm",
  ]);
});

test("listPgliteRuntimeFiles keeps only wasm/data names", () => {
  assert.deepEqual(
    listPgliteRuntimeFiles([
      "pglite.wasm",
      "readme.md",
      "initdb.wasm",
      "pglite.data",
      "index.js",
    ]),
    ["pglite.wasm", "initdb.wasm", "pglite.data"],
  );
});

test("assertRequiredPgliteRuntimeFiles accepts a complete source set", () => {
  assert.doesNotThrow(() =>
    assertRequiredPgliteRuntimeFiles([
      "initdb.wasm",
      "pglite.data",
      "pglite.wasm",
      "extra.data",
    ]),
  );
});

test("assertRequiredPgliteRuntimeFiles fails clearly when initdb.wasm is missing", () => {
  assert.throws(
    () => assertRequiredPgliteRuntimeFiles(["pglite.data", "pglite.wasm"]),
    /Missing PGLite runtime dependency: initdb\.wasm/,
  );
});

test("assertRequiredPgliteRuntimeFiles fails clearly when pglite.data is missing", () => {
  assert.throws(
    () => assertRequiredPgliteRuntimeFiles(["initdb.wasm", "pglite.wasm"]),
    /Missing PGLite runtime dependency: pglite\.data/,
  );
});

test("assertRequiredPgliteRuntimeFiles fails clearly when pglite.wasm is missing", () => {
  assert.throws(
    () => assertRequiredPgliteRuntimeFiles(["initdb.wasm", "pglite.data"]),
    /Missing PGLite runtime dependency: pglite\.wasm/,
  );
});

test("packagePgliteRuntime rejects a source directory missing a required file", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ff-pglite-pkg-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = join(root, "source");
  const targetDir = join(root, "target");
  await mkdir(sourceDir);
  await mkdir(targetDir);
  await writeFile(join(targetDir, "index.mjs"), "export default {};\n");
  await writeFile(join(sourceDir, "pglite.data"), "data");
  await writeFile(join(sourceDir, "pglite.wasm"), "wasm");
  // deliberately omit initdb.wasm

  await assert.rejects(
    packagePgliteRuntime({ sourceDir, targetDir }),
    /Missing PGLite runtime dependency: initdb\.wasm/,
  );
});
