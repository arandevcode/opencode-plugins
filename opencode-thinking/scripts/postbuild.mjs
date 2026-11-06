#!/usr/bin/env node
import { readdir, readFile, rm } from "fs/promises";
import { join } from "path";

const DIST = new URL("../dist", import.meta.url).pathname;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p);
    } else if (e.name === "index.html" && (await readFile(p, "utf8")).includes("Directory listing")) {
      await rm(p);
      console.log(`[postbuild] removed ${p}`);
    }
  }
}

await walk(DIST);
