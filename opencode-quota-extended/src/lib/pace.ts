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
import { clampPercent, formatDuration } from "./reset-format.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type QuotaPace = "buffer" | "on-pace" | "burn";

export interface QuotaPaceReading {
  pace: QuotaPace;
  /** Percentage-point gap between remaining quota and time left (rounded). */
  deltaPercent: number;
  /** The same gap expressed as time, in ms. */
  deltaMs: number;
}

/** Window length when the id/label names a known schedule, else null. */
export function windowDurationMs(window: Pick<QuotaWindow, "id" | "label">): number | null {
  const key = `${window.id} ${window.label}`.toLowerCase();
  if (/\b5h\b|five[_ -]?hour/.test(key)) return 5 * HOUR_MS;
  if (/weekly|seven[_ -]?day|\bweek\b/.test(key)) return 7 * DAY_MS;
  if (/monthly|\bmonth\b/.test(key)) return 30 * DAY_MS;
  return null;
}

/**
 * Compare remaining quota to the time left in the window. Returns null when the
 * schedule or reset time is unknown, or there is no reading to compare.
 */
export function quotaPace(window: QuotaWindow, now: number = Date.now()): QuotaPaceReading | null {
  const duration = windowDurationMs(window);
  const resetAt = window.resetTimeIso ? Date.parse(window.resetTimeIso) : Number.NaN;
  const remaining = window.percentRemaining;
  if (duration == null || !Number.isFinite(resetAt) || !Number.isFinite(remaining)) return null;
  const exactTimeLeft = Math.min(100, Math.max(0, ((resetAt - now) / duration) * 100));
  const deltaPercent = clampPercent(remaining) - clampPercent(exactTimeLeft);
  const pace: QuotaPace = deltaPercent > 1 ? "buffer" : deltaPercent < -1 ? "burn" : "on-pace";
  const deltaMs = Math.round((Math.abs(Math.min(100, Math.max(0, remaining)) - exactTimeLeft) / 100) * duration);
  return { pace, deltaPercent, deltaMs };
}

/** One short line: "margin +6% · 3h 12m", "ahead -6% · 1d 2h" or "on pace". */
export function formatPace(window: QuotaWindow, now: number = Date.now()): string {
  const reading = quotaPace(window, now);
  if (!reading) return "";
  const { pace, deltaPercent, deltaMs } = reading;
  if (pace === "on-pace") return "on pace";
  const word = pace === "buffer" ? "margin" : "ahead";
  const sign = deltaPercent > 0 ? "+" : "";
  const gap = formatDuration(deltaMs);
  return gap
    ? `${word} ${sign}${deltaPercent}% · ${gap}`
    : `${word} ${sign}${deltaPercent}%`;
}
