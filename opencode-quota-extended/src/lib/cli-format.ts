/**
 * Pure helpers for the terminal CLI (`bin/quota.mjs`): the pace tick on a bar,
 * the pace text and the active OpenCode Go account marker. They live here, away
 * from the script, so they can be tested without running the CLI or the network.
 */
import { formatPace, paceLinePercent, quotaPace } from "./pace.js";
import type { QuotaWindow } from "./types.js";

/** A bar split around a one-cell pace tick. `tick` is empty when there is no marker. */
export interface TickBar {
  before: string;
  tick: string;
  after: string;
}

/**
 * Build a `width`-cell bar of quota left (▓ filled, ░ empty) with a `│` tick
 * overlaid at `markerPercent` (how much of the window is still ahead). The tick
 * replaces a cell, so the width never changes. A null marker means no tick.
 */
export function tickBar(
  percentRemaining: number,
  width: number,
  markerPercent: number | null,
): TickBar {
  const clamped = Math.max(0, Math.min(100, percentRemaining));
  const filledCount = Math.max(0, Math.min(width, Math.round((clamped / 100) * width)));
  const cells = Array.from({ length: width }, (_, i) => (i < filledCount ? "▓" : "░"));
  if (markerPercent === null || width < 1) {
    return { before: cells.join(""), tick: "", after: "" };
  }
  const marker = Math.max(0, Math.min(100, markerPercent));
  const at = Math.min(width - 1, Math.max(0, Math.round((marker / 100) * (width - 1))));
  return {
    before: cells.slice(0, at).join(""),
    tick: "│",
    after: cells.slice(at + 1).join(""),
  };
}

/** Bar for a window: the tick sits where the pace line is, or is absent without schedule data. */
export function windowTickBar(window: QuotaWindow, width: number, now: number = Date.now()): TickBar {
  return tickBar(window.percentRemaining, width, paceLinePercent(window, now));
}

export type PaceTone = "ok" | "error" | "dim";

/** Pace text for the spend row and the tone it should be drawn in; null without pace data. */
export function windowPaceText(
  window: QuotaWindow,
  now: number = Date.now(),
): { text: string; tone: PaceTone } | null {
  const reading = quotaPace(window, now);
  if (!reading) return null;
  const text = formatPace(window, now);
  if (!text) return null;
  const tone: PaceTone =
    reading.pace === "buffer" ? "ok" : reading.pace === "burn" ? "error" : "dim";
  return { text, tone };
}

/**
 * Is this provider the OpenCode Go account the switcher marked as active?
 * Named accounts have ids like `opencode-go-<account>`; the match ignores case.
 */
export function isActiveGoProvider(providerId: string, activeAccount?: string): boolean {
  const account = activeAccount?.trim();
  if (!account) return false;
  return providerId.toLowerCase() === `opencode-go-${account}`.toLowerCase();
}
