#!/usr/bin/env node
import { loadDotEnv } from "./load-dotenv.mjs";

loadDotEnv();
await import("./migrate.mjs");
