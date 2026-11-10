/**
 * Last successful snapshot cache.
 *
 * Keeps stale data visible after a TUI restart and lets the one-shot CLI
 * print how old the displayed readings are. The cache contains quota data
 * only, never credentials.
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { xdgCache } from "xdg-basedir";
export const SNAPSHOT_CACHE_VERSION = 1;
export function defaultSnapshotCachePath() {
    const cacheRoot = xdgCache ?? join(homedir(), ".cache");
    return join(cacheRoot, "opencode-quota-extended", "last-snapshot.json");
}
function isProvider(value) {
    if (!value || typeof value !== "object")
        return false;
    const provider = value;
    return (typeof provider.id === "string" &&
        typeof provider.label === "string" &&
        typeof provider.status === "string" &&
        typeof provider.fetchedAt === "string" &&
        Array.isArray(provider.windows));
}
function isSnapshot(value) {
    if (!value || typeof value !== "object")
        return false;
    const snapshot = value;
    return (typeof snapshot.generatedAt === "string" &&
        Array.isArray(snapshot.providers) &&
        snapshot.providers.every(isProvider));
}
/** Read the cache. Corrupt or missing files are treated as no cache. */
export async function loadSnapshotCache(filePath = defaultSnapshotCachePath()) {
    try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return null;
        const cached = parsed;
        if (cached.version !== SNAPSHOT_CACHE_VERSION)
            return null;
        if (typeof cached.savedAt !== "string")
            return null;
        if (!isSnapshot(cached.snapshot))
            return null;
        return {
            version: SNAPSHOT_CACHE_VERSION,
            savedAt: cached.savedAt,
            snapshot: cached.snapshot,
        };
    }
    catch {
        return null;
    }
}
/** Persist the latest snapshot atomically. Never throws. */
export async function saveSnapshotCache(snapshot, filePath = defaultSnapshotCachePath()) {
    const payload = {
        version: SNAPSHOT_CACHE_VERSION,
        savedAt: new Date().toISOString(),
        snapshot,
    };
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
        await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
        await writeFile(tempPath, `${JSON.stringify(payload)}\n`, {
            encoding: "utf8",
            mode: 0o600,
        });
        await rename(tempPath, filePath);
    }
    catch {
        try {
            await unlink(tempPath);
        }
        catch { }
    }
}
//# sourceMappingURL=snapshot-cache.js.map