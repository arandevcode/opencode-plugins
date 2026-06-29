/**
 * Toast message formatter.
 *
 * Renders a `CardsSnapshot` (the same data structure the TUI sidebar
 * consumes) into a compact multi-line string suitable for OpenCode's
 * `tui.showToast`. The shape is loosely modelled on upstream's
 * `formatQuotaRowsGrouped` — provider header followed by one line per
 * usage window — but kept narrower since our snapshot has fewer fields.
 *
 * Returns `null` when no provider has any window worth showing.
 */
import type { CardsSnapshot } from "./types.js";
export interface FormatToastMessageOptions {
    /** Override the current time for deterministic tests. */
    now?: Date;
    /** Maximum chars per line (lines longer than this are clipped). Default 60. */
    maxLineWidth?: number;
}
/**
 * Render a CardsSnapshot to a multi-line toast string, or `null` if there
 * is nothing meaningful to display.
 */
export declare function formatToastMessage(snapshot: CardsSnapshot, opts?: FormatToastMessageOptions): string | null;
//# sourceMappingURL=toast-format.d.ts.map