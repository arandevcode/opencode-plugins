#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

await rm(join(ROOT, "dist"), { recursive: true, force: true });
