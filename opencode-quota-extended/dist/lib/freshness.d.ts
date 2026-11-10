export declare const STALE_REFRESH_MULTIPLIER = 3;
/** Age of a reading in milliseconds, clamped to >= 0. Invalid dates count as 0. */
export declare function readingAgeMs(fetchedAt: string, now?: number): number;
/** How old a successful reading may be before it is considered stale. */
export declare function staleAfterMs(refreshIntervalMs: number): number;
/** True when the reading is older than the configured staleness threshold. */
export declare function isReadingStale(fetchedAt: string, now: number, refreshIntervalMs: number): boolean;
/** Compact age label, reusing the same duration format as reset times. */
export declare function formatAge(ageMs: number): string;
/** Age line shown under a provider title. */
export declare function formatReadingAge(fetchedAt: string, now?: number): string;
/**
 * True when a window reset happened after this reading was fetched.
 * The displayed percentage belongs to the previous window in that case.
 */
export declare function windowResetSinceReading(resetTimeIso: string | undefined, fetchedAt: string, now: number): boolean;
/** Best-effort detection of failures that need a credentials/setup hint. */
export declare function isCredentialError(message: string | undefined): boolean;
/** Avoid showing placeholder hints such as "not available" in stale lines. */
export declare function actionableHint(hint: string | undefined): string | undefined;
//# sourceMappingURL=freshness.d.ts.map