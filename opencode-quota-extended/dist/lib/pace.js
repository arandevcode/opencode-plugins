import { clampPercent, formatDuration } from "./reset-format.js";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Window length when the id/label names a known schedule, else null. */
export function windowDurationMs(window) {
    const key = `${window.id} ${window.label}`.toLowerCase();
    if (/\b5h\b|five[_ -]?hour/.test(key))
        return 5 * HOUR_MS;
    if (/weekly|seven[_ -]?day|\bweek\b/.test(key))
        return 7 * DAY_MS;
    if (/monthly|\bmonth\b/.test(key))
        return 30 * DAY_MS;
    return null;
}
/**
 * Compare remaining quota to the time left in the window. Returns null when the
 * schedule or reset time is unknown, or there is no reading to compare.
 */
export function quotaPace(window, now = Date.now()) {
    const duration = windowDurationMs(window);
    const resetAt = window.resetTimeIso ? Date.parse(window.resetTimeIso) : Number.NaN;
    const remaining = window.percentRemaining;
    if (duration == null || !Number.isFinite(resetAt) || !Number.isFinite(remaining))
        return null;
    const exactTimeLeft = Math.min(100, Math.max(0, ((resetAt - now) / duration) * 100));
    const deltaPercent = clampPercent(remaining) - clampPercent(exactTimeLeft);
    const pace = deltaPercent > 1 ? "buffer" : deltaPercent < -1 ? "burn" : "on-pace";
    const deltaMs = Math.round((Math.abs(Math.min(100, Math.max(0, remaining)) - exactTimeLeft) / 100) * duration);
    return { pace, deltaPercent, deltaMs };
}
/** One short line: "margin +6% · 3h 12m", "ahead -6% · 1d 2h" or "on pace". */
export function formatPace(window, now = Date.now()) {
    const reading = quotaPace(window, now);
    if (!reading)
        return "";
    const { pace, deltaPercent, deltaMs } = reading;
    if (pace === "on-pace")
        return "on pace";
    const word = pace === "buffer" ? "margin" : "ahead";
    const sign = deltaPercent > 0 ? "+" : "";
    const gap = formatDuration(deltaMs);
    return gap
        ? `${word} ${sign}${deltaPercent}% · ${gap}`
        : `${word} ${sign}${deltaPercent}%`;
}
//# sourceMappingURL=pace.js.map