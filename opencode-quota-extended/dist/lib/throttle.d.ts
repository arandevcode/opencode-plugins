/**
 * Simple time-since-last-fire throttle gate.
 *
 * Used by the toast feature so a flurry of `session.idle` /
 * `session.compacted` events does not spam the user. No caching, no
 * deduplication — callers ask "may I fire?" and, when they actually fire,
 * call `record()`.
 */
export interface Throttle {
    /** Returns true if the configured min interval has elapsed since the last `record()`. */
    shouldFire(nowMs?: number): boolean;
    /** Mark a fire as having occurred at the given time (defaults to now). */
    record(nowMs?: number): void;
    /** Reset the gate so the next `shouldFire()` returns true. Useful for tests. */
    reset(): void;
}
export declare function createThrottle(minIntervalMs: number): Throttle;
//# sourceMappingURL=throttle.d.ts.map