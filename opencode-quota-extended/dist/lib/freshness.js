/**
 * Reading freshness helpers.
 *
 * The sidebar polls providers instead of waiting for user messages, so a
 * fixed staleness threshold (as in the Claude Code panel) does not fit.
 * Instead, a reading is stale once it is older than
 * STALE_REFRESH_MULTIPLIER polling intervals. At the default 60 s interval
 * that tolerates two missed polls or transient timeouts before warning, and
 * it follows the user's configured interval automatically.
 */
import { formatDuration } from "./reset-format.js";
export const STALE_REFRESH_MULTIPLIER = 3;
const MINUTE_MS = 60_000;
/** Age of a reading in milliseconds, clamped to >= 0. Invalid dates count as 0. */
export function readingAgeMs(fetchedAt, now = Date.now()) {
    const parsed = Date.parse(fetchedAt);
    if (Number.isNaN(parsed))
        return 0;
    return Math.max(0, now - parsed);
}
/** How old a successful reading may be before it is considered stale. */
export function staleAfterMs(refreshIntervalMs) {
    const interval = Number.isFinite(refreshIntervalMs)
        ? Math.max(0, refreshIntervalMs)
        : 0;
    return interval * STALE_REFRESH_MULTIPLIER;
}
/** True when the reading is older than the configured staleness threshold. */
export function isReadingStale(fetchedAt, now, refreshIntervalMs) {
    if (Number.isNaN(Date.parse(fetchedAt)))
        return false;
    return readingAgeMs(fetchedAt, now) >= staleAfterMs(refreshIntervalMs);
}
/** Compact age label, reusing the same duration format as reset times. */
export function formatAge(ageMs) {
    const age = Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0;
    return age < MINUTE_MS ? "just now" : `${formatDuration(age)} ago`;
}
/** Age line shown under a provider title. */
export function formatReadingAge(fetchedAt, now = Date.now()) {
    return `read ${formatAge(readingAgeMs(fetchedAt, now))}`;
}
/**
 * True when a window reset happened after this reading was fetched.
 * The displayed percentage belongs to the previous window in that case.
 */
export function windowResetSinceReading(resetTimeIso, fetchedAt, now) {
    if (!resetTimeIso)
        return false;
    const reset = Date.parse(resetTimeIso);
    const read = Date.parse(fetchedAt);
    if (Number.isNaN(reset) || Number.isNaN(read))
        return false;
    return reset <= now && reset > read;
}
/** Best-effort detection of failures that need a credentials/setup hint. */
export function isCredentialError(message) {
    if (!message)
        return false;
    return /\b401\b|\b403\b|unauthori[sz]ed|forbidden|token expired|invalid (?:api )?key|key rejected|authentication failed|run \/connect|personal api key/i.test(message);
}
/** Avoid showing placeholder hints such as "not available" in stale lines. */
export function actionableHint(hint) {
    const trimmed = hint?.trim();
    if (!trimmed || trimmed.toLowerCase() === "not available")
        return undefined;
    return trimmed;
}
//# sourceMappingURL=freshness.js.map