#!/usr/bin/env node
import { copyFile, readdir, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

/**
 * Strategy: TSC handles the .ts → .js transformation and emits .d.ts files
 * for IDE consumers. JSX/TSX files are NOT compiled — @opentui/solid's JSX
 * runtime is shipped as TS-only and must be transformed by OpenCode's host
 * runtime (Bun). We copy the .tsx sources verbatim so OpenCode's plugin
 * loader can compile them on import.
 *
 * We also strip the .jsx artifacts tsc leaves behind when jsx=preserve is on,
 * plus the auto-generated index.html "directory listing" files the OpenCode
 * TUI static server writes into dist — they leak the local build path.
 */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p);
    } else if (e.name.endsWith(".jsx")) {
      await rm(p);
    } else if (e.name.endsWith(".jsx.map")) {
      await rm(p);
    } else if (e.name === "index.html" && (await readFile(p, "utf8")).includes("Directory listing")) {
      await rm(p);
    }
  }
}

async function copyTsxRecursive(srcDir, distDir, rel = "") {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const sp = join(srcDir, e.name);
    const dp = join(distDir, e.name);
    if (e.isDirectory()) {
      await mkdir(dp, { recursive: true });
      await copyTsxRecursive(sp, dp, rel + e.name + "/");
    } else if (e.name.endsWith(".tsx")) {
      await rm(dp.replace(/\.tsx$/, ".js"), { force: true });
      await rm(dp.replace(/\.tsx$/, ".js.map"), { force: true });
      await copyFile(sp, dp);
      console.log(`[postbuild] copied ${rel}${e.name} (uncompiled, runtime will transform)`);
    }
  }
}

await walk(DIST);
await copyTsxRecursive(SRC, DIST);
console.log("[postbuild] done");
