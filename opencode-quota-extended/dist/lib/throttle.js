/**
 * Simple time-since-last-fire throttle gate.
 *
 * Used by the toast feature so a flurry of `session.idle` /
 * `session.compacted` events does not spam the user. No caching, no
 * deduplication — callers ask "may I fire?" and, when they actually fire,
 * call `record()`.
 */
export function createThrottle(minIntervalMs) {
    let lastFireMs = Number.NEGATIVE_INFINITY;
    return {
        shouldFire(nowMs) {
            if (minIntervalMs <= 0)
                return true;
            const now = nowMs ?? Date.now();
            return now - lastFireMs >= minIntervalMs;
        },
        record(nowMs) {
            lastFireMs = nowMs ?? Date.now();
        },
        reset() {
            lastFireMs = Number.NEGATIVE_INFINITY;
        },
    };
}
//# sourceMappingURL=throttle.js.map