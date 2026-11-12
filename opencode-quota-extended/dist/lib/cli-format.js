/**
 * Pure helpers for the terminal CLI (`bin/quota.mjs`): the pace tick on a bar,
 * the pace text and the active OpenCode Go account marker. They live here, away
 * from the script, so they can be tested without running the CLI or the network.
 */
import { formatPace, paceLinePercent, quotaPace } from "./pace.js";
/**
 * Build a `width`-cell bar of quota left (▓ filled, ░ empty) with a `│` tick
 * overlaid at `markerPercent` (how much of the window is still ahead). The tick
 * replaces a cell, so the width never changes. A null marker means no tick.
 */
export function tickBar(percentRemaining, width, markerPercent) {
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
export function windowTickBar(window, width, now = Date.now()) {
    return tickBar(window.percentRemaining, width, paceLinePercent(window, now));
}
/** Pace text for the spend row and the tone it should be drawn in; null without pace data. */
export function windowPaceText(window, now = Date.now()) {
    const reading = quotaPace(window, now);
    if (!reading)
        return null;
    const text = formatPace(window, now);
    if (!text)
        return null;
    const tone = reading.pace === "buffer" ? "ok" : reading.pace === "burn" ? "error" : "dim";
    return { text, tone };
}
/**
 * Is this provider the OpenCode Go account the switcher marked as active?
 * Named accounts have ids like `opencode-go-<account>`; the match ignores case.
 */
export function isActiveGoProvider(providerId, activeAccount) {
    const account = activeAccount?.trim();
    if (!account)
        return false;
    return providerId.toLowerCase() === `opencode-go-${account}`.toLowerCase();
}
//# sourceMappingURL=cli-format.js.map