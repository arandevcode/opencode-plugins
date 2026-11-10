import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  loadSnapshotCache,
  saveSnapshotCache,
  SNAPSHOT_CACHE_VERSION,
} from "../src/lib/snapshot-cache.js";
import type { CardsSnapshot } from "../src/lib/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function tempFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "quota-cache-test-"));
  tempDirs.push(dir);
  return join(dir, "nested", "last-snapshot.json");
}

const snapshot: CardsSnapshot = {
  generatedAt: "2026-11-10T12:00:00.000Z",
  providers: [
    {
      id: "openai",
      label: "OpenAI (Pro)",
      status: "ok",
      windows: [
        {
          id: "5h",
          label: "5h",
          percentRemaining: 42,
          resetTimeIso: "2026-11-10T15:00:00.000Z",
        },
      ],
      fetchedAt: "2026-11-10T12:00:00.000Z",
    },
  ],
};

describe("snapshot cache", () => {
  it("round-trips a snapshot and creates private directories and files", async () => {
    const file = await tempFile();

    await saveSnapshotCache(snapshot, file);

    const loaded = await loadSnapshotCache(file);
    expect(loaded?.version).toBe(SNAPSHOT_CACHE_VERSION);
    expect(loaded?.snapshot).toEqual(snapshot);

    expect((await stat(dirname(file))).mode & 0o777).toBe(0o700);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("returns null for a missing cache", async () => {
    expect(await loadSnapshotCache("/tmp/quota-cache-does-not-exist.json")).toBeNull();
  });

  it("returns null for corrupt JSON or an unknown cache version", async () => {
    const file = await tempFile();
    await saveSnapshotCache(snapshot, file);

    await writeFile(file, "not json", "utf8");
    expect(await loadSnapshotCache(file)).toBeNull();

    await writeFile(
      file,
      JSON.stringify({ version: 999, savedAt: new Date().toISOString(), snapshot }),
      "utf8",
    );
    expect(await loadSnapshotCache(file)).toBeNull();
  });

  it("writes a versioned JSON document", async () => {
    const file = await tempFile();
    await saveSnapshotCache(snapshot, file);

    const parsed = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    expect(parsed.version).toBe(SNAPSHOT_CACHE_VERSION);
    expect(typeof parsed.savedAt).toBe("string");
    expect(parsed.snapshot).toEqual(snapshot);
  });
});
