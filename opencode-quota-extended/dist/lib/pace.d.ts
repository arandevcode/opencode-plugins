/**
 * Quota pace — how usage compares to the passage of time in a window.
 *
 * Every window resets on a known schedule (5h, weekly, monthly). When a window
 * carries its reset time we can say whether the remaining share is ahead of or
 * behind the clock: spending slower than time passes is margin, faster is
 * "ahead". This is the same reading Jarvis shows, but text-only — no overlay on
 * the progress bar, so it works at any terminal width.
 */
import type { QuotaWindow } from "./types.js";
export type QuotaPace = "buffer" | "on-pace" | "burn";
export interface QuotaPaceReading {
    pace: QuotaPace;
    /** Percentage-point gap between remaining quota and time left (rounded). */
    deltaPercent: number;
    /** The same gap expressed as time, in ms. */
    deltaMs: number;
}
/** Window length when the id/label names a known schedule, else null. */
export declare function windowDurationMs(window: Pick<QuotaWindow, "id" | "label">): number | null;
/**
 * Compare remaining quota to the time left in the window. Returns null when the
 * schedule or reset time is unknown, or there is no reading to compare.
 */
export declare function quotaPace(window: QuotaWindow, now?: number): QuotaPaceReading | null;
/** One short line: "margin +6% · 3h 12m", "ahead -6% · 1d 2h" or "on pace". */
export declare function formatPace(window: QuotaWindow, now?: number): string;
//# sourceMappingURL=pace.d.ts.map