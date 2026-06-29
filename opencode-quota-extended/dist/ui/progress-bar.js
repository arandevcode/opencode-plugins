/**
 * Build a visual progress bar using Unicode block characters.
 *
 * @param percentRemaining - Percent remaining (0-100), clamped internally
 * @param width - Character width of the bar (default 12)
 * @returns Filled (▓) and empty (░) strings of the appropriate length
 */
export function renderProgressBar(percentRemaining, width = 12) {
    const clamped = Math.max(0, Math.min(100, percentRemaining));
    const filledCount = Math.max(0, Math.min(width, Math.round((clamped / 100) * width)));
    return {
        filled: "▓".repeat(filledCount),
        empty: "░".repeat(width - filledCount),
        width,
    };
}
/**
 * Classify a percent-remaining value into a traffic-light state.
 *
 * - `ok` (≥50%): high quota remaining
 * - `warning` (25–49%): moderate usage
 * - `error` (<25%): nearly exhausted
 */
export function trafficLight(percentRemaining) {
    if (percentRemaining >= 50)
        return "ok";
    if (percentRemaining >= 25)
        return "warning";
    return "error";
}
/**
 * Map a traffic-light state to the corresponding TuiThemeCurrent color key.
 */
export function trafficLightColorKey(light) {
    if (light === "ok")
        return "accent";
    if (light === "warning")
        return "warning";
    return "error";
}
export function trafficLightIndicator(light) {
    if (light === "ok")
        return "●";
    if (light === "warning")
        return "●";
    return "●";
}
//# sourceMappingURL=progress-bar.js.map