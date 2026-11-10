import type { CardsSnapshot } from "./types.js";
export declare const SNAPSHOT_CACHE_VERSION = 1;
export interface CachedSnapshot {
    version: typeof SNAPSHOT_CACHE_VERSION;
    savedAt: string;
    snapshot: CardsSnapshot;
}
export declare function defaultSnapshotCachePath(): string;
/** Read the cache. Corrupt or missing files are treated as no cache. */
export declare function loadSnapshotCache(filePath?: string): Promise<CachedSnapshot | null>;
/** Persist the latest snapshot atomically. Never throws. */
export declare function saveSnapshotCache(snapshot: CardsSnapshot, filePath?: string): Promise<void>;
//# sourceMappingURL=snapshot-cache.d.ts.map