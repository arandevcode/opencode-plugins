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
export declare function tickBar(percentRemaining: number, width: number, markerPercent: number | null): TickBar;
/** Bar for a window: the tick sits where the pace line is, or is absent without schedule data. */
export declare function windowTickBar(window: QuotaWindow, width: number, now?: number): TickBar;
export type PaceTone = "ok" | "error" | "dim";
/** Pace text for the spend row and the tone it should be drawn in; null without pace data. */
export declare function windowPaceText(window: QuotaWindow, now?: number): {
    text: string;
    tone: PaceTone;
} | null;
/**
 * Is this provider the OpenCode Go account the switcher marked as active?
 * Named accounts have ids like `opencode-go-<account>`; the match ignores case.
 */
export declare function isActiveGoProvider(providerId: string, activeAccount?: string): boolean;
//# sourceMappingURL=cli-format.d.ts.map