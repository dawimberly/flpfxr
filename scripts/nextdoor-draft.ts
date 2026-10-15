#!/usr/bin/env node
/**
 * Local draft desk for Nextdoor. Does not log in, read the feed, or post.
 *
 *   node --experimental-strip-types scripts/nextdoor-draft.ts status
 *   node --experimental-strip-types scripts/nextdoor-draft.ts draft --channel business-page --text "..."
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dispatch,
  initialState,
  loadState,
  parseCliArgs,
  serializeState,
  STATE_FILENAME,
  type CliCommand,
  type DraftState,
} from "../src/lib/nextdoor-draft.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = join(ROOT, "data", STATE_FILENAME);

function readState(): DraftState {
  try {
    return loadState(readFileSync(STATE_PATH, "utf8"));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT") return initialState();
    const message = error instanceof Error ? error.message : "Could not read the state file.";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

function writeState(state: DraftState) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, serializeState(state));
}

function bodyFor(command: CliCommand, fileText: string): string {
  if (command.type === "profile-set") {
    if (command.file) return fileText;
    if (command.json !== null) return command.json;
    return readFileSync(0, "utf8");
  }
  if (command.type !== "draft") return "";
  if (command.file) return fileText;
  if (command.text !== null) return command.text;
  return readFileSync(0, "utf8");
}

const parsed = parseCliArgs(process.argv.slice(2));
if ("error" in parsed) {
  process.stderr.write(`${parsed.error}\n`);
  process.exit(1);
}

let fileText = "";
if (
  (parsed.command.type === "draft" || parsed.command.type === "profile-set") &&
  parsed.command.file
) {
  try {
    fileText = readFileSync(parsed.command.file, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that file.";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

const before = readState();
const outcome = dispatch(parsed.command, bodyFor(parsed.command, fileText), before, new Date());
if (outcome.stdout) process.stdout.write(outcome.stdout);
if (serializeState(outcome.state) !== serializeState(before)) writeState(outcome.state);
process.exit(outcome.exitCode);
